# -*- coding: utf-8 -*-
"""
Created on Mon Jan 19 11:15:00 2026
@author: marco


SME Tax Compliance Agent-Based Model (ABM)

This model simulates the tax compliance behavior of Small-to-Medium Enterprises (SMEs) in the Netherlands.
It models how compliance propensity evolves over time based on:
1.  Interventions: Audits and Communications (Nudges)
2.  Demographics: Agent Size (Micro, Small, Medium) and Age (Young, Mature, Old).
3.  Time: A Natural decay of compliance behavior over time.
"""

# Imports
import argparse
import json
import mesa
from mesa import Agent, Model
from mesa.datacollection import DataCollector
import numpy as np
from collections import Counter, defaultdict
import matplotlib.pyplot as plt

def clip01(x: float) -> float:
    """Clips a value to ensure it remains within the probability range [0.0, 1.0]."""
    return float(max(0.0, min(1.0, x)))

def compute_group_mean(model, size_cat, age_cat):
    """
    Calculates the mean compliance propensity for a specific demographic group.
    Used to determine which sectors are 'High Risk'.
    """
    # Filter agents belonging to the specific group
    group_agents = [
        a.propensity 
        for a in model.agents 
        if a.size_cat == size_cat and a.age_cat == age_cat
    ]
    
    if not group_agents:
        return 0.0
    return np.mean(group_agents)

# Helper to get the audit %
def get_audit_percent(model):
    """Reporter function: Returns the percentage of the population audited this step."""
    return model.total_audited_this_step

"""
Create Agent
"""
class SMEAgent(Agent):
    """
    Represents a single SME taxpayer.
    
    Attributes:
        propensity (float): The likelihood of the agent paying full tax (0.0 to 1.0).
        turnover (float): The revenue of the company.
        tax_rate (float): The applicable tax rate.
        last_audit_step (int): The simulation step when the agent was last audited.
    """
    def __init__(self, model, size_cat: str, age_cat: str, propensity: float, turnover: float, tax_rate: float):
        super().__init__(model)
        self.size_cat = size_cat
        self.age_cat = age_cat
        self.propensity = propensity
        self.turnover = turnover    
        self.tax_rate = tax_rate    
        
        # Auditing flags
        self.audit_impact = 0.0 # Stores the effect size of the specific audit received
        self.audited_last_step = 0
        self.comm_sensitivity = 1.0
        
        # Instead of a yearly flag, we track the specific step of the last audit.
        # Initialize to -999 so they are eligible immediately (since step_count starts at 0).
        self.last_audit_step = -999 

    def step(self):
        """
        Agent decision cycle per time step (1 week):
        1. Receive External Signals (Audit impact + Communications).
        2. Calculate Compliance Improvement (Positive Force).
        3. Calculate Natural Decay (Negative Force).
        4. Update Propensity.
        """
        # Retrieve the specific impact of the audit received this step (0.0 if none)
        audit_effect = self.audit_impact  
        
        # 1. Global Communication (General Nudges)
        global_comm = self.model.current_commun 
        
        # 2. Targeted Communication (Sector-specific Company Visit)
        # Check if this agent's sector (Size/Age) is flagged for a warning visit
        targeted_comm = self.model.sector_warnings.get((self.size_cat, self.age_cat), 0.0)
        
        # Total communication intensity
        d = global_comm + targeted_comm
        
        decay = self.model.decay_factor

        # Positive Force: Pulls propensity towards 1.0.
        # Logic: The gap to perfection (1 - propensity) is closed by the intervention intensity.
        # Diminishing returns: As propensity gets higher, it's harder to improve further.
        improvement = (1 - self.propensity) * (audit_effect + d)
        #improvement = (1 - self.propensity) * ((b * a_t) + d)

        # 2. Calculate Natural Decay (Negative Force)
        # This pulls propensity DOWN towards 0.0. 
        # Using multiplication (self.propensity * decay) ensures it scales 
        # (e.g., losing 2% of your current honesty).
        deterioration = self.propensity * decay 

        # 3. Apply changes
        self.propensity = clip01(
            self.propensity + improvement - deterioration
        )
        
        if self.model.is_high_urgency_week:
            # Increase sensitivity by 5% (cumulative)
            self.comm_sensitivity *= 1.05 
            # Cap sensitivity to prevent runaway values (max 2.0)
            self.comm_sensitivity = min(self.comm_sensitivity, 2.0)
        
        # 4. Reset Temporary Flags
        # The audit impact is instantaneous (one-shot), so we reset it after processing.
        self.audited_last_step = 0
        self.audit_impact = 0.0


class SMEComplianceModel(Model):
    """
    The central environment managing the simulation.
    
    Key Responsibilities:
    1. Initialize population with realistic demographic distributions.
    2. Manage the 'Tax Calendar' (Scheduling interventions).
    3. Execute Auditing Strategy (Random vs. Risk-based).
    4. Track costs and tax gaps.
    """
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
        #auditing_param: float,
        channel_effects: dict, # Renamed from commun_param to accept dict
        intervention_costs: dict, # Costs dictionary
        decay_factor: float = 0.0,
        seed: int = 42,       
    ):
        super().__init__()
        self.N = N
        self.rng = np.random.default_rng(seed)
        
        # Configuration Parameters
        self.size_shares = size_shares
        self.age_shares = age_shares
        self.C_target = C_target  # Target compliance (Mean of the Beta distribution)
        self.m_size = m_size # Weight of size on propensity
        self.m_age = m_age # Weight of age on propensity
        self.kappa = kappa # Concentration parameter (Variance of Beta distribution)
        
        # Configuration Interventions
        self.audit_types = audit_types # Store the 3 types (Light, Standard, Deep)
        #self.commun_base_intensity = commun_param 
        self.channel_effects = channel_effects # Store the distinct channel effects
        self.intervention_costs = intervention_costs # Store costs
        self.audit_rates = audit_rates
        self.decay_factor = decay_factor
        
        # State Variables
        self.total_compliance_costs = 0.0            # Track total spend
        self.current_commun = 0.0
        self.sector_warnings = {} # Stores active warnings per group  
        self.is_high_urgency_week = False # Flag to signal agents when to learn
        self.step_count = 0  
        self.total_audited_this_step = 0.0
        
        # TAX CALENDAR (in Weeks)
        self.tax_deadline_week = 12  
        self.audit_delay_weeks = 8  
        self.warning_visit_week = 35
        
        # Population Setup
        self.size_order = list(size_shares.keys())
        self.age_order = list(age_shares.keys())
        
        # 1. Calculate weighted means for demographics (Expected Values)
        # This is used to center the propensity distribution around the target.
        size_score = {cat: i for i, cat in enumerate(self.size_order)}
        age_score = {cat: i for i, cat in enumerate(self.age_order)}

        size_probs = np.array([float(size_shares[c]) for c in self.size_order], dtype=float)
        age_probs = np.array([float(age_shares[c]) for c in self.age_order], dtype=float)
        
        # Normalize probabilities
        size_probs = size_probs / size_probs.sum()
        age_probs = age_probs / age_probs.sum()
        
        E_S = sum(size_probs[i] * size_score[self.size_order[i]] for i in range(len(self.size_order)))   
        E_A = sum(age_probs[i] * age_score[self.age_order[i]] for i in range(len(self.age_order)))       
        
        # 2. Build the 'Mu Table' (Target Mean per Group)
        mu_table = {}
        for s in self.size_order:
            for a in self.age_order:
                S_tilde = size_score[s] - E_S  
                A_tilde = age_score[a] - E_A   
                mu = C_target + m_size * S_tilde + m_age * A_tilde 
                mu_table[(s, a)] = clip01(mu) 

        self.mu_table = mu_table 
        
        # 3. Create Agents
        for i in range(N):
            s = self.rng.choice(self.size_order, p=size_probs)
            a = self.rng.choice(self.age_order, p=age_probs)

            mu = mu_table[(s, a)]

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
            
            tax_rate = self.rng.uniform(0.15, 0.25)

            SMEAgent(self, size_cat=s, age_cat=a, propensity=propensity, turnover=turnover, tax_rate=tax_rate)
        
        # Pre-calculate counts per group to easily calculate targeted costs later
        self.group_counts = Counter((a.size_cat, a.age_cat) for a in self.agents)
        
        # Data reporting setup
        model_reporters = {}
        # Dynamic reporter generation for each group
        for s in self.size_order:
            for a in self.age_order:
                # We use partial to "freeze" the s and a values for each function
                label = f"{s} - {a}"
                # Partial function trick to freeze loop variables
                model_reporters[label] = lambda m, s=s, a=a: compute_group_mean(m, s, a)
        
        model_reporters["Mean Propensity"] = lambda m: np.mean([a.propensity for a in m.agents])
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
      is_audit_campaign = (current_week_of_year == audit_week)  
      
     
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
            current_rate = base_rate * 12 # edit --> remnant
        else:
            current_rate = 0.0
        
        target_audits = int(round(current_rate * n_total))
        
        # 3 Years in weeks = 156 Steps (assuming 1 step = 1 week)
        # Agent cannot be audited if audited recently.
        COOLDOWN_PERIOD = 156 
        
        group_eligible = [
            ag for ag in members 
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
              ag.audit_impact = props['effect']
              ag.last_audit_step = self.step_count
              self.total_compliance_costs += props['cost']
              
          # B. Targeted Group (Risk-Based Selection) (using same approach as company visits: Group Mean). 
          # Strategy: Allocate resources based on risk. 
          # Risk Proxy: Current Group Mean Propensity (Lower = Higher Risk)
          targeted_group.sort(key=lambda x: compute_group_mean(self, x.size_cat, x.age_cat))
          
          n_t = len(targeted_group)
          for i, ag in enumerate(targeted_group):
              # Split the targeted group into thirds based on performance
              if i < n_t / 3: 
                  # Bottom 33% of performance (Highest Risk) -> Deep Audit
                  choice_name = 'Deep'
              elif i < 2 * n_t / 3:
                  # Middle -> Standard Audit
                  choice_name = 'Standard'
              else:
                  # Top performers (Lowest Risk) -> Light Audit
                  choice_name = 'Light'
              
              props = self.audit_types[choice_name]
              
              # Apply Audit
              ag.audit_impact = props['effect']
              ag.last_audit_step = self.step_count
              self.total_compliance_costs += props['cost']
        
    # Calculate % audited
      self.total_audited_this_step = total_audits_count / self.N 
        
        
    def step(self):
      """
      Advances the model by one step (one week).
      Coordinates the 'Tax Calendar' of communications and audits.
      """
      current_week = self.step_count % 52
      
      # 1. Define Critical Weeks
      week_early = self.tax_deadline_week - 4  # Week 8
      week_mid   = self.tax_deadline_week - 2  # Week 10
      week_late  = self.tax_deadline_week - 1  # Week 11
      
      # Company Visit Window: 
      # Audit (Week 20) + 8 weeks = Week 28. 8 week delay is arbitrarily chosen to reflect a time period after the auditing period
      # First Reminder (Week 8 next year) - 4 weeks = Week 4 (or 56). 4 weeks before the first reminder is also chosen arbitrarily
      # We arbitrarily pick Week 35 as the "Company Visit Campaign" week, since it is within the outlined time interval
      week_visit_campaign = self.warning_visit_week 
      
      # Reset weekly flags
      self.is_high_urgency_week = False
      self.sector_warnings.clear() # Reset targeted warnings each step
      self.current_commun = 0.0 # Default state: No communication
      
      
      # 2. Communication Strategy (Nudges)
      if current_week == week_early:
          # 4 Weeks before: Physical Letter (Low effect)
          self.current_commun = self.channel_effects['physical_letter']
          
          # Add Cost (Everyone gets it)
          self.total_compliance_costs += self.N * self.intervention_costs['physical_letter']
          
      elif current_week == week_mid:
          # 2 Weeks before: eMail (Medium effect)
          self.current_commun = self.channel_effects['email']
          # Add Cost (Everyone gets it)
          self.total_compliance_costs += self.N * self.intervention_costs['email']
          
      elif current_week == week_late:
          # 1 Week before: eMail (High effect - double of the default value to reflect the urgency of the pending deadline)
          self.current_commun = self.channel_effects['email'] * 2.0
          # Add costs
          self.total_compliance_costs += self.N * self.intervention_costs['email']
      
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
                       self.sector_warnings[(s, a)] = self.channel_effects['warning_letter']  
                       
                       # Apply Cost (Only to agents in this sector)
                       sector_count = self.group_counts[(s, a)]
                       self.total_compliance_costs += sector_count * self.intervention_costs['warning_letter']
      # 4. Execute Sub-routines                 
      self.auditing_strategy()          
      self.agents.shuffle_do("step") 
      self.datacollector.collect(self)
      self.step_count += 1

# REPORTING & VISUALIZATION

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

def compute_tax_gap(model):
    total_potential = 0.0
    total_actual = 0.0
    gap_by_size = defaultdict(lambda: {"potential": 0.0, "actual": 0.0})
    gap_by_group = defaultdict(lambda: {"potential": 0.0, "actual": 0.0})

    for a in model.agents:
        potential = a.turnover * a.tax_rate
        actual = potential * a.propensity

        total_potential += potential
        total_actual += actual

        gap_by_size[a.size_cat]["potential"] += potential
        gap_by_size[a.size_cat]["actual"] += actual
        gap_by_group[(a.size_cat, a.age_cat)]["potential"] += potential
        gap_by_group[(a.size_cat, a.age_cat)]["actual"] += actual

    total_gap = total_potential - total_actual
    gap_pct = (total_gap / total_potential * 100.0) if total_potential > 0 else 0.0

    def finalize(entry):
        potential = entry["potential"]
        actual = entry["actual"]
        gap = potential - actual
        gap_pct = (gap / potential * 100.0) if potential > 0 else 0.0
        return {
            "potential": potential,
            "actual": actual,
            "gap": gap,
            "gap_pct": gap_pct,
        }

    by_size_out = {size: finalize(vals) for size, vals in gap_by_size.items()}
    by_group_out = {
        f"{size}-{age}": finalize(vals)
        for (size, age), vals in gap_by_group.items()
    }

    return {
        "total_potential": total_potential,
        "total_actual": total_actual,
        "total_gap": total_gap,
        "gap_pct": gap_pct,
        "by_size": by_size_out,
        "by_group": by_group_out,
    }

def collect_step_metrics(model):
    by_group_values = defaultdict(list)
    all_propensities = []
    high_compliance_count = 0

    for agent in model.agents:
        by_group_values[(agent.size_cat, agent.age_cat)].append(agent.propensity)
        all_propensities.append(agent.propensity)
        if agent.propensity >= 0.8:
            high_compliance_count += 1

    mean_by_group = {
        f"{size}-{age}": float(np.mean(vals))
        for (size, age), vals in by_group_values.items()
    }

    overall_mean = float(np.mean(all_propensities)) if all_propensities else 0.0
    high_compliance_pct = (high_compliance_count / model.N * 100.0) if model.N > 0 else 0.0

    return {
        "overall_mean": overall_mean,
        "mean_by_group": mean_by_group,
        "overall_audited_pct": model.total_audited_this_step * 100.0,
        "high_compliance_pct": high_compliance_pct,
        "tax_gap": compute_tax_gap(model),
        "total_cost": model.total_compliance_costs,
    }

def default_config():
    return {
        "N": 10000,
        "size_shares": {"Micro": 0.9683, "Small": 0.0248, "Medium": 0.0053},
        "age_shares": {"Young": 0.57, "Mature": 0.04, "Old": 0.39},
        "C_target": 0.693,
        "m_size": 0.05,
        "m_age": 0.05,
        "kappa": 339,
        "audit_rates": {
            "Micro-Young": 0.0046,
            "Micro-Mature": 0.0046,
            "Micro-Old": 0.0046,
            "Small-Young": 0.0046,
            "Small-Mature": 0.0046,
            "Small-Old": 0.0046,
            "Medium-Young": 0.0046,
            "Medium-Mature": 0.0046,
            "Medium-Old": 0.0046,
        },
        "audit_types": {
            "Light": {"effect": 0.45, "cost": 500.0},
            "Standard": {"effect": 0.90, "cost": 775.0},
            "Deep": {"effect": 1.80, "cost": 1550.0},
        },
        "channel_effects": {
            "physical_letter": 0.003,
            "email": 0.008,
            "warning_letter": 0.020,
        },
        "intervention_costs": {
            "email": 0.05,
            "physical_letter": 0.85,
            "warning_letter": 20.96,
        },
        "decay_factor": 0.00005,
        "seed": 42,
        "steps": 260,
        "tax_deadline_week": 12,
        "audit_delay_weeks": 8,
        "warning_visit_week": 35,
    }

def run_simulation(config):
    audit_rates = config["audit_rates"]
    normalized_rates = {}
    for key, value in audit_rates.items():
        if isinstance(key, (tuple, list)) and len(key) == 2:
            normalized_rates[tuple(key)] = float(value)
        elif isinstance(key, str) and "-" in key:
            size, age = key.split("-", 1)
            normalized_rates[(size, age)] = float(value)

    model = SMEComplianceModel(
        N=int(config["N"]),
        size_shares=config["size_shares"],
        age_shares=config["age_shares"],
        C_target=float(config["C_target"]),
        m_size=float(config["m_size"]),
        m_age=float(config["m_age"]),
        kappa=float(config["kappa"]),
        audit_rates=normalized_rates,
        audit_types=config["audit_types"],
        channel_effects=config["channel_effects"],
        intervention_costs=config["intervention_costs"],
        decay_factor=float(config["decay_factor"]),
        seed=int(config["seed"]),
    )
    model.tax_deadline_week = int(config["tax_deadline_week"])
    model.audit_delay_weeks = int(config["audit_delay_weeks"])
    model.warning_visit_week = int(config["warning_visit_week"])

    steps = []
    initial_metrics = collect_step_metrics(model)
    steps.append({"step": 0, **initial_metrics})

    for _ in range(int(config["steps"])):
        model.step()
        steps.append({"step": model.step_count, **collect_step_metrics(model)})

    initial_gap = initial_metrics["tax_gap"]["total_gap"]
    final_gap = steps[-1]["tax_gap"]["total_gap"]
    reduction = initial_gap - final_gap
    total_cost = steps[-1]["total_cost"]
    net_benefit = reduction - total_cost
    roi_ratio = (reduction / total_cost) if total_cost > 0 else 0.0

    return {
        "config": {
            **config,
            "audit_rates": {
                f"{size}-{age}": float(value)
                for (size, age), value in normalized_rates.items()
            },
        },
        "initial": {
            "overall_mean": initial_metrics["overall_mean"],
            "mean_by_group": initial_metrics["mean_by_group"],
            "tax_gap": initial_metrics["tax_gap"],
        },
        "steps": steps,
        "final": steps[-1],
        "summary": {
            "tax_gap_reduction": reduction,
            "total_cost": total_cost,
            "net_benefit": net_benefit,
            "roi_ratio": roi_ratio,
        },
    }
      
      
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--config", type=str)
    args = parser.parse_args()

    if args.json:
        config = default_config()
        if args.config:
            with open(args.config, "r", encoding="utf-8") as handle:
                incoming = json.load(handle)
            config.update(incoming)

        results = run_simulation(config)
        print(json.dumps(results))
        raise SystemExit(0)

    # Number of Agents
    N = 10000 
    
    # Demographics
    size_shares = {"Micro": 0.9683, "Small": 0.0248, "Medium": 0.0053}
    age_shares = {"Young": 0.57, "Mature": 0.04, "Old": 0.39}
    
    # Compliance Targets (based on the mean of the Jaarreportage)
    C_target = 0.693
    #C_target = 0.924 # alternative for individuals
    
    # Audit Rates (Base Weekly Rates)
    audit_rates = { 
       ("Micro", "Young"): 0.0046, ("Micro", "Mature"): 0.0046, ("Micro", "Old"): 0.0046,
       ("Small", "Young"): 0.0046, ("Small", "Mature"): 0.0046, ("Small", "Old"): 0.0046,
       ("Medium", "Young"): 0.0046,("Medium", "Mature"): 0.0046,("Medium", "Old"): 0.0046,
   }
    
    # Distinct effects for different channels
    # Original 'commun_param' was 0.008. We scale around that.
    channel_effects = {
        'physical_letter': 0.003,  # Lowest effect
        'email': 0.008,            # Slightly higher (standard)
        'warning_letter': 0.020    # At least double email
    }
    
    # Define 3 types of audits with different effects and costs
    audit_types = {
        'Light':    {'effect': 0.45, 'cost': 500.0}, # IH profit return check 
        'Standard': {'effect': 0.90, 'cost': 775.0},  # corporate income tax return check
        'Deep':     {'effect': 1.80, 'cost': 1550.0} # book audit High cost for detailed audit 1 FTE hr = EUR20.11 --> 78hr per book audit (2024) --> EUR1,569 per audit
    }
    
    
    # Define Costs (in EUR)
    intervention_costs = {
        'email': 0.05,            # Minimal system cost
        'physical_letter': 0.85,  # Print + Postage
        'warning_letter': 20.96  # Letter + ~1hr FTE for hand delivery
    }
    
    # Model Initialization
    print(f"Initializing Model with {N} agents...")
    model = SMEComplianceModel(
       N=N,
       size_shares=size_shares,
       age_shares=age_shares,
       C_target=C_target,
       m_size=0.05,
       m_age=0.05,
       kappa=339,
       audit_rates=audit_rates,
       audit_types=audit_types,
       channel_effects=channel_effects,
       intervention_costs=intervention_costs,
       decay_factor=0.00005,
       seed=42,
   )

    print("Total number of agents:", len(model.agents))

    # 1. Capture Initial State
    initial_means = {} 
    prop_by_group = defaultdict(list)
    
    for a in model.agents:
        prop_by_group[(a.size_cat, a.age_cat)].append(a.propensity)

    print("\nInitial mean propensity per group:")
    for (size, age), vals in sorted(prop_by_group.items()):
        mean_val = np.mean(vals)
        initial_means[(size, age)] = mean_val
        print(f"{size:7s} | {age:7s} | {mean_val:.4f}")

    initial_total_mean = np.mean([a.propensity for a in model.agents])
    print("\nInitial mean propensity (total):", initial_total_mean)
    
    initial_gap = report_tax_gap(model, "INITIAL (Step 0)")

    # 2. Run Simulation
    T = 260 # time steps in weeks
    for _ in range(T):
        model.step()

    # 3. Final Reporting
    print(f"\nMean propensity per group after {T} steps (with Change):")
    print(f"{'Size':<7} | {'Age':<7} | {'Final':<8} | {'Change':<8}")
    print("-" * 38)
    
    prop_by_group.clear()
    for a in model.agents:
        prop_by_group[(a.size_cat, a.age_cat)].append(a.propensity)

    for (size, age), vals in sorted(prop_by_group.items()):
        final_mean = np.mean(vals)
        init_mean = initial_means.get((size, age), 0.0)
        change = final_mean - init_mean
        print(f"{size:7s} | {age:7s} | {final_mean:.4f}   | {change:+.4f}")

    final_total_mean = np.mean([a.propensity for a in model.agents])
    total_change = final_total_mean - initial_total_mean

    print(f"\nFinal mean propensity (total): {final_total_mean:.4f}")
    print(f"Total Change in Propensity:    {total_change:+.4f}")

    # 5. FINAL TAX GAP
    final_gap = report_tax_gap(model, f"FINAL (Step {T})")
    
    
    # 6. SUMMARY & ROI CALCULATION
    reduction = initial_gap - final_gap
    total_cost = model.total_compliance_costs
    net_benefit = reduction - total_cost
    roi_ratio = reduction / total_cost
    
    print("\n" + "="*40)
    print(f"Tax Gap Reduction:   € {reduction:,.2f}")
    print(f"Total Intervention Cost: € {total_cost:,.2f}")
    print("-" * 40)
    print(f"Improvement:       {(reduction/initial_gap)*100:.2f}%")
    print(f"Net Benefit:         € {net_benefit:,.2f}")
    print(f"ROI Ratio (Return per €1 spent on interventions): € {roi_ratio:.2f}")
    print("="*40)
    
    
    # 4. Visualization 
    df = model.datacollector.get_model_vars_dataframe()
    
    fig, ax1 = plt.subplots(figsize=(12, 7), dpi=300)

    # Plot Propensity on left axis
    color = 'tab:blue'
    ax1.set_xlabel('Time (Weeks)')
    ax1.set_ylabel('Mean Compliance Propensity', color=color, fontsize=12)
    ax1.set_ylim(0.60, 0.90) # Feel free to adjust 
    
    # Plot individual groups with thinner lines
    for col in sorted(df.columns):
        if " - " in col:  # This selects "Micro - Young", "Small - Old", etc.
            ax1.plot(df.index, df[col], label=col, linewidth=1.5, alpha=0.8)
    
    # Add the Global Mean as a thicker, distinct line
    ax1.plot(df.index, df["Mean Propensity"], color='black', linewidth=2.5, linestyle=':', label="Global Mean")
    
    # Plot Audit % on right axis 
    ax2 = ax1.twinx()  
    color_audit = 'tab:red'
    ax2.set_ylabel('% Population Audited', color=color, fontsize=12)
    #ax2.plot(df.index, df["% Audited"], color=color, linestyle='--', linewidth=2, label="% Audited")
    ax2.fill_between(df.index, df["% Audited"], color=color_audit, alpha=0.3, label="% Audited")
    ax2.tick_params(axis='y', labelcolor=color)
    ax2.set_ylim(0, 0.15) # Scale this so spikes don't overlap the blue line too much
    
    # Combined Legend
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    # Place legend outside to the right so it doesn't cover the graph
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left', bbox_to_anchor=(1.1, 1))
    
    plt.title("SME Tax Compliance: 5-Year Simulation\nStrategy: Pulsed Audits + Behavioral Nudges")
    fig.tight_layout()
    plt.grid(True, linestyle=':', alpha=0.6)
    plt.show()
