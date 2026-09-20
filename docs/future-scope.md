# Improvements ranked by purpose

## Critical before any scientific/operational claim

1. Obtain appropriate Antarctic datasets and expert review. Implement versioned ingestion, CRS/unit/time/quality alignment, stale-data detection and provenance.
2. Evaluate sea-ice forecasts and iceberg drift against observed region/season-held-out hindcasts; test out-of-distribution failures. Report calibrated uncertainty and proper baselines.
3. Add bathymetry, marine charts, vessel ice class, ice thickness, manoeuvrability, forecast wave/wind limits and relevant maritime rules.
4. Calibrate fuel/speed response with actual vessel data. Separate physical collision likelihood, uncertainty and policy penalties.
5. Undertake controlled expert-reviewed trials. Keep an operator responsible for decisions. Do not use this demo for an actual voyage.

## Important for an expanded prototype

- Product-specific NetCDF/Zarr/GeoTIFF adapters and observational assimilation.
- Waiting actions and finer adaptive time labels in routing; compare against standard A*/Dijkstra references and quantify approximation error.
- Ensemble drift/ice sampling and robust/risk-constrained route objectives.
- Better validation of continuous exclusion clearance between samples.
- Exact segment-by-segment simulation fuel accounting and terrain/obstacle-aware route smoothing.
- Background workers, job cancellation, larger grids, profiling and bounded latency for multiple users.
- Native Windows installation and additional browser/accessibility testing.
- Authenticated deployments, rate limits, resource budgets, audit logging and session isolation before any shared service.

## Optional presentation/product polish

- Vessel profiles supplied by domain experts, team logo/name customization and additional prevalidated scenarios.
- Localized narration, screen-reader map summaries and fuller keyboard interaction.
- Deeper temporal architectures only after obtaining trustworthy training/evaluation data.
- A constrained LLM explanation layer that cannot change or invent numeric outputs; the current deterministic copilot is already demo-ready.

## Near-term rehearsal priority

On the presenter's laptop: install once, run the actual local server, rehearse the full Judge Demo, inspect the exported briefing and verify projector sizing. That rehearsal is more valuable than adding another animation immediately before judging.
