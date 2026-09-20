# Model methodology and honest interpretation

## Scope

POLAR PULSE is a runnable **synthetic research prototype**. Its algorithms execute, but a simulator supplies the environmental observations and the fictional vessel. Real-world skill and navigation safety are unknown. The figures in this document come from the included experiment artifacts, not from a field trial.

## 1. Coordinate system and geography

WGS84 longitude/latitude are transformed with a south-polar stereographic CRS:

```text
+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=76 +datum=WGS84 +units=km +no_defs
```

The modeled sector is x = −530…530 km, y = 2180…2690 km, on a 10 km grid. The graph has 107×52 grid locations before land exclusion. WGS84 geodesic segment distances determine voyage distance; local projected distances are used for toy iceberg exclusion envelopes and CPA calculations. Grid current components are simplified forcing components, not a fully rotated physical ocean-vector assimilation product.

Natural Earth 1:110m land is a coarse basemap. A 5 km reference buffer is imposed in this model. It is **not an operational coastal clearance**, and a small-scale shoreline cannot establish navigable water. The mission ends offshore. No bathymetry or charted obstructions are represented.

## 2. Sea-ice prediction

### Training data

`ml/train.py` deterministically creates 90 artificial scenes, each containing 70 samples and five horizons: 6, 12, 24, 48 and 72 hours. Each scene has a latent concentration-change regime and observation noise. Targets are generated with bounded, nonlinear concentration changes influenced by recent trend, temperature and toy wind/current terms.

Features actually implemented:

1. Present concentration, fraction 0–1.
2. Recent concentration trend per hour.
3. Air temperature, °C.
4. Sea-surface temperature, °C.
5. North/grid-aligned wind component, m/s.
6. North/grid-aligned current component, m/s.
7. Forecast horizon, h.

Latitude, longitude, pressure, thickness, snow cover, optical imagery and deep temporal embeddings are **not input features of the trained model in this release**. Map coordinates are used by the environment/geometry layer.

### Model and split

RandomForestRegressor: 40 trees, maximum depth 10, minimum leaf samples 8, max_features 0.9, random seed 26059. It predicts concentration **change**, which is added to the present concentration and clipped to 0–1.

Entire scenes are split: 0–59 train, 60–74 calibration, 75–89 test. Counts are 21,000 / 5,250 / 5,250 rows. Cells and horizons from a held-out scene never enter training or calibration. This limits scene leakage but does not make synthetic performance representative of Antarctic conditions.

The artifact stores tree thresholds, children, features and numeric leaf values as JSON. Runtime inference is implemented in NumPy. Tests regenerate the held-out examples and verify that the shipped portable artifact reproduces the published horizon-wise MAE to within 0.001 percentage points.

### Evaluation

| Horizon | MAE (pp) | RMSE (pp) | R² | Persistence MAE (pp) | Interval half-width (pp) | Empirical coverage |
|---|---:|---:|---:|---:|---:|---:|
| 6 h | 0.694 | 0.862 | 0.9987 | 1.172 | 1.353 | 88.67% |
| 12 h | 1.049 | 1.296 | 0.9971 | 2.163 | 2.011 | 87.43% |
| 24 h | 1.834 | 2.260 | 0.9914 | 3.882 | 3.542 | 88.86% |
| 48 h | 3.460 | 4.270 | 0.9712 | 6.810 | 6.101 | 84.00% |
| 72 h | 4.999 | 6.174 | 0.9435 | 9.067 | 8.635 | 82.86% |

pp means **percentage points**, not relative percent. Persistence predicts that future concentration equals current concentration. R² is a regression statistic, not classification accuracy or “percent correct.” The artificial generator is much easier than a real Antarctic forecasting problem; do not market these results as satellite accuracy.

### Uncertainty

For each horizon, absolute calibration residuals are ordered and the finite-sample nominal-90% split-conformal rank is used as a symmetric interval half-width. This is a prototype residual band. Cells within scenes are correlated; exchangeability/independence assumptions are not fully satisfied. Test coverage is shown, and falls below 90%, especially at long horizons. Neither interval nor confidence terminology establishes operational reliability.

The display interpolates linearly between model horizons, and samples spatial fields bilinearly. This is not new observed data at intermediate times. Impurity feature importance is displayed; it is not causal attribution or SHAP.

## 3. Iceberg state and trajectories

Synthetic observations arrive at −24, −18, −12, −6 and 0 h. A linear Kalman filter estimates `[x, y, vx, vy]`. A constant-velocity transition uses a six-hour interval; the Joseph-form covariance update is used. A simplified future velocity multiplier is:

```text
forecast_velocity = estimated_velocity × (0.8 × current_multiplier + 0.2 × wind_multiplier) × drift_multiplier
```

This is a deliberately small toy forcing model, not a validated iceberg force-balance model. It omits keel geometry, water-depth dependence, sea-ice confinement, Coriolis/drag integration and fragmentation.

Future positions are generated every half hour. A nominal isotropic Gaussian radial factor of 2.146 multiplies propagated standard deviation for the displayed 90% radius. The covariance/forcing assumptions have **not been calibrated on observed Antarctic drift tracks**.

The four default IDs and injected `SIM-X09` are fictional. A test event places a new synthetic observation so the prior corridor experiences an encounter. The event is intentionally constructed; the route search after the event is actually calculated, not replayed from a prerecorded path.

### Independent synthetic evaluation

100 held-out tracks, seeds 90000–90099, have noisy past observations and randomly accelerated future motion. ADE is mean displacement error across forecast times. FDE is displacement at the horizon.

| Horizon | ADE (km) | FDE (km) | Stationary-baseline FDE (km) |
|---|---:|---:|---:|
| 6 h | 0.401 | 0.470 | 2.829 |
| 12 h | 0.501 | 0.707 | 5.654 |
| 24 h | 0.772 | 1.352 | 11.323 |
| 48 h | 1.521 | 3.213 | 22.715 |

These are not real-iceberg performance statistics. No GRU/LSTM/Transformer trajectory model was trained in this release.

## 4. Exposure and clearance

Each component is normalized to [0,1]:

```text
I = clip(concentration / 0.85)
B = max over icebergs exp(−0.5 × (distance / exclusion_radius)^2)
W = clip((wave_height − 1) / 4)
C = clip(current_magnitude / 0.5)
U = clip(forecast_interval_half_width / 0.15)

Exposure = 100 × (0.38 I + 0.32 B + 0.14 W + 0.08 C + 0.08 U)
```

The weights are transparent prototype policy choices, not learned collision likelihoods. Current magnitude is an exposure proxy; it can also help or hinder travel speed through its along-track component.

```text
Iceberg exclusion radius = 8 km demo stand-off + iceberg radius + nominal uncertainty radius
Clearance margin = center distance − exclusion radius
```

A negative margin indicates an exclusion-envelope breach, not a measured collision. A positive margin only satisfies this modeled envelope; it does not establish real-world safety. The selected route's exposure score is time-weighted; sea-ice exposure is distance-weighted.

## 5. Time-labelled weighted A* routing

An eight-neighbour graph forbids edges crossing buffered land and diagonal corner-cutting. Departure time is part of each search label; labels are binned at 0.75 h. Waiting actions are not included. Four policies use different nominal speeds and objective weights: fastest, safety priority, fuel saver and AI balanced.

Each transition estimates speed through water using ice and waves, adds projected along-track current to estimate ground speed, then computes travel time and fuel. Normalized edge objective:

```text
cost = distance_km / 10
     + safety_weight × 8 × (exposure / 100) × duration_h
     + time_weight × 1.5 × duration_h
     + fuel_weight × fuel_liters / 150
```

The search uses a **3.2 weighted heuristic** for demo speed. It has no global optimality certificate. “Fastest” and “Safety priority” describe objectives, not guarantees that the returned path is a globally best solution. Routes may overlap when objectives agree.

Hard modeled exclusions: concentration >78%, wave height >5 m, moving iceberg-envelope breach and buffered land. Search samples edge exposure at up to 2.5 km intervals, uses one-hour interpolated lookup fields and adds a 1 km numerical clearance guard. It is bounded by 9,000 expanded labels and a three-second wall budget per policy, with a 48-hour maximum voyage and 72-hour field horizon. If no path is found in budget, the UI reports **no admissible route found**, not mathematical proof that no route exists.

Immutable search ancestry records preserve time-consistent paths. Returned routes are separately rechecked against the environment at approximately 0.5 km spatial sampling, exact land-segment intersections and analytic piecewise-linear CPA calculations across vessel/iceberg time breakpoints. This is still discretized prototype validation, not proof of continuous real-world safety.

CPA/TCPA describe center separation and elapsed time to closest approach. The minimum exclusion margin can occur at a different time because uncertainty grows; the interface distinguishes center CPA from clearance.

## 6. Fuel, emissions and deltas

Illustrative hourly burn, with v in km/h, c in fraction, and w in m:

```text
liters_per_hour = 30 + 150 × (v/20)^3 × (1 + 4c^2) + 10 × max(w−1, 0)
```

The 30 L/h term is hotel load. The coefficients are explicit scenario assumptions, not manufacturer data. Route integration gives voyage fuel. Emissions use an **illustrative** 2.68 kg CO₂/L combustion-only factor; no lifecycle claim is made.

For hazard comparisons, the old corridor is reassessed in the **same updated environment** as the new corridor. Distance, time, exposure and fuel deltas are actual differences. The default alternative costs extra fuel; the product never forces a “savings” percentage. Fuel vs fastest is a different, explicitly labeled comparison.

The simulator's “fuel remaining” interpolates the total route fuel linearly with voyage progress. It is not cumulative engine telemetry or an exact segment-by-segment burn trace. This limitation is shown beside the playback controls.

## 7. Lead time, resilience and explanations

Predictive safety lead time is the elapsed time until the **first modeled exclusion breach on the old corridor**, measured from the scenario departure. It is not a guaranteed real-world warning time.

Resilience is a documented heuristic: 50% low route exposure + 20% fraction of four policies available + 20% estimated fuel reserve + 10% scenario uncertainty allowance. The allowance currently depends on the ice multiplier, not an independently calibrated probability. The score is not a certification, and similar corridor policies should not be mistaken for independent escape routes.

Copilot responses are deterministic templates assembled from the active scenario. Policy contribution bars are not SHAP. No OpenAI or other external LLM service is called.

## 8. What would be required for scientific/operational claims?

Product-specific real data adapters; temporal/CRS/unit/quality alignment; observed ice and drift hindcasts; regional/seasonal out-of-distribution tests; calibrated uncertainty; vessel-specific ice class and propulsion; bathymetry/charts; manoeuvring and traffic rules; operator review; independent expert validation and controlled trials. None is inferred merely because the demo map looks professional.
