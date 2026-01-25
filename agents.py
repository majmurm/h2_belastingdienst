# -*- coding: utf-8 -*-
"""
authors: Despoina Delipalla, Marit van den Helder & Marco Maier

Supporting file for model.py, containing the definition functions of agents. It
also contains the steps taken on an agent level in the model, such as updating
the compliance propensity.
"""

# Imports
import mesa
from mesa import Agent


def clip01(x: float) -> float:
    """
    Make sure the compliance propensity is always between 0 and 1.
    """
    return float(max(0.0, min(1.0, x)))


class SMEAgent(Agent):
    def __init__(
        self,
        model,
        size_cat: str,
        age_cat: str,
        propensity: float,
        turnover: float,
        tax_rate: float,
        has_advisor,
        cell,
    ):
        """
        Represents a single SME taxpayer.

        Attributes:
            propensity (float): The likelihood of the agent paying full tax (0.0 to 1.0).
            turnover (float): The revenue of the company.
            tax_rate (float): The applicable tax rate.
            last_audit_step (int): The simulation step when the agent was last audited.
            has_advisor
            cell
        """
        super().__init__(model)
        self.size_cat = size_cat
        self.age_cat = age_cat
        self.propensity = propensity
        self.turnover = turnover
        self.tax_rate = tax_rate
        self.has_advisor = has_advisor

        # Auditing flags
        self.audit_impact = 0.0  # Stores the effect size of the specific audit received

        # Instead of a yearly flag, we track the specific step of the last audit.
        # Initialize to -999 so they are eligible immediately (since step_count starts at 0).
        self.last_audit_step = -999

        cell.add_agent(self)

        self.cell = cell

    def communicate(self):
        """
        Make agents communicate with each other, influencing their propensity.

        A value of 0 means there is no influence from inter communication. A value larger
        than 0 influences propensity positively, a value less than 0 influences the
        propensity negatively.

        Agents communicate in the following situations:
        1. After an agent is audited, they will communicate this to their neighbours.
        2. After being communicated to by the belastingdienst.
        3. Close to the tax deadline.
        4. Randomly
        """

        for neighbor in self.cell.neighborhood:
            pass
        return 0

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

        # Global Communication (General Nudges)
        global_comm = self.model.current_commun

        # Targeted Communication (Sector-specific Company Visit)
        # Check if this agent's sector (Size/Age) is flagged for a warning visit
        targeted_comm = self.model.sector_warnings.get(
            (self.size_cat, self.age_cat), 0.0
        )

        # Communication between agents
        inter_comm = self.communicate()

        # Total communication intensity
        d = global_comm + targeted_comm + inter_comm

        base_decay = self.model.decay_factor

        # 2. Advisor Impact Logic (The Differentiation)
        # If they have an advisor, they maintain compliance better (lower decay, slight correction).
        # If they don't, they drift faster (higher decay).
        if self.has_advisor:
            decay = base_decay * 0.95  # Advisors catch errors, reducing natural decay
            # advisor_correction = 0.00005 # Slight weekly improvement due to professional guidance
        else:
            decay = base_decay * 1.05  # Without help, errors accumulate faster
            # advisor_correction = -0.00005 # Slight weekly drag due to lack of knowledge

        # Positive Force: Pulls propensity towards 1.0.
        # Logic: The gap to perfection (1 - propensity) is closed by the intervention intensity.
        # Diminishing returns: As propensity gets higher, it's harder to improve further.
        improvement = (1 - self.propensity) * (audit_effect + d)
        # improvement = (1 - self.propensity) * ((b * a_t) + d)

        # 2. Calculate Natural Decay (Negative Force)
        # This pulls propensity DOWN towards 0.0.
        # Using multiplication (self.propensity * decay) ensures it scales
        # (e.g., losing 2% of your current honesty).
        deterioration = self.propensity * decay

        # 3. Apply changes
        self.propensity = clip01(
            self.propensity + improvement - deterioration  # + advisor_correction
        )

        if self.model.is_high_urgency_week:
            # Increase sensitivity by 5% (cumulative)
            self.comm_sensitivity *= 1.05
            # Cap sensitivity to prevent runaway values (max 2.0)
            self.comm_sensitivity = min(self.comm_sensitivity, 2.0)

        # 4. Reset Temporary Flags
        # The audit impact is instantaneous (one-shot), so we reset it after processing.
        self.audited_last_step = 0
