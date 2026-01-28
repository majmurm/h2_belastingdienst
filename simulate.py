"""
Authors: Marit van den Helder & Marco Maier

Perform multiple simulations with different random seeds and different configurations to test
the consistency of the model output produced.
"""

from model import SMEComplianceModel
import pandas as pd
from tqdm import tqdm
import os

# Demographics
size_shares_default = {"Micro": 0.9683, "Small": 0.0248, "Medium": 0.0053}
age_shares_default = {"Young": 0.57, "Mature": 0.04, "Old": 0.39}

# Compliance Targets (based on the mean of the Jaarreportage)
C_target_default = 0.693

audit_rates_default = {
    ("Micro", "Young"): 0.02,
    ("Micro", "Mature"): 0.02,
    ("Micro", "Old"): 0.02,
    ("Small", "Young"): 0.02,
    ("Small", "Mature"): 0.02,
    ("Small", "Old"): 0.02,
    ("Medium", "Young"): 0.02,
    ("Medium", "Mature"): 0.02,
    ("Medium", "Old"): 0.02,
}

# Distinct effects for different channels
# Original 'commun_param' was 0.008. We scale around that.
channel_effects_default = {
    "physical_letter": 0.003,  # Lowest effect
    "email": 0.008,  # Slightly higher (standard)
    "warning_letter": 0.020,  # At least double email
}

# Define 3 types of audits with different effects and costs
audit_types_default = {
    "Light": {"effect": 0.45, "cost": 500.0},  # IH profit return check
    "Standard": {"effect": 0.90, "cost": 775.0},  # corporate income tax return check
    "Deep": {
        "effect": 1.80,
        "cost": 1570.0,
    },  # book audit High cost for detailed audit 1 FTE hr = EUR20.11 --> 78hr per book audit (2024) --> EUR1,569 per audit
}

# Define Costs (in EUR)
intervention_costs_default = {
    "email": 0.05,  # Minimal system cost
    "physical_letter": 0.85,  # Print + Postage
    "warning_letter": 20.96,  # Letter + ~1hr FTE for hand delivery
}

# Communication schedule
communication_schedule_default = {
    8: ["physical_letter", "email"],
    6: ["email"],
    2: ["physical_letter"],
    1: [
        "email"
    ],  # Automatically becomes urgent (2x effect), because it is one week before the deadline
}

def run_simulation(
    N,
    seed_sim,
    T_sim,
    size_shares_sim=size_shares_default,
    age_shares_sim=age_shares_default,
    C_target_sim=C_target_default,
    audit_rates_sim=audit_rates_default,
    audit_types_sim=audit_types_default,
    channel_effects_sim=channel_effects_default,
    intervention_costs_sim=intervention_costs_default,
    communication_schedule_sim=communication_schedule_default,
):

    # Initialize model
    model = SMEComplianceModel(
        N=N,
        size_shares=size_shares_sim,
        age_shares=age_shares_sim,
        C_target=C_target_sim,
        m_size=0.05,
        m_age=0.05,
        kappa=339,
        audit_rates=audit_rates_sim,
        audit_types=audit_types_sim,
        channel_effects=channel_effects_sim,
        intervention_costs=intervention_costs_sim,
        communication_schedule=communication_schedule_sim,
        decay_factor=0.00005,
        seed=seed_sim,
    )

    # Run Simulation
    for _ in range(T_sim):
        model.step()

    output = {
        "seed": [],
        "size": [],
        "age": [],
        "tax_advisor": [],
        "start": [],
        "final": [],
        "change": [],
    }

    for a in model.agents:
        output["seed"].append(seed_sim)
        output["size"].append(a.size_cat)
        output["age"].append(a.age_cat)
        output["tax_advisor"].append(a.has_advisor)
        output["start"].append(a.initial_propensity)
        output["final"].append(a.propensity)
        output["change"].append(a.propensity - a.initial_propensity)

    return output


def run_multiple(
    n_simulations, population_size=100, timesteps=260, filename="simulations.csv"
):
    outputs = {
        "seed": [],
        "size": [],
        "age": [],
        "tax_advisor": [],
        "start": [],
        "final": [],
        "change": [],
    }

    # Empty a simulation file with the same name if it exists
    try:
        os.remove(filename)
    except OSError:
        pass

    # Run simulations with a progress bar
    for seed in tqdm(range(n_simulations)):

        output = run_simulation(population_size, seed, timesteps)

        # Store simulation results in dict
        for column, values in outputs.items():
            values += output[column]

        result = pd.DataFrame.from_dict(outputs)

        result.to_csv(filename, index=False, mode="a")


if __name__ == "__main__":
    run_multiple(n_simulations=5, population_size=1000)
