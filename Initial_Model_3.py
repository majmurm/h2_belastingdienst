# -*- coding: utf-8 -*-
"""
Created on Mon Jan 19 10:01:20 2026

@author: marco
Updated Model with Turnover and Tax Gap Calculation
"""


# Imports
#!pip install mesa
import mesa
from mesa import Agent, Model
import numpy as np
from collections import Counter, defaultdict

"""
Help function to clip values between 0 and 1
"""
def clip01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))

"""
Create Agent
Each agent now includes:
- turnover: Annual Average Revenue (monetary units)
- tax_rate: Effective tax rate (percentage)
"""
class SMEAgent(Agent):
    def __init__(self, model, size_cat: str, age_cat: str, propensity: float, turnover: float, tax_rate: float):
        super().__init__(model)
        self.size_cat = size_cat
        self.age_cat = age_cat
        self.propensity = propensity
        self.turnover = turnover    #  Static variable for revenue
        self.tax_rate = tax_rate    # Static variable for tax rate
        self.audited_last_step = 0
        self.audited_this_step = 0 

    def step(self):
        a_t = self.audited_last_step  

        # Option A: take b (auditing param) and d (communication param) from the model
        b = self.model.auditing_param
        d = self.model.commun_param

        # Update propensity based on auditing pressure
        self.propensity = clip01(
            self.propensity + ((1 - self.propensity) * ((b * a_t) + d))
        )

        # carry audit info forward for next period
        self.audited_last_step = self.audited_this_step


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
        self.commun_param = commun_param
        self.kappa = kappa
        self.rng = np.random.default_rng(seed)
        self.audit_rates = audit_rates

        self.size_order = list(size_shares.keys())
        self.age_order = list(age_shares.keys())

        size_score = {cat: i for i, cat in enumerate(self.size_order)}
        age_score = {cat: i for i, cat in enumerate(self.age_order)}

        # Population average scores
        size_probs = np.array([float(size_shares[c]) for c in self.size_order], dtype=float)
        age_probs = np.array([float(age_shares[c]) for c in self.age_order], dtype=float)
        size_probs = size_probs / size_probs.sum()
        age_probs = age_probs / age_probs.sum()
        
        E_S = sum(size_probs[i] * size_score[self.size_order[i]] for i in range(len(self.size_order)))   
        E_A = sum(age_probs[i] * age_score[self.age_order[i]] for i in range(len(self.age_order)))       

        # Build group mean propensities mu(s,a)
        mu_table = {}
        for s in self.size_order:
            for a in self.age_order:
                S_tilde = size_score[s] - E_S  
                A_tilde = age_score[a] - E_A   
                mu = C_target + m_size * S_tilde + m_age * A_tilde 
                mu_table[(s, a)] = clip01(mu) 

        self.mu_table = mu_table 

        # Create agents
        for i in range(N):
            s = self.rng.choice(self.size_order, p=size_probs)
            a = self.rng.choice(self.age_order, p=age_probs)

            mu = mu_table[(s, a)]

            # Draw propensity
            if mu <= 0.0:
              propensity = 0.0
            elif mu >= 1.0:
              propensity = 1.0
            else:
                alpha = self.kappa * mu
                beta = self.kappa * (1.0 - mu)
                propensity = float(self.rng.beta(alpha, beta)) 

            # --- NEW: Generate Turnover based on Size Category ---
            # Using typical SME bands (approximate)
            if s == "Micro":
                turnover = self.rng.uniform(10_000, 2_000_000)
            elif s == "Small":
                turnover = self.rng.uniform(2_000_000, 10_000_000)
            else: # Medium
                turnover = self.rng.uniform(10_000_000, 50_000_000)
            
            # --- NEW: Generate Tax Rate ---
            # Random effective tax rate between 15% and 25%
            tax_rate = self.rng.uniform(0.15, 0.25)

            SMEAgent(self, size_cat=s, age_cat=a, propensity=propensity, turnover=turnover, tax_rate=tax_rate)

    def auditing_strategy(self):
      self.agents.do(lambda ag: setattr(ag, "audited_this_step", 0))

      groups = {}
      for ag in self.agents:
        key = (ag.size_cat, ag.age_cat)
        groups.setdefault(key, []).append(ag)

      for key, members in groups.items():
        n = len(members)
        rate = float(self.audit_rates.get(key, 0.0))
        no_aud_agnt = int(round(rate * n))
        idx_aud = self.rng.choice(n,size=no_aud_agnt, replace = False)

        for i in idx_aud:
          members[i].audited_this_step = 1

    def step(self):
      self.auditing_strategy()          
      self.agents.shuffle_do("step")    
      
      
if __name__ == "__main__":

    N = 10_000 
    size_shares = {"Micro": 0.97, "Small": 0.02, "Medium": 0.01}
    age_shares = {"Young": 0.57, "Mature": 0.04, "Old": 0.39}
    C_target = 0.693
    
    audit_rates = { 
        ("Micro", "Young"): 0.1, 
        ("Micro", "Mature"): 0.1,
        ("Micro", "Old"): 0.1,
        ("Small", "Young"): 0.1,
        ("Small", "Mature"): 0.1,
        ("Small", "Old"): 0.1,
        ("Medium", "Young"): 0.1,
        ("Medium", "Mature"): 0.1,
        ("Medium", "Old"): 0.1,
    }

    model = SMEComplianceModel(
        N=N,
        size_shares=size_shares,
        age_shares=age_shares,
        C_target=C_target,
        m_size=0.01,
        m_age=0.01,
        kappa=90,
        audit_rates=audit_rates,
        auditing_param=0.1,
        commun_param=0,
        seed=42,
    )

    print("Total number of agents:", len(model.agents))

    # --- RESTORED: Initial Propensity Reporting ---
    group_counts = Counter((a.size_cat, a.age_cat) for a in model.agents)

    print("\nInitial mean propensity per group:")
    prop_by_group = defaultdict(list)
    for a in model.agents:
        prop_by_group[(a.size_cat, a.age_cat)].append(a.propensity)

    for (size, age), vals in sorted(prop_by_group.items()):
        print(f"{size:7s} | {age:7s} | {np.mean(vals):.4f}")

    print("\nInitial mean propensity (total):",
          np.mean([a.propensity for a in model.agents]))
    # ---------------------------------------------

    # Run Simulation
    T = 60 
    for _ in range(T):
        model.step()

    # --- RESTORED: Final Propensity Reporting ---
    print(f"\nMean propensity per group after {T} steps:")
    prop_by_group.clear()

    for a in model.agents:
        prop_by_group[(a.size_cat, a.age_cat)].append(a.propensity)

    for (size, age), vals in sorted(prop_by_group.items()):
        print(f"{size:7s} | {age:7s} | {np.mean(vals):.4f}")

    print("\nFinal mean propensity (total):",
          np.mean([a.propensity for a in model.agents]))
    # -------------------------------------------

    audited_counts = Counter(
        (a.size_cat, a.age_cat)
        for a in model.agents
        if a.audited_this_step == 1
    )

    print("\nAudited agents per group (last step):")
    for (size, age), n in sorted(audited_counts.items()):
        print(f"{size:7s} | {age:7s} | {n}")


    # --- NEW: Tax Gap Calculation ---
    total_potential_tax = 0.0
    total_actual_tax = 0.0
    gap_by_group = defaultdict(lambda: {"potential": 0.0, "actual": 0.0})

    for a in model.agents:
        potential = a.turnover * a.tax_rate
        actual = potential * a.propensity
        
        total_potential_tax += potential
        total_actual_tax += actual
        
        gap_by_group[a.size_cat]["potential"] += potential
        gap_by_group[a.size_cat]["actual"] += actual

    total_tax_gap = total_potential_tax - total_actual_tax
    
    print("\n--- NEW: Tax Gap Analysis ---")
    print(f"Total Potential Tax Revenue: {total_potential_tax:,.2f}")
    print(f"Total Tax Collected:       {total_actual_tax:,.2f}")
    print(f"TOTAL TAX GAP:             {total_tax_gap:,.2f}")
    print(f"Gap Percentage:            {(total_tax_gap/total_potential_tax)*100:.2f}%")

    print("\nTax Gap by Business Size:")
    print(f"{'Size':<10} | {'Potential Tax':<15} | {'Tax Gap':<15} | {'% Lost':<10}")
    print("-" * 55)
    
    for size in ["Micro", "Small", "Medium"]:
        stats = gap_by_group[size]
        pot = stats["potential"]
        act = stats["actual"]
        gap = pot - act
        pct = (gap / pot) * 100 if pot > 0 else 0
        print(f"{size:<10} | {pot:,.0f}      | {gap:,.0f}      | {pct:.2f}%")