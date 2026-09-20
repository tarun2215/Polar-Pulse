# Twenty judge questions, answered without overclaiming

**1. What is the actual innovation?**
The prototype connects forecast concentration, time-dependent iceberg envelopes, constrained route search, independent route checks and explanations in one interactive loop. Its contribution is the integration and decision workflow; it does not claim invention of random forests, Kalman filtering or A*.

**2. Why use AI rather than only ordinary routing?**
Routing needs future conditions, not only present costs. The sea-ice forecaster supplies an evolving concentration field; the trajectory model supplies future obstacle positions. The graph search then evaluates corridors at predicted arrival times. AI does not replace the route solver or human responsibility.

**3. Which models were actually built?**
A trained 40-tree random-forest concentration-change model, a linear Kalman state estimator with simplified forcing, and four time-labelled weighted-A* routing policies. We did not train or secretly substitute a fake GRU/LSTM/ConvLSTM.

**4. Are the satellites or weather feeds live?**
No. The environment, observations and vessel are simulated; the UI states that. Natural Earth supplies real reference geography and NCPOR supplies a station-coordinate reference. Public feed targets are labeled not connected. The CSV importer creates validated observation overlays only.

**5. How was sea-ice prediction evaluated?**
Whole synthetic scenes were held out: 60 train, 15 calibration and 15 test, with 5,250 test rows. At 24 h, MAE is 1.834 percentage points versus 3.882 for persistence. This tests the implemented pipeline on an artificial generator, not Antarctic field performance.

**6. Why is R² so high? Is that 99% accuracy?**
No. R² is a regression statistic, and the generator is deliberately simple. Present concentration already explains much of future concentration variance. The interface labels R² explicitly and emphasizes MAE, baseline comparison, coverage and the real-world validation gap.

**7. How is uncertainty handled?**
Sea-ice intervals use horizon-specific synthetic calibration residuals. Iceberg envelopes propagate assumed Kalman/velocity uncertainty. Nominal 90% is not guaranteed coverage: the measured sea-ice coverage drops to 82.86% at 72 h, and iceberg envelopes are not field-calibrated. Both limitations are visible.

**8. What do CPA and TCPA mean?**
Closest point of approach is the minimum modeled center distance between the vessel and an iceberg. Time to CPA is elapsed time from route departure to that minimum. We solve the minimum analytically for piecewise-linear relative trajectories rather than only checking the waypoint endpoints.

**9. Is the exposure score a collision probability?**
No. It is a weighted policy index from normalized ice, iceberg proximity, waves, current magnitude and forecast interval width. The coefficients and contribution bars are disclosed. A score of 25 does not mean a 25% collision chance.

**10. Why weighted A* instead of standard A* or reinforcement learning?**
A small time-labelled graph gives an inspectable, testable demo with explicit constraints. A 3.2 weighted heuristic improves latency but sacrifices an optimality guarantee. RL would introduce additional training and reward-validation burdens. Standard A*, Dijkstra and higher-fidelity methods are appropriate future comparison baselines.

**11. How are moving hazards handled?**
Each search label has an arrival time. Edge costs and exclusions are evaluated at predicted future times, with temporal interpolation. The returned route is independently assessed again, including continuous-model samples and analytic CPA. The model still has discretization limitations and is not a navigation safety certificate.

**12. How do you ensure routes do not cross land?**
Graph edges cannot intersect the buffered reference polygon, diagonal corner-cutting is blocked, and final segments are checked again. However, Natural Earth is much too coarse for real navigation; passing this test does not replace marine charts, bathymetry or local operating rules.

**13. How is fuel estimated?**
An explicit illustrative model combines hotel load, a cubic-speed propulsive term, ice drag and a wave penalty, then integrates along the route. The coefficients are not calibrated to a real research vessel. Fuel remaining during playback uses simple linear voyage interpolation and is labeled as such.

**14. Does rerouting always save fuel?**
No. In the default injected scenario the validated alternative costs about 62 extra liters and about 25 minutes. We compare old and new corridors in the same changed environment. Fuel relative to the fastest policy is a different, clearly labeled comparison.

**15. What is predictive safety lead time?**
It is the time from the modeled departure until the first predicted envelope breach on the old corridor. Approximately 9.9 hours is the default synthetic scenario result. It is not a claim that the system will detect all real hazards nine hours ahead.

**16. What if no route is found?**
The engine returns a no-route result and asks for review. It does not draw a straight line through excluded cells. “Not found” can reflect actual modeled blockage or the time/search budget; it is not a proof of global infeasibility.

**17. How reliable is the offline demo?**
The compiled interface, map geometry, numerical model and synthetic data are bundled. One local Python process serves UI and APIs. No external tokens, cloud API calls or map tiles are needed after package installation. The release includes automated/browser/HTTP evidence and source code; native Windows rehearsal remains necessary.

**18. Is Polar Copilot a real LLM?**
No. It is a deterministic, state-grounded explanation interface. It quotes the actual active route metrics and scenario changes. This keeps the demo useful without fabricating an external AI integration or requiring a key. A future LLM would need constrained data access, citations and numerical consistency checks.

**19. How could NCPOR integrate it?**
The JSON APIs and separate environment/model/routing modules are integration points. A real integration would first require validated product adapters, authority-provided chart/bathymetry/vessel constraints, observed hindcast tests, uncertainty calibration and expert review. No approval, partnership or deployment is claimed.

**20. What are the next critical improvements?**
Real Antarctic hindcast validation; product-specific CRS/unit/time/quality alignment; calibrated drift/ice uncertainty; charts and bathymetry; vessel ice class and propulsion; maneuvering constraints and human-reviewed trials. Larger deep temporal models are secondary to obtaining trustworthy inputs and evaluation.
