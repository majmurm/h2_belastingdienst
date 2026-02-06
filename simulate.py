"""
Authors: Marit van den Helder & Marco Maier

Perform multiple simulations with different random seeds and different configurations to test
the consistency of the model output produced.
"""

from model import SMEComplianceModel
import pandas as pd
from tqdm import tqdm
from collections import defaultdict


# Demographics
size_shares_default = {"Micro": 0.9683, "Small": 0.0248, "Medium": 0.0053}
age_shares_default = {"Young": 0.377, "Mature": 0.241, "Old": 0.382}

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
    "Light": {"effect": 0.45, "cost": 2340.0},  # IH profit return check
    "Standard": {"effect": 0.45, "cost": 2340.0},  # corporate income tax return check
    "Deep": {
        "effect": 0.9,
        "cost": 4680.0,
    },  # book audit High cost for detailed audit 1 FTE hr = EUR20.11 --> 78hr per book audit (2024) --> EUR1,569 per audit
}

# Define Costs (in EUR)
intervention_costs_default = {
    "email": 0.39,  # Minimal system cost
    "physical_letter": 0.65,  # Print + Postage
    "warning_letter": 196.84,  # Letter + ~1hr FTE for hand delivery
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

# communication_schedule_default = {week: ["physical_letter"] for week in range(52)}


def report_tax_gap(model):
    """
    Calculates the difference between Potential and Actual Tax Revenue.
    """

    total_potential = 0.0
    total_actual = 0.0
    gap_by_size = defaultdict(lambda: {"potential": 0.0, "actual": 0.0})

    for a in model.agents:
        potential = a.turnover * a.tax_rate
        # Expected (on-time) payment under the incidence–intensity mapping
        unpaid = model.expected_unpaid_tax(a)
        actual = potential - unpaid

        total_potential += potential
        total_actual += actual

        gap_by_size[a.size_cat]["potential"] += potential
        gap_by_size[a.size_cat]["actual"] += actual

    return total_potential - total_actual


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
        decay_factor=0.0005,
        seed=seed_sim,
    )

    initial_gap = report_tax_gap(model)

    # Run Simulation
    for _ in range(T_sim):
        model.step()

    final_gap = report_tax_gap(model)

    agents_output = {
        "seed": [],
        "size": [],
        "age": [],
        "tax_advisor": [],
        "start": [],
        "final": [],
        "change": [],
    }

    for a in model.agents:
        agents_output["seed"].append(seed_sim)
        agents_output["size"].append(a.size_cat)
        agents_output["age"].append(a.age_cat)
        agents_output["tax_advisor"].append(a.has_advisor)
        agents_output["start"].append(a.initial_propensity)
        agents_output["final"].append(a.propensity)
        agents_output["change"].append(a.propensity - a.initial_propensity)

    # SUMMARY & ROI CALCULATION
    reduction = initial_gap - final_gap
    total_cost = model.total_compliance_costs
    net_benefit = reduction - total_cost
    roi_ratio = reduction / total_cost

    roi_output = f"{reduction},{total_cost},{net_benefit},{roi_ratio}\n"

    return agents_output, roi_output


def run_multiple(n_simulations, population_size, timesteps):

    # Empty the file or create it and write the header line to it
    with open(
        f"{population_size}_agents_{n_simulations}_{timesteps}_agents.csv", "w"
    ) as data_file:
        data_file.write("seed,size,age,tax_advisor,start,final,change\n")

    with open(
        f"{population_size}_agents_{n_simulations}_{timesteps}_roi.csv", "w"
    ) as data_file:
        data_file.write("seed,reduction,total_cost,net_benefit,roi\n")

    # Run simulations with a progress bar
    for seed in tqdm(range(n_simulations)):

        agent_output, roi_output = run_simulation(population_size, seed, timesteps)

        agent_result = pd.DataFrame.from_dict(agent_output)

        agent_result.to_csv(
            f"{population_size}_agents_{n_simulations}_{timesteps}_agents.csv",
            header=False,
            index=False,
            mode="a",
        )

        with open(
            f"{population_size}_agents_{n_simulations}_{timesteps}_roi.csv", "a"
        ) as data_file:
            data_file.write(f"{seed},{roi_output}")


if __name__ == "__main__":
    run_multiple(n_simulations=50, population_size=10000, timesteps=260)
