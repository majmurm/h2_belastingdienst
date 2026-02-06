"""
authors: Marco Maier, Despoina Delipalla, Marit van den Helder

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


def clip01(x: float) -> float:
    """
    Make sure the compliance propensity is always between 0 and 1.
    """
    return float(max(0.0, min(1.0, x)))


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
        communication_schedule: dict,
        tax_gap_target_rate: float = 0.05,
        noncompliance_target_rate: float = 0.30,
        calibrate_baseline: bool = True,
        underpayment_mean_if_noncompliant = None,
        decay_factor: float = 0.0,
        seed: int = 42,
        n_neighbours: int = 4,
        warning_visit_week: int = 35,
    ):
        """
        Parameters:
            N: number of agents,
            size_shares: distribution of sizes of SMEs (small, medium, large),
            age_shares: distribution of ages of SMEs (young, mature, old),
            C_target: target compliance (mean of Beta distribution),
            m_size: weight of size on propensity,
            m_age: weight of age on propensity,
            kappa: concentration parameter (variance of Beta distribution),
            audit_rates: rate of audits per category of SME,
            audit_types: 3 types of audits with associated costs,
            channel_effects: effect size of communication channels,
            intervention_costs: costs of communication channels,
            tax_gap_target_rate: target gross tax gap rate (0.05 for 5%),
            noncompliance_target_rate: target non-compliance incidence (0.30 for 30%),
            calibrate_baseline: if True, shifts initial propensities to match noncompliance_target_rate,
            underpayment_mean_if_noncompliant: if provided, fixes the average underpayment intensity among evaders; otherwise calibrated to hit tax_gap_target_rate
            decay_factor: natural decay in compliance,
            seed: random seed for reproducibility,
            n_neighbours: average number of neighbors each agent has
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
        self.communication_schedule = communication_schedule
        
        # Link non-compliance incidence to the revenue-weighted tax gap
        self.tax_gap_target_rate = float(tax_gap_target_rate)
        self.noncompliance_target_rate = float(noncompliance_target_rate)
        self.calibrate_baseline = bool(calibrate_baseline)
        self.underpayment_mean_if_noncompliant = underpayment_mean_if_noncompliant  # calibrated later if None
        
        
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
        self.warning_visit_week = int(warning_visit_week)

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
        graph = nx.erdos_renyi_graph(n=self.N, p=prob, seed=seed) # What's an 'erdos_renyi graph'?
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
                # beta = (1.0 / mu) - 1.0   # power-law shape parameter --> experiment using power-law distribution
                # propensity = 1.0 - self.rng.random() ** (1.0 / beta)

            
            if s == "Micro":
                turnover = self.rng.uniform(80_000, 400_000) # Future work: What is the actual prob distribution for turnover of companies? It is definitely not uniform
            elif s == "Small":
                turnover = self.rng.uniform(400_000, 2_500_000)
            else:
                turnover = self.rng.uniform(2_500_000, 20_000_000)
            
            tax_rate = self.rng.uniform(0.2999, 0.3001)  # Assuming a tax rate of 30%

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
        
        # Calibrate the (propensity -> tax gap) mapping so that baseline matches targets
        self._calibrate_tax_gap_link()
        
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
        model_reporters["Non-Compliance Ratio"] = lambda m: m.compute_noncompliance_ratio()
        model_reporters["Tax Gap %"] = lambda m: m.compute_tax_gap_rate()
        model_reporters["Mean Underpayment | Noncompliant"] = lambda m: float(m.underpayment_mean_if_noncompliant or 0.0)

        self.datacollector = DataCollector(model_reporters=model_reporters)
    
    
    
    # Tax gap accounting
    def _agent_liability(self, a) -> float:
        return float(a.turnover * a.tax_rate)

    def compute_noncompliance_ratio(self) -> float:
        """Unweighted incidence proxy: E[1 - propensity]."""
        return float(np.mean([1.0 - a.propensity for a in self.agents]))

    def compute_weighted_noncompliance(self) -> float:
        """Liability-weighted incidence proxy used in the tax-gap identity."""
        total_L = 0.0
        total_L_p = 0.0
        for a in self.agents:
            L = self._agent_liability(a)
            p = 1.0 - a.propensity
            total_L += L
            total_L_p += L * p
        return float(total_L_p / total_L) if total_L > 0 else 0.0

    def expected_unpaid_tax(self, a) -> float:
        """E[unpaid] = Liability * P(noncompliant) * E[underpayment | noncompliant]."""
        L = self._agent_liability(a)
        p_noncomp = 1.0 - a.propensity
        u = float(self.underpayment_mean_if_noncompliant or 0.0)
        return float(L * p_noncomp * u)

    def expected_paid_tax(self, a) -> float:
        L = self._agent_liability(a)
        return float(L - self.expected_unpaid_tax(a))

    def compute_tax_gap_rate(self) -> float:
        total_L = 0.0
        total_unpaid = 0.0
        for a in self.agents:
            L = self._agent_liability(a)
            total_L += L
            total_unpaid += self.expected_unpaid_tax(a)
        return float(total_unpaid / total_L) if total_L > 0 else 0.0

    def _calibrate_tax_gap_link(self) -> None:
        """
        Ensures baseline consistency between:
          - noncompliance_target_rate (incidence: mean(1 - propensity)), and
          - tax_gap_target_rate (revenue-weighted gap: sum L*p*u / sum L).

        Implementation:
          1) Optionally shift initial propensities so mean(1 - propensity) matches target. --> uncommment if needed
          2) If underpayment_mean_if_noncompliant is None, set it so the baseline tax gap matches target.
        """
        # 1) Shift propensities so that unweighted noncompliance matches target
        # if self.calibrate_baseline:
        #     target_mean_compliance = 1.0 - self.noncompliance_target_rate
        #     current_mean_compliance = float(np.mean([a.propensity for a in self.agents]))
        #     delta = target_mean_compliance - current_mean_compliance
        #     if abs(delta) > 1e-12:
        #         for a in self.agents:
        #             a.propensity = clip01(a.propensity + delta)

        # 2) Calibrate average underpayment intensity among evaders (u) to hit the target tax gap
        if self.underpayment_mean_if_noncompliant is None:
            w_noncomp = self.compute_weighted_noncompliance()
            if w_noncomp <= 0.0:
                self.underpayment_mean_if_noncompliant = 0.0
            else:
                u = self.tax_gap_target_rate / w_noncomp
                # If u>1, the pair (tax_gap_target_rate, noncompliance distribution) is inconsistent under this model
                self.underpayment_mean_if_noncompliant = float(max(0.0, min(1.0, u)))
    
    
    
    
    
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

            # If it's campaign month, base rate otherwise, rate is 0.
            if is_audit_campaign:
                current_rate = base_rate
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

            # B. Targeted Group (Risk-Based Selection) (using similar approach as company visits: Group Mean).
            # Strategy: Allocate resources based on risk.
            # Risk Proxy: Current Group Mean Propensity (Lower = Higher Risk)
            targeted_group.sort(
                key=lambda x: compute_group_mean(self, x.size_cat, x.age_cat)
            )

            n_t = len(targeted_group)
            for i, ag in enumerate(targeted_group):
                # Split the targeted group into thirds based on performance
                if i < n_t / 3:
                    # Bottom 33% of performance (Highest Risk) -> Deep Audit (book audit)
                    choice_name = "Deep"
                elif i < 2 * n_t / 3:
                    # Middle -> Standard Audit (corporate income tax report check)
                    choice_name = "Standard"
                else:
                    # Top performers (Lowest Risk) -> Light Audit (IH check)
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
        
        # Calculate weeks remaining until deadline
        weeks_until_deadline = self.tax_deadline_week - current_week
        self.weeks_until_deadline = weeks_until_deadline
        
        # Reset weekly flags
        self.is_high_urgency_week = False
        self.sector_warnings.clear()  # Reset targeted warnings each step
        self.current_commun = 0.0  # Default state: No communication
        
        if weeks_until_deadline in self.communication_schedule:
            
            todays_channels = self.communication_schedule[weeks_until_deadline]
            
            # Automatic Urgency Rule:
            # If we are exactly 1 week away, everything is twice as effective.
            urgency_multiplier = 2.0 if weeks_until_deadline == 1 else 1.0

            for channel in todays_channels:
                # 1. Apply effect with multiplier
                base_effect = self.channel_effects[channel]
                self.current_commun += base_effect * urgency_multiplier
                
                # 2. Apply cost (Cost does not double, only effect)
                self.total_compliance_costs += self.N * self.intervention_costs[channel]
        
        
        # Company Visit Window:
        # Audit (Week 20) + 8 weeks = Week 28. 8 week delay is arbitrarily chosen to reflect a time period after the auditing period
        # First Reminder (Week 8 next year) - 4 weeks = Week 4 (or 56). 4 weeks before the first reminder is also chosen arbitrarily
        # Company Visit Campaign week (configurable)
        week_visit_campaign = self.warning_visit_week


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
