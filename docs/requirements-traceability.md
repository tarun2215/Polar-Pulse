# Supplied brief: implementation traceability

The user asked for a polished, complete demonstration with the full prediction-to-navigation chain. This release completes that **offline synthetic prototype chain**, not every requested advanced model or a scientifically validated operational system.

| Requirement | Status | Actual implementation / gap |
|---|---|---|
| POLAR PULSE brand and dark command-center UI | Implemented | Custom logo, restrained navy/ice-cyan design, map-led interface |
| Nine module pages | Implemented | Mission, ice, icebergs, routes, voyage, decision, data, performance, architecture |
| Antarctic-centered projection and coastline | Implemented as reference | Local south-polar stereographic sector and Antarctic inset; coarse Natural Earth geography |
| Live satellite/weather/vessel status | Intentionally not claimed | Offline simulated sources are shown honestly; no live adapters |
| Current and future sea ice | Implemented | 0/6/12/24/48/72 h RF fields; time interpolation, change layer, trends |
| Baseline and deep temporal sea-ice models | Partial | Persistence baseline + trained RF; no LSTM/GRU/ConvLSTM |
| Full listed environmental feature set | Partial | Seven RF features; no pressure/ice thickness/image embeddings |
| Observed/predicted iceberg tracks | Implemented on synthetic data | Kalman histories, vector forcing, trajectory dots and nominal envelopes |
| Deep iceberg trajectory model / image detector | Not implemented | No GRU/LSTM or satellite iceberg detection |
| CPA/TCPA | Implemented | Piecewise-linear analytic center closest approach |
| Collision probability | Intentionally replaced | Transparent proximity/exposure/clearance metrics, not fabricated probabilities |
| Integrated future risk map | Implemented | Explainable weighted exposure index, cell inspection |
| Four route choices | Implemented | Fastest/safety/fuel/AI-balanced objectives; may return coincident or no paths |
| Global optimality / certified safest route | Not claimed | Weighted heuristic, discretized labels and bounded search |
| Priority sliders and map waypoints | Implemented | Validated recomputation; hard exclusions retained |
| Dynamic hazard injection and reroute | Implemented | Constructed encounter event; computed alternatives and same-scenario deltas |
| What-if wind/current/ice/drift | Implemented | Forcing, fields, trajectories and routes recomputed |
| Voyage playback | Implemented with approximation | Shared clock and positions; remaining fuel uses linear whole-voyage interpolation |
| Autoreplan without user action | Partial | Hazard button/replan action and judge flow; not a continuously streaming autonomous navigator |
| Explainability / contributions | Implemented | Actual costs and policy components; no fabricated SHAP |
| Copilot | Implemented as deterministic assistant | Current-state answers; no generative model integration |
| Predictive safety lead time | Implemented | First predicted old-route envelope breach relative to departure |
| Route resilience score | Implemented heuristic | Explicit weighted scenario score; not independent safety certification |
| Route risk/fuel/emissions comparison | Implemented as estimates | Geometry/time-derived metrics with toy propulsion/emissions assumptions |
| Production data ingestion | Partial | Validated CSV/JSON overlay import; real product assimilation remains future work |
| Offline fallback | Implemented as default | Bundled model, geography and scenario; no network dependency for core app |
| Judge mode and scripted story | Implemented | Nine-stage autoplay, pause/next, computed finale |
| JSON/print briefing | Implemented | Download full scenario/methodology; local printable HTML, browser Save as PDF |
| React/Vite preference | Alternative used | Dependency-free compiled TypeScript/SVG for one-process, offline reliability |
| Backend APIs | Implemented | FastAPI, schema validation, real local endpoints |
| Scientific validation | Synthetic only | Scene-held-out RF + 100 simulated drift-track tests; no Antarctic field validation |
| Test and debug | Implemented | Python suite, browser interaction checks, real HTTP smoke, evidence included |
| Windows launchers | Supplied, not native-Windows tested | Setup/start batch files; actual execution environment Linux/Python 3.13.5 |
| Public cloud deployment / authentication | Not implemented | Local-only application; no hosted URL |

## Non-negotiable presentation boundaries

Do not describe the product as an operational navigator, official agency tool, live satellite tracker, calibrated collision predictor, trained deep neural model or proven fuel-saving deployment. Do describe the algorithms, UI, data flow, test results, synthetic validation and documented next steps accurately.
