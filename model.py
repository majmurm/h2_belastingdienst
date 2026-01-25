"""
authors: Despoina Delipalla, Marit van den Helder & Marco Maier

Supporting file for report_results.py. Contains model initialization and
what steps are taken on the model level.
"""

import networkx as nx
import numpy as np
from random import random
import matplotlib.pyplot as plt
from collections import Counter, defaultdict

from mesa import Model, DataCollector
from mesa.discrete_space import Network
from agents import SMEAgent


# Self defined agents file
import agents


def compute_group_mean(model, size_cat, age_cat, has_advisor=None):
    """
    Calculates the mean compliance propensity for a specific demographic group.
    Used to determine which sectors are 'High Risk'.
    """
    # Filter agents belonging to the specific group
    group_agents = [
        a.propensity
        for a in model.agents
        if a.size_cat == size_cat
        and a.age_cat == age_cat
        and (has_advisor is None or a.has_advisor == has_advisor)
    ]

    if not group_agents:
        return 0.0
    return np.mean(group_agents)


def get_audit_percent(model):
    """
    Retrieve the percentage of audited agents in this step.
    """
    return model.total_audited_this_step


class SMEComplianceModel(Model):

    def __init__(
        self,
        N: int,
        size_shares: dict,
        age_shares: dict,
        C_target: float,
        m_size: float,
        m_age: float,
        kappa: float,
        audit_rates: dict,
        audit_types: dict,
        channel_effects: dict,
        intervention_costs: dict,
        decay_factor: float = 0.0,
        seed: int = 42,
        n_neighbours: int = 4,
    ):
        """
        TODO: add descriptions of agent characteristics and general description of model
        """
        super().__init__()
        self.rng = np.random.default_rng(seed=seed)

        # Population characteristics
        self.N = N
        self.size_shares = size_shares
        self.age_shares = age_shares
        self.C_target = C_target
        self.m_size = m_size
        self.m_age = m_age
        self.kappa = kappa

        # Setup for network
        self.n_neighbours = n_neighbours

        # Nudging strategies setup
        self.audit_types = audit_types
        self.channel_effects = channel_effects
        self.intervention_costs = intervention_costs
        self.audit_rates = audit_rates
        self.decay_factor = decay_factor

        # Tracking variables
        self.total_compliance_costs = 0.0
        self.current_commun = 0.0
        self.sector_warnings = {}  # Stores active warnings per group
        self.is_high_urgency_week = False  # Flag to signal agents when to learn
        self.step_count = 0
        self.total_audited_this_step = 0.0

        self.step_count = 0

        # TAX CALENDAR (Weeks)
        self.tax_deadline_week = 12
        self.audit_delay_weeks = 8

        # Population setup
        self.size_order = list(size_shares.keys())
        self.age_order = list(age_shares.keys())

        # Calculate weighted means for demographics to center propensity distribution around target.
        size_score = {cat: i for i, cat in enumerate(self.size_order)}
        age_score = {cat: i for i, cat in enumerate(self.age_order)}

        size_probs = np.array(
            [float(size_shares[c]) for c in self.size_order], dtype=float
        )
        age_probs = np.array(
            [float(age_shares[c]) for c in self.age_order], dtype=float
        )

        # Normalize probabilities
        size_probs = size_probs / size_probs.sum()
        age_probs = age_probs / age_probs.sum()

        E_S = sum(
            size_probs[i] * size_score[self.size_order[i]]
            for i in range(len(self.size_order))
        )
        E_A = sum(
            age_probs[i] * age_score[self.age_order[i]]
            for i in range(len(self.age_order))
        )

        # Build the mu table (target mean per group)
        mu_table = {}
        for s in self.size_order:
            for a in self.age_order:
                S_tilde = size_score[s] - E_S
                A_tilde = age_score[a] - E_A
                mu = C_target + m_size * S_tilde + m_age * A_tilde
                mu_table[(s, a)] = agents.clip01(mu)

        self.mu_table = mu_table

        # Create network structure to populate with agents
        prob = self.n_neighbours / self.N
        graph = nx.erdos_renyi_graph(n=self.N, p=prob, seed=seed)
        self.grid = Network(G=graph, capacity=1, random=self.random)
        cells = list(self.grid.all_cells)

        # Add other characteristics to the agents
        for i in range(N):
            s = self.rng.choice(self.size_order, p=size_probs)
            a = self.rng.choice(self.age_order, p=age_probs)

            if s == "Medium":
                prob_advisor = 1.0
            elif s == "Small":
                prob_advisor = 0.98
            else:  # Micro
                prob_advisor = 0.743

            has_advisor = self.rng.random() < prob_advisor

            mu = mu_table[(s, a)]

            # Boost initial propensity slightly if they have advisor
            if has_advisor:
                mu = min(1.0, mu + 0.02)
            else:
                mu = max(0.0, mu - 0.02)

            if mu <= 0.0:
                propensity = 0.0
            elif mu >= 1.0:
                propensity = 1.0
            else:
                alpha = self.kappa * mu
                beta = self.kappa * (1.0 - mu)
                propensity = float(self.rng.beta(alpha, beta))

            if s == "Micro":
                turnover = self.rng.uniform(10_000, 2_000_000)
            elif s == "Small":
                turnover = self.rng.uniform(2_000_000, 10_000_000)
            else:
                turnover = self.rng.uniform(10_000_000, 50_000_000)

            tax_rate = self.rng.uniform(0.2995, 0.3005)  # Assuming a tax rate of 30%

            SMEAgent(
                self,
                size_cat=s,
                age_cat=a,
                propensity=propensity,
                turnover=turnover,
                tax_rate=tax_rate,
                cell=cells[i],
                has_advisor=has_advisor,
            )

        # Pre-calculate counts per group to easily calculate targeted costs later
        self.group_counts = Counter((a.size_cat, a.age_cat) for a in self.agents)

        # Data reporting setup 18 Classes (Size x Age x Advisor)
        model_reporters = {}
        advisor_states = [True, False]

        # Dynamic reporter generation for each group
        for s in self.size_order:
            for a in self.age_order:
                for adv in advisor_states:
                    adv_str = "Advisor" if adv else "NoAdvisor"
                    label = f"{s} - {a} - {adv_str}"
                    # Partial function trick to freeze loop variables
                    model_reporters[label] = (
                        lambda m, s=s, a=a, adv=adv: compute_group_mean(m, s, a, adv)
                    )

        model_reporters["Mean Propensity"] = lambda m: np.mean(
            [a.propensity for a in m.agents]
        )
        model_reporters["% Audited"] = get_audit_percent

        self.datacollector = DataCollector(model_reporters=model_reporters)

    def auditing_strategy(self):
        """
        Executes the audit logic for the current week.
        Strategy:
        1. Identification: Agents are eligible only if the 'Cooldown Period' has passed.
        2. Selection: Audit campaign happens once a year (concentrated force).
        3. Assignment: 50% Random Audits, 50% Risk-Based (Targeted) Audits.
        """
        eligible_for_audit = []
        total_audits_count = 0
        current_week_of_year = self.step_count % 52
        # Week when the intense audit campaign starts
        audit_week = self.tax_deadline_week + self.audit_delay_weeks
        is_audit_campaign = current_week_of_year == audit_week

        # Group agents to apply specific audit rates
        groups = {}
        for ag in self.agents:
            key = (ag.size_cat, ag.age_cat)
            groups.setdefault(key, []).append(ag)

        for key, members in groups.items():
            n_total = len(members)
            base_rate = float(self.audit_rates.get(key, 0.0))

            # If it's campaign month, concentrate the annual power (x12).
            # Otherwise, rate is 0.
            if is_audit_campaign:
                current_rate = base_rate * 12  # edit --> remnant
            else:
                current_rate = 0.0

            target_audits = int(round(current_rate * n_total))

            # 3 Years in weeks = 156 Steps (assuming 1 step = 1 week)
            # Agent cannot be audited if audited recently.
            COOLDOWN_PERIOD = 156

            group_eligible = [
                ag
                for ag in members
                if (self.step_count - ag.last_audit_step) >= COOLDOWN_PERIOD
            ]

            n_actual = min(len(group_eligible), target_audits)

            # if n_actual > 0:
            #     idx_aud = self.rng.choice(len(eligible_agents), size=n_actual, replace=False)

            #     for i in idx_aud:
            #         target_agent = eligible_agents[i]
            #         target_agent.audited_last_step = 1     # For propensity update
            #         target_agent.last_audit_step = self.step_count # Mark the time of audit
            #     total_audits_count += n_actual

            #     #  Cost of audits
            #     self.total_compliance_costs += n_actual * self.intervention_costs['audit']

            if n_actual > 0:
                # Select agents randomly from eligible list
                selected = self.rng.choice(group_eligible, size=n_actual, replace=False)
                eligible_for_audit.extend(selected)

        # 2. Execute Audits (Types & Costs)
        if eligible_for_audit:
            total_audits_count = len(eligible_for_audit)
            self.rng.shuffle(eligible_for_audit)

            mid_point = len(eligible_for_audit) // 2
            random_group = eligible_for_audit[:mid_point]
            targeted_group = eligible_for_audit[mid_point:]

            audit_type_keys = list(self.audit_types.keys())

            # A. Random Group Strategy
            for ag in random_group:
                # Randomly pick a type
                choice_name = self.rng.choice(audit_type_keys)
                props = self.audit_types[choice_name]

                # Apply Audit
                ag.audit_impact = props["effect"]
                ag.last_audit_step = self.step_count
                self.total_compliance_costs += props["cost"]

            # B. Targeted Group (Risk-Based Selection) (using same approach as company visits: Group Mean).
            # Strategy: Allocate resources based on risk.
            # Risk Proxy: Current Group Mean Propensity (Lower = Higher Risk)
            # --> take advisor into account!
            targeted_group.sort(
                key=lambda x: compute_group_mean(self, x.size_cat, x.age_cat)
            )

            n_t = len(targeted_group)
            for i, ag in enumerate(targeted_group):
                # Split the targeted group into thirds based on performance
                if i < n_t / 3:
                    # Bottom 33% of performance (Highest Risk) -> Deep Audit
                    choice_name = "Deep"
                elif i < 2 * n_t / 3:
                    # Middle -> Standard Audit
                    choice_name = "Standard"
                else:
                    # Top performers (Lowest Risk) -> Light Audit
                    choice_name = "Light"

                props = self.audit_types[choice_name]

                # Apply Audit
                ag.audit_impact = props["effect"]
                ag.last_audit_step = self.step_count
                self.total_compliance_costs += props["cost"]

        # Calculate % audited
        self.total_audited_this_step = total_audits_count / self.N

    def step(self):
        """
        Advances the model by one step (one week).
        Coordinates the 'Tax Calendar' of communications and audits.
        """
        current_week = self.step_count % 52
        self.current_week = current_week
        # 1. Define Critical Weeks
        week_early = self.tax_deadline_week - 4  # Week 8
        week_mid = self.tax_deadline_week - 2  # Week 10
        week_late = self.tax_deadline_week - 1  # Week 11

        # Company Visit Window:
        # Audit (Week 20) + 8 weeks = Week 28. 8 week delay is arbitrarily chosen to reflect a time period after the auditing period
        # First Reminder (Week 8 next year) - 4 weeks = Week 4 (or 56). 4 weeks before the first reminder is also chosen arbitrarily
        # We arbitrarily pick Week 35 as the "Company Visit Campaign" week, since it is within the outlined time interval
        week_visit_campaign = 35

        # Reset weekly flags
        self.is_high_urgency_week = False
        self.sector_warnings.clear()  # Reset targeted warnings each step
        self.current_commun = 0.0  # Default state: No communication

        # 2. Communication Strategy (Nudges)
        if current_week == week_early:
            # 4 Weeks before: Physical Letter (Low effect)
            self.current_commun = self.channel_effects["physical_letter"]

            # Add Cost (Everyone gets it)
            self.total_compliance_costs += (
                self.N * self.intervention_costs["physical_letter"]
            )

        elif current_week == week_mid:
            # 2 Weeks before: eMail (Medium effect)
            self.current_commun = self.channel_effects["email"]
            # Add Cost (Everyone gets it)
            self.total_compliance_costs += self.N * self.intervention_costs["email"]

        elif current_week == week_late:
            # 1 Week before: eMail (High effect - double of the default value to reflect the urgency of the pending deadline)
            self.current_commun = self.channel_effects["email"] * 2.0
            # Add costs
            self.total_compliance_costs += self.N * self.intervention_costs["email"]

        # 3. Targeted Company Visits (Warning Letters)
        if current_week == week_visit_campaign:
            # Check history of risk (Compare group mean to target)
            for s in self.size_order:
                for a in self.age_order:
                    # Risk Check: Is this sector performing below target?
                    group_mean = compute_group_mean(self, s, a)

                    # If the sector is risky (below compliance target)
                    if group_mean < self.C_target:
                        # Assign Warning effect to this specific sector
                        self.sector_warnings[(s, a)] = self.channel_effects[
                            "warning_letter"
                        ]

                        # Apply Cost (Only to agents in this sector)
                        sector_count = self.group_counts[(s, a)]
                        self.total_compliance_costs += (
                            sector_count * self.intervention_costs["warning_letter"]
                        )
        # 4. Execute Sub-routines
        self.auditing_strategy()
        self.agents.shuffle_do("step")
        self.datacollector.collect(self)
        self.step_count += 1


def report_tax_gap(model, step_label):
    """Calculates and prints the difference between Potential and Actual Tax Revenue."""
    total_potential = 0.0
    total_actual = 0.0
    gap_by_size = defaultdict(lambda: {"potential": 0.0, "actual": 0.0})

    for a in model.agents:
        potential = a.turnover * a.tax_rate
        actual = potential * a.propensity

        total_potential += potential
        total_actual += actual

        gap_by_size[a.size_cat]["potential"] += potential
        gap_by_size[a.size_cat]["actual"] += actual

    total_gap = total_potential - total_actual

    print(f"\n--- {step_label} TAX GAP ANALYSIS ---")
    print(f"Total Potential:  {total_potential:,.2f}")
    print(f"Total Collected:  {total_actual:,.2f}")
    print(f"TOTAL GAP:        {total_gap:,.2f}")
    print(f"Gap Percentage:   {(total_gap/total_potential)*100:.2f}%")

    return total_gap
