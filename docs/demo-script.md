# Three-minute judge demonstration

## Before the judges arrive

Start the local engine, choose **Prydz Bay supply transit**, use the default parameters and fullscreen. Do one full rehearsal. Keep “simulated” visible. The included automatic Judge Demo is about one minute; Pause and Next let you deliver the following three-minute story.

## 0:00–0:25 — The problem, on the map

**Show:** Mission control.

**Say:** “A route can look clear now and become hazardous before the vessel reaches it. POLAR PULSE connects sea-ice forecasts, iceberg motion and time-aware route planning in one decision-support view. This is an offline research scenario: the algorithms execute, while the vessel and environmental observations are simulated.”

Do not open with a login page, a slide about the stack or claims of deployment by NCPOR.

## 0:25–0:50 — The future ice field

**Do:** Open Sea-ice intelligence; select +24 h; switch between Sea ice and Δ Ice.

**Say:** “The map is changing because the random-forest model predicts concentration change from present ice, recent trend, temperature, wind, current and forecast horizon. We also display a nominal uncertainty band. The system exposes uncertainty rather than calling every forecast exact.”

Point to the actual visible values rather than memorizing one set of KPI numbers.

## 0:50–1:10 — The moving hazard

**Do:** Open Iceberg tracker, click a SIM-* iceberg.

**Say:** “A Kalman filter estimates position and velocity from noisy observations. The forecast includes simplified forcing and an uncertainty envelope. We compare the vessel and iceberg at the same future times, not merely by distance on the present map.”

The numbered SIM IDs are fictitious; do not call them detected real icebergs.

## 1:10–1:45 — The hero moment

**Do:** Return to Mission control; click **Simulate hazard**. Then **Focus predicted crossing**.

**Say:** “Now we inject a new synthetic observation that challenges the existing corridor. The engine reassesses the old route in the updated environment and computes alternatives. Here it identifies the first modeled clearance breach about 9.9 simulated hours ahead.”

**Point to:** the red dashed old corridor, injected SIM-X09, and the green alternative. Use the figure the running system actually displays.

## 1:45–2:10 — Explain the decision and its cost

**Do:** Click **Why this route?**

**Say:** “The important result is not a green line. It is the reason for changing the decision. The new corridor has a positive modeled clearance margin. In this default scenario, it adds roughly 11.5 km, 25 minutes and 62 liters. We show that safety trade-off honestly instead of inventing fuel savings.”

Different seeds/settings/search budgets can change these numbers; the active report is the source of truth.

## 2:10–2:35 — Let the judges challenge it

**Do:** Open What-if controls; increase wind modestly, e.g. 1.20×; allow recalculation. Alternatively change the safety slider in Route planner.

**Say:** “These are not fixed screenshots. Changing an assumption updates the fields, drift and route calculations. Hard exclusions remain enabled. A severe scenario may produce no admissible route; we report that instead of drawing a fake fallback.”

Avoid maximally severe settings during the primary story unless you have rehearsed the no-route outcome.

## 2:35–3:00 — Evidence, limitations and the close

**Do:** Open Model performance, then return to the map.

**Say:** “On independent synthetic holdout scenes, the 24-hour sea-ice MAE is 1.834 percentage points, versus 3.882 for persistence. These are not Antarctic field-accuracy claims. The next step is real product integration, observed-track validation and vessel-specific constraints. What we have built today is the complete executable prediction-to-decision loop.”

**Close:** “POLAR PULSE: predict the hazard, evaluate the future corridor, explain the next decision.”

## Autoplay alternative

Press Run judge demo, and use Pause/Next when you want to speak. It resets the default mission and moves through nine states. The final card reports computed scenario outcomes. Exit Judge Mode before freely changing missions or playback.

## Backup if presentation conditions fail

If the projector is unavailable, use the actual screenshots in `evidence/`. Say they are screenshots of the tested local demo, not a live feed. If dependencies are not installed, do not claim that screenshots are an executing application; finish setup beforehand. Keep the JSON briefing and README available as evidence of the calculation chain.
