# -*- coding: utf-8 -*-
"""
Created on Mon Jan 19 11:15:00 2026

@author: marco
"""

# Imports
import mesa
from mesa import Agent, Model
from mesa.datacollection import DataCollector
import numpy as np
from collections import Counter, defaultdict
import matplotlib.pyplot as plt

def clip01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))

def compute_group_mean(model, size_cat, age_cat):
    """
    Filters agents by the specific size/age group and returns their mean propensity.
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
    return model.total_audited_this_step

"""
Create Agent
"""
class SMEAgent(Agent):
    def __init__(self, model, size_cat: str, age_cat: str, propensity: float, turnover: float, tax_rate: float):
        super().__init__(model)
        self.size_cat = size_cat
        self.age_cat = age_cat
        self.propensity = propensity
        self.turnover = turnover    
        self.tax_rate = tax_rate    
        
        # Auditing flags
        self.audited_last_step = 0
        
        # Instead of a yearly flag, we track the specific step of the last audit.
        # Initialize to -999 so they are eligible immediately (since step_count starts at 0).
        self.last_audit_step = -999 

    def step(self):
        a_t = self.audited_last_step  
        b = self.model.auditing_param
        # Read the dynamic communication intensity (varies by week)
        d = self.model.current_commun 
        
        decay = self.model.decay_factor

        # 1. Calculate Audit/Community Improvement (Positive Force)
        # This pulls propensity UP towards 1.0
        improvement = (1 - self.propensity) * ((b * a_t) + d)

        # 2. Calculate Natural Decay (Negative Force)
        # This pulls propensity DOWN towards 0.0. 
        # Using multiplication (self.propensity * decay) ensures it scales 
        # (e.g., losing 2% of your current honesty).
        deterioration = self.propensity * decay 

        # 3. Apply changes
        self.propensity = clip01(
            self.propensity + improvement - deterioration
        )

        # Reset flags
        self.audited_last_step = 0

"""
Create synthetic population 
"""
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
        auditing_param: float,
        commun_param: float, 
        decay_factor: float = 0.0,
        seed: int = 42,       
    ):
        super().__init__()
        self.N = N
        self.size_shares = size_shares
        self.age_shares = age_shares
        self.C_target = C_target
        self.m_size = m_size
        self.m_age = m_age
        self.auditing_param = auditing_param
        
        self.commun_base_intensity = commun_param 
        self.current_commun = 0.0
        self.kappa = kappa
        self.rng = np.random.default_rng(seed)
        self.audit_rates = audit_rates
        self.decay_factor = decay_factor
        self.step_count = 0  
        
        # TAX CALENDAR (Weeks)
        self.tax_deadline_week = 12  
        self.audit_delay_weeks = 8  
        
        self.size_order = list(size_shares.keys())
        self.age_order = list(age_shares.keys())

        size_score = {cat: i for i, cat in enumerate(self.size_order)}
        age_score = {cat: i for i, cat in enumerate(self.age_order)}

        size_probs = np.array([float(size_shares[c]) for c in self.size_order], dtype=float)
        age_probs = np.array([float(age_shares[c]) for c in self.age_order], dtype=float)
        size_probs = size_probs / size_probs.sum()
        age_probs = age_probs / age_probs.sum()
        
        E_S = sum(size_probs[i] * size_score[self.size_order[i]] for i in range(len(self.size_order)))   
        E_A = sum(age_probs[i] * age_score[self.age_order[i]] for i in range(len(self.age_order)))       

        mu_table = {}
        for s in self.size_order:
            for a in self.age_order:
                S_tilde = size_score[s] - E_S  
                A_tilde = age_score[a] - E_A   
                mu = C_target + m_size * S_tilde + m_age * A_tilde 
                mu_table[(s, a)] = clip01(mu) 

        self.mu_table = mu_table 

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
        
        model_reporters = {}
        for s in self.size_order:
            for a in self.age_order:
                # We use partial to "freeze" the s and a values for each function
                label = f"{s} - {a}"
                model_reporters[label] = lambda m, s=s, a=a: compute_group_mean(m, s, a)
        model_reporters["Mean Propensity"] = lambda m: np.mean([a.propensity for a in m.agents])
        model_reporters["% Audited"] = get_audit_percent
        self.datacollector = DataCollector(
            model_reporters=model_reporters
        )
        self.total_audited_this_step = 0.0

    def auditing_strategy(self):
      total_audits_count = 0
      current_week_of_year = self.step_count % 52
      audit_week = self.tax_deadline_week + self.audit_delay_weeks
      is_audit_campaign = (current_week_of_year == audit_week)  
      
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
            current_rate = base_rate * 12 
        else:
            current_rate = 0.0
        
        target_audits = int(round(current_rate * n_total))
        
        # 3 Years in weeks = 156 Steps (assuming 1 step = 1 week)
        # We only select agents whose last audit was MORE than 156 steps ago.
        COOLDOWN_PERIOD = 156 
        
        eligible_agents = [
            ag for ag in members 
            if (self.step_count - ag.last_audit_step) >= COOLDOWN_PERIOD
        ]

        n_actual = min(len(eligible_agents), target_audits)
        
        if n_actual > 0:
            idx_aud = self.rng.choice(len(eligible_agents), size=n_actual, replace=False)
            
            for i in idx_aud:
                target_agent = eligible_agents[i]
                target_agent.audited_last_step = 1     # For propensity update
                target_agent.last_audit_step = self.step_count # Mark the time of audit
            total_audits_count += n_actual
            
    # Calculate % audited
      self.total_audited_this_step = total_audits_count / self.N 
        
        
    def step(self):
      # A rolling window in auditing_strategy handles audit eligibility.
      current_week = self.step_count % 52
      
      # 1. Define Critical Weeks
      week_early = self.tax_deadline_week - 4  # Week 8
      week_mid   = self.tax_deadline_week - 2  # Week 10
      week_late  = self.tax_deadline_week - 1  # Week 11
      
      # 2. Assign Variable Intensity
      if current_week == week_early:
          # Gentle Nudge (50% strength)
          self.current_commun = self.commun_base_intensity * 0.5
      elif current_week == week_mid:
          # Standard Reminder (100% strength)
          self.current_commun = self.commun_base_intensity * 1.0
      elif current_week == week_late:
          # Urgent Warning (200% strength)
          self.current_commun = self.commun_base_intensity * 2.0
      else:
          # No communication
          self.current_commun = 0.0
      
      self.auditing_strategy()          
      self.agents.shuffle_do("step") 
      self.datacollector.collect(self)
      self.step_count += 1


def report_tax_gap(model, step_label):
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
      
      
if __name__ == "__main__":

    N = 10_000 
    size_shares = {"Micro": 0.9683, "Small": 0.0248, "Medium": 0.0053}
    age_shares = {"Young": 0.57, "Mature": 0.04, "Old": 0.39}
    #C_target = 0.693
    C_target = 0.924 # alternative
    
    audit_rates = { 
       ("Micro", "Young"): 0.0046, ("Micro", "Mature"): 0.0046, ("Micro", "Old"): 0.0046,
       ("Small", "Young"): 0.0046, ("Small", "Mature"): 0.0046, ("Small", "Old"): 0.0046,
       ("Medium", "Young"): 0.0046,("Medium", "Mature"): 0.0046,("Medium", "Old"): 0.0046,
   }

    model = SMEComplianceModel(
       N=N,
       size_shares=size_shares,
       age_shares=age_shares,
       C_target=C_target,
       m_size=0.05,
       m_age=0.05,
       kappa=339,
       audit_rates=audit_rates,
       auditing_param=0.9,
       commun_param=0.008,
       decay_factor=0.00005,
       seed=42,
   )

    print("Total number of agents:", len(model.agents))

    # 1. CAPTURE INITIAL STATE
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
    
    # 2. INITIAL TAX GAP
    initial_gap = report_tax_gap(model, "INITIAL (Step 0)")

    # 3. RUN SIMULATION
    T = 260 # time steps in months
    for _ in range(T):
        model.step()

    # 4. COMPARE FINAL STATE
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
    
    
    df = model.datacollector.get_model_vars_dataframe()
    
    fig, ax1 = plt.subplots(figsize=(10, 6), dpi=300)

    # Plot Propensity on left axis
    color = 'tab:blue'
    ax1.set_xlabel('Time (Weeks)')
    ax1.set_ylabel('Mean Propensity', color=color, fontsize=12)
    ax1.set_ylim(0.8, 1.0) # Feel free to adjust 
    for col in sorted(df.columns):
        if " - " in col:  # This selects "Micro - Young", "Small - Old", etc.
            ax1.plot(df.index, df[col], label=col, linewidth=1.5, alpha=0.8)
    
    # Add the Global Mean as a thicker, distinct line (optional, for reference)
    ax1.plot(df.index, df["Mean Propensity"], color='black', linewidth=2.5, linestyle=':', label="Global Mean")
    
    # Plot Audit % on right axis 
    ax2 = ax1.twinx()  
    color = 'tab:red'
    ax2.set_ylabel('% Audited / Communication Intensity', color=color, fontsize=12)
    ax2.plot(df.index, df["% Audited"], color=color, linestyle='--', linewidth=2, label="% Audited")
    ax2.tick_params(axis='y', labelcolor=color)
    ax2.set_ylim(0, 0.15) # Scale this so spikes don't overlap the blue line too much
    
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    # Place legend outside to the right so it doesn't cover the graph
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left', bbox_to_anchor=(1.1, 1))
    
    plt.title("Compliance Over Time: Nudging Reminders & Pulsed Audit Strategy")
    fig.tight_layout()
    plt.grid(True, linestyle=':', alpha=0.6)
    plt.show()
    
    # 6. SUMMARY
    reduction = initial_gap - final_gap
    print("\n" + "="*40)
    print(f"TAX GAP REDUCTION: {reduction:,.2f}")
    print(f"IMPROVEMENT:       {(reduction/initial_gap)*100:.2f}%")
    print("="*40)