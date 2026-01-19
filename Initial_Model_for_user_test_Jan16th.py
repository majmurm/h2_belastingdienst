# -*- coding: utf-8 -*-
"""
Created on Thu Jan 15 15:40:20 2026

@author: marco
"""

# Imports
#!pip install mesa
import mesa
from mesa import Agent, Model
import numpy as np


"""
Help function to clip values between 0 and 1
"""
def clip01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))

"""
Create Agent
Each agent has:
a size category (micro, small, medium)
an age category (young, mature, old)
an initial propensity rate
a flag indicating whether the agent is audited or not
a step function that updates the agent's propensity rate and the audited flag based on the auditing strategy
"""
class SMEAgent(Agent):
    def __init__(self,model, size_cat: str, age_cat: str, propensity: float):
        super().__init__( model)
        self.size_cat = size_cat
        self.age_cat = age_cat
        self.propensity = propensity
        self.audited_last_step = 0
        self.audited_this_step = 0 # default is that agent is not audited


    def step(self):
        a_t = self.audited_last_step  # audited_this_step is defined in def auditing_strategy

        # Option A (same for all agents): take b and d from the model
        b = self.model.auditing_param
        d = self.model.commun_param

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
        N: int,               # number of agents
        size_shares: dict,    # proportion of agents in each size category
        age_shares: dict,     # proportion of agents in each age category
        C_target: float,      # average compliance propensity in the population
        m_size: float, # size weight
        m_age: float,  # age weight
        kappa: float,  # Beta distribution parameter
        audit_rates: dict,    # Proportion of agents audited per age-size group
        auditing_param: float,# How strongly does auditing affect compliance
        commun_param: float,  # How strongly does communication strategy affect compliance
        seed: int = 42,       # Random seed for pseudo-random number generator
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

        # List size and age categories and assign scores. A higher score indicates greater compliance propensity
        self.size_order = list(size_shares.keys())
        self.age_order = list(age_shares.keys())

        # Assign increasing numbers to each category (0,1,2)
        size_score = {cat: i for i, cat in enumerate(self.size_order)}
        age_score = {cat: i for i, cat in enumerate(self.age_order)}

        #Compute population-average scores. These scores indicate the "average" SME

        # Proportion of each size category and each age category
        size_probs = np.array([float(size_shares[c]) for c in self.size_order], dtype=float)
        age_probs = np.array([float(age_shares[c]) for c in self.age_order], dtype=float)
        # Normalize so sum is 1
        size_probs = size_probs / size_probs.sum()
        age_probs = age_probs / age_probs.sum()
        # Population average scores
        E_S = sum(size_probs[i] * size_score[self.size_order[i]] for i in range(len(self.size_order)))   # Average size category
        E_A = sum(age_probs[i] * age_score[self.age_order[i]] for i in range(len(self.age_order)))       # Average age category

        # Build group mean propensities mu(s,a)
        mu_table = {}
        for s in self.size_order:
            for a in self.age_order:
                S_tilde = size_score[s] - E_S  # Difference between size category and average size category
                A_tilde = age_score[a] - E_A   # Difference between age category and average age category
                mu = C_target + m_size * S_tilde + m_age * A_tilde  # Size - Age group propensity
                mu_table[(s, a)] = clip01(mu)  # clip propensity between 0 and 1

        self.mu_table = mu_table  # store for inspection

        # Create agents by sampling size and age
        for i in range(N):
            s = self.rng.choice(self.size_order, p=size_probs)
            a = self.rng.choice(self.age_order, p=age_probs)

            mu = mu_table[(s, a)]

            # Draw individual initial propensity around the group mean using Beta
            if mu <= 0.0:
              propensity = 0.0
            elif mu >= 1.0:
              propensity = 1.0
            else:
                alpha = self.kappa * mu
                beta = self.kappa * (1.0 - mu)
                propensity = float(self.rng.beta(alpha, beta)) # Agent's initial propensity


            SMEAgent(self, size_cat=s, age_cat=a, propensity=propensity)

    """
    Create auditing strategy
    The user defines the proportion of agents audited in each size,age group
    Flag is set to 1 if agent is audited, 0 otherwise
    """
    def auditing_strategy(self):
      # Reset audited flag
      self.agents.do(lambda ag: setattr(ag, "audited_this_step", 0))

      # Group agents
      groups = {}
      for ag in self.agents:
        key = (ag.size_cat, ag.age_cat)
        groups.setdefault(key, []).append(ag)

      for key, members in groups.items():
        n = len(members)
        # get auditing rate per group
        rate = float(self.audit_rates.get(key, 0.0))
        # convert rates to number of agents audited
        no_aud_agnt = int(round(rate * n))
        # Randomly choose audited agents per group
        idx_aud = self.rng.choice(n,size=no_aud_agnt, replace = False)

        # Update audited_this_step flag for audited agents
        for i in idx_aud:
          members[i].audited_this_step = 1


    """
    One step of the model.
    """
    def step(self):
      self.auditing_strategy()          # Auditing strategy is applied
      self.agents.shuffle_do("step")    # Update agents
      
      
from collections import Counter, defaultdict


if __name__ == "__main__":

    N = 100000
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

    group_counts = Counter((a.size_cat, a.age_cat) for a in model.agents)

    print("\nInitial mean propensity per group:")
    prop_by_group = defaultdict(list)
    for a in model.agents:
        prop_by_group[(a.size_cat, a.age_cat)].append(a.propensity)

    for (size, age), vals in sorted(prop_by_group.items()):
        print(f"{size:7s} | {age:7s} | {np.mean(vals):.4f}")

    print("\nInitial mean propensity (total):",
          np.mean([a.propensity for a in model.agents]))

    
    T = 50
    for _ in range(T):
        model.step()


    print(f"\nMean propensity per group after {T} steps:")
    prop_by_group.clear()

    for a in model.agents:
        prop_by_group[(a.size_cat, a.age_cat)].append(a.propensity)

    for (size, age), vals in sorted(prop_by_group.items()):
        print(f"{size:7s} | {age:7s} | {np.mean(vals):.4f}")

    print("\nFinal mean propensity (total):",
          np.mean([a.propensity for a in model.agents]))


    audited_counts = Counter(
        (a.size_cat, a.age_cat)
        for a in model.agents
        if a.audited_this_step == 1
    )

    print("\nAudited agents per group (last step):")
    for (size, age), n in sorted(audited_counts.items()):
        print(f"{size:7s} | {age:7s} | {n}")
