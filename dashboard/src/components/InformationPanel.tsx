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
            Agent-Based Modelling is a simulation technique that focuses on the behavior of individual actors, referred to as agents, rather than just looking at population averages. 
            This allows for the modelling to incorporate interactions between agents, as well as influences from their environment.
            In this dashboard, agents represent SMEs with size and age characteristics that influence compliance.
          
          </p>
        </div>

        {/* Section 2 */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-4">
            2. How does the population get initialized?
          </h3>
          <p className="text-slate-700 leading-relaxed">
            This model only models Small to Medium sized Enterprises (SMEs).
            Size and age categories are assigned to agents randomly, so their distributions match
            the distribution in the real population. Each agent receives a baseline
            compliance propability drawn from a beta distribution. The target mean is controlled by the average compliance rate (C<sub>0</sub>) which
            is equal to the average compliance rate of SMEs as reported by the Tax Authority.
            The size and age gradients (m<sub>size</sub>, m<sub>age</sub>) shift the mean by category, while kappa (&#954;)
            controls dispersion.
            Larger values of kappa lead to compliance propensity values closer to
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
            <ul>
              <li>C<sub>0</sub> = 0.693</li>
              <li>m<sub>size</sub> = 0.05</li>
              <li>m<sub>age</sub> = 0.05</li>
              <li>natural decay factor d = 0.0005</li>
              <li>
                &#954; = 339, based on a desired within-category standard deviation (SD = 0.025) using:&nbsp;
                <span className="font-mono text-slate-800">
                  &#954; &#8776; (&#956;(1−&#956;)/(SD<sup>2</sup>)) − 1
                </span>
              </li>
            </ul>
            </p>
        </div>

        {/* Section 4 */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-4">
            4. What drives behavior over time?
          </h3>
          <p className="text-slate-700 leading-relaxed">
            At every step of the simulation, a number of agents are audited, after which each
            agent’s compliance probability is updated. Compliance can increase from communications or decay naturally. 
            The decaying factor d reflects how
            strongly compliance decays in the absence of interaction with the Tax Authority.
            Audits occur during a yearly campaign week and can be Revenue tax, Corporate income tax,
            or Deep book with different effects and costs. Communications include physical letters, emails, and
            targeted warning letters, each with distinct effects and costs.
          </p>
        </div>

        {/* Section 5 */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-4">
            5. What do the outputs mean?
          </h3>
          <p className="text-slate-700 leading-relaxed">
            Results report mean compliance probability by size and age group, audit coverage per step, tax gap (potential vs actual collections), total intervention costs, and return of investment (ROI). 
            These metrics help compare enforcement strategies and identify high-impact segments.
          </p>
        </div>
      </div>
    </div>
  );
}
