# -*- coding: utf-8 -*-
"""
Created on Mon Jan 19 11:26:57 2026

@author: marco
"""

# Imports
import mesa
from mesa import Agent, Model
import numpy as np
from collections import Counter, defaultdict
from scipy.optimize import minimize_scalar

def clip01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))

def solve_allingham_sandmo(y, p, t, phi, alpha):
    """
    Calculates the optimal propensity (x/y) for a strategic agent
    using the Allingham-Sandmo static evasion model.
    """
    if p <= 0.0:
        return 0.0
    
    def negative_expected_utility(x):
        w_na = y - (t * x)
        w_a = y - (t * y) - (phi * (y - x))
        
        if w_na <= 1e-9 or w_a <= 1e-9:
            return np.inf 

        if abs(alpha - 1.0) < 1e-6:
            u_na = np.log(w_na)
            u_a = np.log(w_a)
        elif abs(alpha - 0.0) < 1e-6:
            u_na = w_na
            u_a = w_a
        else:
            u_na = (w_na ** (1 - alpha)) / (1 - alpha)
            u_a = (w_a ** (1 - alpha)) / (1 - alpha)
            
        eu = (1 - p) * u_na + p * u_a
        return -eu

    res = minimize_scalar(
        negative_expected_utility, 
        bounds=(0, y), 
        method='bounded'
    )
    
    if res.success:
        return float(res.x / y)
    else:
        return 1.0

"""
Create Agent
"""
class SMEAgent(Agent):
    def __init__(self, model, agent_type, risk_aversion, size_cat: str, age_cat: str, propensity: float, turnover: float, tax_rate: float):
        super().__init__(model)
        self.agent_type = agent_type 
        self.risk_aversion = risk_aversion
        self.size_cat = size_cat
        self.age_cat = age_cat
        self.propensity = propensity
        self.turnover = turnover    
        self.tax_rate = tax_rate    
        
        self.audited_last_step = 0
        self.last_audit_step = -999 

    def step(self):
        if self.agent_type == "Strategic":
            self.update_strategic_propensity()
            return 

        a_t = self.audited_last_step  
        b = self.model.auditing_param
        d = self.model.commun_param
        decay = self.model.decay_factor 

        improvement = (1 - self.propensity) * ((b * a_t) + d)
        deterioration = self.propensity * decay 

        self.propensity = clip01(
            self.propensity + improvement - deterioration
        )
        self.audited_last_step = 0
        
    def update_strategic_propensity(self):
        key = (self.size_cat, self.age_cat)
        p = self.model.audit_rates.get(key, 0.0)
        phi = 0.5 
    
        optimal_propensity = solve_allingham_sandmo(
            y=self.turnover,
            p=p,
            t=self.tax_rate,
            phi=phi,
            alpha=self.risk_aversion 
        )
        self.propensity = optimal_propensity

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
        self.commun_param = commun_param
        self.kappa = kappa
        self.rng = np.random.default_rng(seed)
        self.audit_rates = audit_rates
        self.decay_factor = decay_factor
        self.step_count = 0  
        
        self.size_order = list(size_shares.keys())
        self.age_order = list(age_shares.keys())

        # Setup mu_table logic
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

        # Temporary storage for Mu-Table Initialization State
        temp_base_propensities = defaultdict(list)

        # --- AGENT GENERATION ---
        for i in range(N):
            # A. Generate Demographics
            s = self.rng.choice(self.size_order, p=size_probs)
            a = self.rng.choice(self.age_order, p=age_probs)
            
            if s == "Micro":
                turnover = self.rng.uniform(10_000, 2_000_000)
            elif s == "Small":
                turnover = self.rng.uniform(2_000_000, 10_000_000)
            else: 
                turnover = self.rng.uniform(10_000_000, 50_000_000)
            
            tax_rate = self.rng.uniform(0.15, 0.25)

            # B. INITIALIZE PROPENSITY via MU_TABLE
            # This is the "Base" state before behavior logic
            mu = mu_table[(s, a)]
            if mu <= 0.0:
                base_propensity = 0.0
            elif mu >= 1.0:
                base_propensity = 1.0
            else:
                alpha_beta = self.kappa * mu
                beta_beta = self.kappa * (1.0 - mu)
                base_propensity = float(self.rng.beta(alpha_beta, beta_beta))
            
            # Store for printing 
            temp_base_propensities[(s, a)].append(base_propensity)

            # C. SEGMENTATION (Behavior Initialization)
            if self.rng.random() < 0.975:
                agent_type = "Honest"
                risk_aversion = 0.0 
                
                # Honest Sub-split: 72.5% Perfect, 27.5% Clumsy
                if self.rng.random() < 0.725:
                    final_propensity = 1.0 
                else:
                    final_propensity = base_propensity
            else:
                agent_type = "Strategic"
                risk_aversion = self.rng.uniform(0.0, 3.0)
                final_propensity = base_propensity

            # Create Agent
            new_agent = SMEAgent(
                self, 
                agent_type=agent_type, 
                risk_aversion=risk_aversion, 
                size_cat=s, 
                age_cat=a, 
                propensity=final_propensity, 
                turnover=turnover, 
                tax_rate=tax_rate
            )
            
            # D. Initial Calculation for Strategic Agents
            if agent_type == "Strategic":
                new_agent.update_strategic_propensity()

        # --- REQ #1: PRINT MU TABLE INITIALIZATION ---
        print("\n" + "="*60)
        print("1. MEAN PROPENSITY AFTER MU_TABLE INITIALIZATION")
        print("   (Before Strategic/Honest behavior is applied)")
        print("="*60)
        print(f"{'Size':<10} | {'Age':<10} | {'Mean Propensity':<15}")
        print("-" * 45)
        for (s, a), props in sorted(temp_base_propensities.items()):
            print(f"{s:<10} | {a:<10} | {np.mean(props):.4f}")


    def auditing_strategy(self):
      groups = {}
      for ag in self.agents:
        key = (ag.size_cat, ag.age_cat)
        groups.setdefault(key, []).append(ag)

      for key, members in groups.items():
        n_total = len(members)
        rate = float(self.audit_rates.get(key, 0.0))
        target_audits = int(round(rate * n_total))
        
        COOLDOWN_PERIOD = 36 
        
        eligible_agents = [
            ag for ag in members 
            if (self.step_count - ag.last_audit_step) >= COOLDOWN_PERIOD
        ]

        n_actual = min(len(eligible_agents), target_audits)
        
        if n_actual > 0:
            idx_aud = self.rng.choice(len(eligible_agents), size=n_actual, replace=False)
            
            for i in idx_aud:
                target_agent = eligible_agents[i]
                target_agent.audited_last_step = 1     
                target_agent.last_audit_step = self.step_count 

    def step(self):
      self.auditing_strategy()          
      self.agents.shuffle_do("step")    
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
    C_target = 0.924 
    
    audit_rates = { 
       ("Micro", "Young"): 0.0046, 
       ("Micro", "Mature"): 0.0046,
       ("Micro", "Old"): 0.0046,
       ("Small", "Young"): 0.0046,
       ("Small", "Mature"): 0.0046,
       ("Small", "Old"): 0.0046,
       ("Medium", "Young"): 0.0046,
       ("Medium", "Mature"): 0.0046,
       ("Medium", "Old"): 0.0046,
   }

    model = SMEComplianceModel(
       N=N,
       size_shares=size_shares,
       age_shares=age_shares,
       C_target=C_target,
       m_size=0.1,
       m_age=0.1,
       kappa=50,
       audit_rates=audit_rates,
       auditing_param=0.9,
       commun_param=0.0025,
       decay_factor=0.0002,
       seed=42,
   )
    
    # -------------------------------------------------------------
    # PRINT STATE AFTER BEHAVIORAL OVERWRITE (Start of Sim)
    # -------------------------------------------------------------
    # We capture this HERE in main to use it for comparison later.
    
    initial_means = {}
    prop_by_group = defaultdict(list)
    
    for a in model.agents:
        prop_by_group[(a.size_cat, a.age_cat)].append(a.propensity)

    print("\n" + "="*60)
    print("2. MEAN PROPENSITY AFTER BEHAVIORAL INITIALIZATION")
    print("   (After Strategic/Honest Overwrites - Step 0)")
    print("="*60)
    print(f"{'Size':<10} | {'Age':<10} | {'Mean Propensity':<15}")
    print("-" * 45)
    
    for (size, age), vals in sorted(prop_by_group.items()):
        mean_val = np.mean(vals)
        initial_means[(size, age)] = mean_val
        print(f"{size:<10} | {age:<10} | {mean_val:.4f}")

    # -------------------------------------------------------------
    # INITIAL TAX GAP (Average Annual Potential Loss)
    # -------------------------------------------------------------
    initial_gap = report_tax_gap(model, "3. INITIAL (Step 0)")

    # -------------------------------------------------------------
    # RUN SIMULATION 
    # -------------------------------------------------------------
    T = 60 
    print(f"\n... Running Simulation for {T} steps ...")
    for _ in range(T):
        model.step()

    # -------------------------------------------------------------
    # FINAL STATE vs BEHAVIORAL INITIALIZATION
    # -------------------------------------------------------------
    prop_by_group.clear()
    for a in model.agents:
        prop_by_group[(a.size_cat, a.age_cat)].append(a.propensity)

    print("\n" + "="*60)
    print(f"4. MEAN PROPENSITY AFTER {T} STEPS vs INITIAL (BEHAVIORAL)")
    print("="*60)
    print(f"{'Size':<10} | {'Age':<10} | {'Final':<10} | {'Change':<10}")
    print("-" * 50)

    for (size, age), vals in sorted(prop_by_group.items()):
        final_mean = np.mean(vals)
        init_mean = initial_means.get((size, age), 0.0)
        change = final_mean - init_mean
        print(f"{size:<10} | {age:<10} | {final_mean:.4f}     | {change:+.4f}")

    final_total_mean = np.mean([a.propensity for a in model.agents])
    
    # -------------------------------------------------------------
    # FINAL TAX GAP (Average Annual Potential Loss)
    # -------------------------------------------------------------
    final_gap = report_tax_gap(model, f"5. FINAL (Step {T})")

    reduction = initial_gap - final_gap
    print("\n" + "="*40)
    print(f"TAX GAP REDUCTION: {reduction:,.2f}")
    print(f"IMPROVEMENT:       {(reduction/initial_gap)*100:.2f}%")
    print("="*40)