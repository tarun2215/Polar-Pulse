# Local API reference

Base address after starting the app: `http://127.0.0.1:8000`. OpenAPI schema: `GET /openapi.json`. The interactive `/docs` explorer and this Markdown reference are fully offline; no Swagger/CDN assets are requested.

All routes are local/demo routes and unauthenticated. Do not deploy them publicly without security design.

## Scenario options

```json
{
  "mission": "supply",
  "wind": 1,
  "current": 1,
  "ice": 1,
  "drift": 1,
  "safety": 75,
  "fuel": 45,
  "time": 45,
  "hazard": false,
  "start": null,
  "goal": null,
  "departure_hour": 0
}
```

`mission`: supply or survey. Wind/current/drift multipliers: 0.5–2.0. Ice multiplier: 0.5–1.6. Priorities: 0–100. Departure: 0–24 h. Optional start/goal are projected `[x_km,y_km]` coordinates inside the modeled sector, not longitude/latitude. Unknown fields and out-of-range values are rejected with 422. A land waypoint may be geometrically valid but return no admissible route.

| Method | Path | Input / output |
|---|---|---|
| GET | `/api/health` | Local readiness, version and honest simulated status |
| GET | `/api/bootstrap` | Geography, default scenario, metrics and source registry |
| GET | `/api/mission` | Default mission |
| GET | `/api/environment/current` | Default synthetic environment |
| GET | `/api/sea-ice/current` | Same current environment payload |
| POST | `/api/sea-ice/forecast` | `{options, horizon}`; horizon 0–72 h; flattened concentration percentages |
| GET | `/api/icebergs` | Default synthetic tracks |
| POST | `/api/icebergs/predict` | Scenario options; corresponding tracks |
| POST | `/api/routes/calculate` | Scenario options; full computed scenario |
| POST | `/api/routes/recalculate` | Scenario options; full computed scenario |
| POST | `/api/scenario/simulate` | Main UI scenario computation |
| POST | `/api/what-if` | Same computation contract for modified options |
| GET | `/api/alerts` | Default alerts; active scenario alerts also travel in its payload |
| POST | `/api/risk/inspect` | `{options,horizon,x,y}`; cell exposure and exact component contributions |
| POST | `/api/copilot` | `{options,question,route_id}`; deterministic state-grounded explanation |
| GET | `/api/metrics` | Saved actual synthetic evaluation metrics |
| GET | `/api/data/sources` | Source names, status and limitations |
| GET | `/api/data/template.csv` | Four synthetic observation examples |
| POST | `/api/data/import` | `{rows:[...]}`; validation and overlay coordinates only |
| POST | `/api/reports/mission` | Scenario options; full scenario, methodology and source registry |

Observation rows need `latitude`, `longitude`, `concentration` in 0–1, `observed_at` in ISO date-time form and an optional `source`. At most 5,000 rows; the UI enforces a 2 MB file limit. Imported points outside map coverage are counted separately. Imported rows are not persisted after page refresh and do not train the model.

A successful HTTP status does not imply a route was found: inspect each route's `status`, `admissible` and `reason`. Forecast/risk arrays use the provided x/y grid and row-major flattening. Numeric fractions and display percentages are explicitly named to avoid a 100× unit error.
