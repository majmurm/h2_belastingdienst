export function InformationPanel() {
  return (
    <div className="p-12 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-slate-900 mb-3">Information about the Model</h2>
        <p className="text-slate-600">
          Understanding the SME tax compliance simulation, interventions, and calendar.
        </p>
      </div>

      <div className="space-y-8">
        {/* Section 1 */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-4">
            1. What is Agent-Based Modelling (ABM)?
          </h3>
          <p className="text-slate-700 leading-relaxed">
            Agent-Based Modelling is a simulation technique that focuses on the behavior of individual actors, referred to as agents, rather than just looking at population averages. In this dashboard, agents represent SMEs with size and age characteristics that influence compliance.
          </p>
        </div>

        {/* Section 2 */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-4">
            2. How does the population get initialized?
          </h3>
          <p className="text-slate-700 leading-relaxed">
            Size and age categories are assigned to agents randomly, so their distributions match
            the corresponding contributions in the real population. Each agent receives a baseline
            compliance propensity (the probability that an agent is compliant) drawn from a beta
            distribution. The target mean is controlled by the average compliance rate, C0, which
            is equal to the average compliance rate of SMEs as reported by the Tax Authority.
            The size and age gradients (m_size, m_age) shift the mean by category, while kappa
            controls dispersion.
          </p>
          <p className="text-slate-700 leading-relaxed mt-3">
            Beta distribution parameter kappa controls how concentrated or dispersed values are
            around the mean. Larger values of kappa lead to compliance propensity values closer to
            the category average, while smaller values increase within-category heterogeneity.
          </p>
        </div>

        {/* Section 3 */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-4">
            3. Advanced model parameters (defaults)
          </h3>
          <p className="text-slate-700 leading-relaxed">
            The model uses literature-based defaults for the advanced parameters:
            C0 (average compliance rate) = 0.693, m_size = 0.05, m_age = 0.05,
            kappa = 339, decay factor d = 0.00005, seed = 42.
          </p>
          <p className="text-slate-700 leading-relaxed mt-3">
            Kappa is approximated from a desired within-category standard deviation (SD = 0.025)
            using: κ ≈ µ(1−µ) / SD² − 1.
          </p>
        </div>

        {/* Section 3 */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-4">
            4. What drives behavior over time?
          </h3>
          <p className="text-slate-700 leading-relaxed">
            At every step of the simulation, a number of agents are audited, after which each
            agent’s compliance propensity is updated based on the decision function. Compliance can
            also increase from communications or decay naturally. The decaying factor d reflects how
            strongly compliance decays in the absence of interaction with the Tax Authority.
            Audits occur during a yearly campaign week and can be Light, Standard, or Deep with
            different effects and costs. Communications include physical letters, emails, and
            targeted warning letters, each with distinct effects and costs.
          </p>
        </div>

        {/* Section 4 */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-4">
            5. What do the outputs mean?
          </h3>
          <p className="text-slate-700 leading-relaxed">
            Results report mean compliance propensities by size and age group, audit coverage per step, tax gap (potential vs actual collections), total intervention costs, and ROI. These metrics help compare enforcement strategies and identify high-impact segments.
          </p>
        </div>
      </div>
    </div>
  );
}
