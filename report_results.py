"""
authors: Despoina Delipalla, Marit van den Helder & Marco Maier

Main file to run model and show results.
"""

import matplotlib.pyplot as plt
import numpy as np
from model import SMEAgent, SMEComplianceModel, report_tax_gap
from collections import Counter, defaultdict


# Number of Agents
N = 1000

# Demographics
size_shares = {"Micro": 0.9683, "Small": 0.0248, "Medium": 0.0053}
age_shares = {"Young": 0.57, "Mature": 0.04, "Old": 0.39}

# Compliance Targets (based on the mean of the Jaarreportage)
C_target = 0.693
# C_target = 0.924 # alternative for individuals

# # Audit Rates (Base Weekly Rates)
# audit_rates = {
#     ("Micro", "Young"): 0.0046,
#     ("Micro", "Mature"): 0.0046,
#     ("Micro", "Old"): 0.0046,
#     ("Small", "Young"): 0.0046,
#     ("Small", "Mature"): 0.0046,
#     ("Small", "Old"): 0.0046,
#     ("Medium", "Young"): 0.0046,
#     ("Medium", "Mature"): 0.0046,
#     ("Medium", "Old"): 0.0046,
# }

audit_rates = {
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
channel_effects = {
    "physical_letter": 0.003,  # Lowest effect
    "email": 0.008,  # Slightly higher (standard)
    "warning_letter": 0.020,  # At least double email
}

# Define 3 types of audits with different effects and costs
audit_types = {
    "Light": {"effect": 0.45, "cost": 500.0},  # IH profit return check
    "Standard": {"effect": 0.90, "cost": 775.0},  # corporate income tax return check
    "Deep": {
        "effect": 1.80,
        "cost": 1550.0,
    },  # book audit High cost for detailed audit 1 FTE hr = EUR20.11 --> 78hr per book audit (2024) --> EUR1,569 per audit
}


# Define Costs (in EUR)
intervention_costs = {
    "email": 0.05,  # Minimal system cost
    "physical_letter": 0.85,  # Print + Postage
    "warning_letter": 20.96,  # Letter + ~1hr FTE for hand delivery
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
T = 260  # time steps in weeks
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

print("\n" + "=" * 40)
print(f"Tax Gap Reduction:   € {reduction:,.2f}")
print(f"Total Intervention Cost: € {total_cost:,.2f}")
print("-" * 40)
print(f"Improvement:       {(reduction/initial_gap)*100:.2f}%")
print(f"Net Benefit:         € {net_benefit:,.2f}")
print(
    f"ROI Ratio (Return per €1 spent on interventions): € {roi_ratio:.2f}"
)  # ROI per USD spent by IRS: 2 - 12USD
print("=" * 40)


# 4. Visualization
df = model.datacollector.get_model_vars_dataframe()

fig, ax1 = plt.subplots(figsize=(14, 8), dpi=300)

# Plot Propensity on left axis
color = "tab:blue"
ax1.set_xlabel("Time (Weeks)")
ax1.set_ylabel("Mean Compliance Propensity", color=color, fontsize=12)
ax1.set_ylim(0.60, 0.90)  # Feel free to adjust

# Plot individual groups with thinner lines
for col in sorted(df.columns):
    if " - " in col:  # This selects "Micro - Young", "Small - Old", etc.
        # Style based on Advisor status
        if "NoAdvisor" in col:
            linestyle = ":"
            alpha = 0.6
            width = 1.5
        else:
            linestyle = "-"
            alpha = 0.8
            width = 1.5

        ax1.plot(
            df.index,
            df[col],
            label=col,
            linewidth=width,
            linestyle=linestyle,
            alpha=alpha,
        )

# Add the Global Mean as a thicker, distinct line
ax1.plot(
    df.index, df["Mean Propensity"], color="black", linewidth=2.5, label="Global Mean"
)

# Plot Audit % on right axis
ax2 = ax1.twinx()
color_audit = "tab:red"
ax2.set_ylabel("% Population Audited", color=color, fontsize=12)
# ax2.plot(df.index, df["% Audited"], color=color, linestyle='--', linewidth=2, label="% Audited")
ax2.fill_between(
    df.index, df["% Audited"], color=color_audit, alpha=0.3, label="% Audited"
)
ax2.tick_params(axis="y", labelcolor=color)
ax2.set_ylim(0, 0.15)  # Scale this so spikes don't overlap the blue line too much

# Combined Legend
lines1, labels1 = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
# Place legend outside to the right so it doesn't cover the graph
ax1.legend(
    lines1 + lines2, labels1 + labels2, loc="upper left", bbox_to_anchor=(1.1, 1)
)

plt.title(
    "SME Tax Compliance: 5-Year Simulation\nStrategy: Pulsed Audits + Behavioral Nudges"
)
fig.tight_layout()
plt.grid(True, linestyle=":", alpha=0.6)
# plt.show()
