# POLAR PULSE — build and test evidence

Build date: **2026-09-18**. Scope: the included local offline synthetic research prototype, not real-vessel navigation validation.

## Automated tests

**71 tests passed** in the final recorded run. The suite includes geography, land intersection avoidance, bounded RF output, numerical-model holdout reproduction, Kalman state estimation, an analytic crossing CPA example, risk contribution arithmetic, positive fuel behavior, time-monotonic route ancestry, independent route admissibility checks, old/new hazard validation, what-if behavior, two missions, no-route handling, parameter validation (including NaN rejection), source labeling, observation overlays, exports, API/static assets and the local API explorer.

Actual runner output:

```text
.......................................................................  [100%]
71 passed in 11.68s
```

Detailed machine-readable evidence: `evidence/pytest-results.xml`.

## Browser acceptance

**38 checks passed** in 25.07 seconds. Browser JavaScript/console errors observed: **0**.

Checks include all nine pages, four computed route cards, layer selection, map inspection, forecast and objective sliders, zoom, what-if recomputation, hazard injection, explanation deltas, contextual copilot, CSV import and plotted overlays, real JSON download, printable briefing popup, model evidence display, voyage playback/reset, complete nine-stage judge story, a second mission and responsive widths.

Screensizes: desktop 1600×1100, secondary 1240×900, mobile 390×844. Horizontal overflow was not detected on the tested views. This is not an exhaustive accessibility or every-browser audit.

**Browser transport qualification:** Same compiled ES modules in Chromium using test-only offline bridge into actual FastAPI TestClient. Managed browser denies loopback navigation; direct local HTTP is tested separately. This explicitly tests the shipped compiled modules and actual backend behavior, but does not represent native Windows/Edge navigation testing. The bridge is test code only; the distributed application uses ordinary same-origin HTTP.

Evidence: `evidence/browser-acceptance.json`, `evidence/browser-acceptance-log.txt` and the screenshot series.

## Actual local HTTP process

**9 requests passed** over a real loopback socket into a separately launched Uvicorn server. Tested root HTML, compiled JS, CSS, favicon, health, bootstrap, OpenAPI, local `/docs` explorer and a hazard-scenario POST. Server readiness was measured at approximately **1.817 seconds** in this build environment. Scenario timings are machine-specific, not a benchmark promise.

Evidence: `evidence/http-smoke.json`, `evidence/http-server-log.txt`, `evidence/http-smoke-log.txt`.

## Default synthetic reroute observed in the HTTP test

| Quantity | Calculated value |
|---|---:|
| First old-corridor modeled envelope breach | 9.936 h from departure |
| Old minimum clearance margin | -11.708 km |
| Alternative minimum clearance margin | 2.277 km |
| Additional distance | +11.52 km |
| Arrival delay | +25.3 min |
| Fuel change vs old corridor | +62.2 L |
| Fuel change vs old corridor | +1.67% |
| Old / alternative policy exposure | 25.00 / 22.56 out of 100 |

A negative margin is a modeled exclusion violation, not proof of a collision. A positive margin is not proof of real-world safety. The event is a deliberately constructed synthetic test encounter. Figures are emitted by the engine and may change with options or search-budget/machine behavior.

Full scenario: `evidence/default-hazard-scenario.json`. The exported browser briefing is independently included as `evidence/exported-mission.json`.

## Model evidence

The RF was actually trained; the numerical artifact is included. Published synthetic holdout MAE is reproduced from that artifact by five parameterized tests. At 24 h the model gives 1.834 pp MAE versus 3.882 pp persistence. At 48 h the Kalman synthetic-track test gives 3.213 km FDE. These are not Antarctic field metrics. Nominal-90% sea-ice interval coverage at 72 h is only 82.86%, and that shortfall is explicitly displayed.

## Executed environment

- Python **3.13.5**, Linux.
- FastAPI 0.128.2, Uvicorn 0.48.0, NumPy 2.3.5, Shapely 2.1.2, pyproj 3.7.2.
- scikit-learn 1.8.0 for actual model training; not required for shipped runtime inference.
- Headless Chromium and Playwright for UI checks; TypeScript compilation completed successfully.

## Not tested / not completed

Native Windows `.bat` execution, a real projector/browser installation on the user's laptop, public-cloud deployment, browser compatibility beyond the executed Chromium run, multi-user security, external product authentication, real satellite/drift ingestion, marine-chart validity, vessel-specific fuel, field safety and operational forecast accuracy were **not verified**. Deep temporal models and calibrated collision probabilities were **not built**.

The Windows launchers are supplied for convenience, not represented as executables already run on the user's computer. Rehearse there before the competition.

## Reproduce

```sh
python -m pip install -r requirements-dev.txt
python -m pytest -q --junitxml=evidence/pytest-results.xml
python scripts/http_smoke.py
python -m playwright install chromium
python scripts/browser_acceptance.py
```

See `evidence/package-smoke.json` for the separate extracted-archive portability check. The release is not certified for operational use.
