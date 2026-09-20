# Executable architecture

```text
Local synthetic scenario + reference coastline + numeric RF model
                          |
                 Python environment layer
         concentration / forcing / iceberg state
                          |
       RF forecast + Kalman/forcing trajectories
                          |
         time-dependent exposure and exclusions
                          |
       four time-labelled weighted-A* searches
                          |
       independent geometry/time/CPA assessment
                          |
      one scenario payload, metrics and provenance
                          |
        FastAPI same-origin JSON + static UI
                          |
      TypeScript mission map / controls / report
```

## Module contracts

- `geography.py`: projection, geodesic distances, grid, coast buffer and reference geometry.
- `forecast.py`: load numeric JSON trees and infer concentration at requested features.
- `icebergs.py`: synthetic observation histories, Kalman filtering, forcing forecasts and analytic CPA.
- `environment.py`: seeded fields; spatial/temporal interpolation; concentration/exposure/clearance samples.
- `routing.py`: graph, weighted search, fuel and final independent assessment.
- `engine.py`: scenario options, cache, mission construction, test hazard, routes, deltas and source status.
- `main.py`: validated API schemas, observation overlay import, copilot templates and static-file delivery.
- `frontend/src/app.ts`: shared interface state, controllers, pages, judge tour, playback and export.
- `frontend/src/map.ts`: local SVG map geometry and rasterized field overlays; no paid map provider.

## Data flow and consistency

A UI control submits validated options. The backend computes one scenario response containing its environment, tracks, route metrics, alerts and comparisons. The map, cards, copilot and report use that scenario rather than independently inventing numbers. A request sequence counter prevents an older response from overwriting a newer UI request.

The backend keeps an in-process LRU-like cache of eight option sets and serializes construction with an RLock. This is sufficient for a local demo, not a distributed production service. The environment is deterministic; performance timing and bounded weighted search can vary across machines. Only one local user session is intended.

Map and voyage clocks are distinguished from the system clock: the system header shows real UTC, while the synthetic mission uses a fixed simulation epoch. An arbitrary forecast slider previews future environmental fields and a projected ghost vessel; Play advances the actual simulation position.

## Deployment

`python start.py` runs a local Uvicorn process on loopback, serving `/api/*` and `frontend/dist`. No Node runtime or internet connection is needed for normal application use after Python packages are installed. TypeScript is a development-only compiler. No authentication, remote deployment, database, worker queue or public service is configured.

## Safety boundaries

Synthetic environmental data is never presented as a live feed. Observation import is overlay-only and does not silently replace the demo forecast grid. No-route results are exposed. The UI and reports show non-operational limitations. The map, risk, “resilience” and fuel model are research demonstrations only.
