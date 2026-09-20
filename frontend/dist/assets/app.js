import { colors, names } from './types.js';
import { icon, logo } from './icons.js';
import { esc, fmt, duration, sign, clamp, lerpArray, pointAt, download, api, parseCSV } from './utils.js';
import { lineChart, spark, bars } from './charts.js';
import { mapSVG, project, unproject, W, H } from './map.js';
const DEFAULT = { mission: 'supply', wind: 1, current: 1, ice: 1, drift: 1, safety: 75, fuel: 45, time: 45, hazard: false, start: null, goal: null, departure_hour: 0 };
const st = { boot: null, scenario: null, page: 'mission', selectedRoute: 'recommended', selectedBerg: null, hour: 0, elapsed: 0, playing: false, speed: 5, layer: 'ice', currents: true, trajectories: true, alternatives: true, icebergs: true, zoom: 1, pan: [0, 0], modal: null, inspector: null, picking: null, busy: false, error: null, judge: false, judgeStep: 0, judgePaused: false, copilotAnswer: '', imported: [], sourceMessage: '' };
const NAV = [{ id: 'mission', label: 'Mission control', icon: 'grid' }, { id: 'ice', label: 'Sea-ice intelligence', icon: 'snow' }, { id: 'icebergs', label: 'Iceberg tracker', icon: 'ice' }, { id: 'routes', label: 'Route planner', icon: 'route' }, { id: 'voyage', label: 'Voyage simulator', icon: 'ship' }, { id: 'decision', label: 'Decision center', icon: 'spark' }, { id: 'data', label: 'Data intelligence', icon: 'database' }, { id: 'performance', label: 'Model performance', icon: 'chart' }, { id: 'architecture', label: 'System architecture', icon: 'network' }];
const titles = { mission: ['Navigate what comes next.', 'Sea ice, drifting hazards and the route ahead. One connected view.'], ice: ['The ice is moving. See ahead.', 'Compare current concentration with a model-derived 72-hour outlook.'], icebergs: ['Every drift tells a story.', 'Observed positions. Predicted movement. Explicit uncertainty.'], routes: ['A better corridor. A clear reason.', 'Balance safety, fuel and time without overriding the hard exclusions.'], voyage: ['Bring the voyage to life.', 'A time-synchronized simulation, from departure to the offshore waypoint.'], decision: ['Not just a route. A reason.', 'Trace every recommendation back to the current scenario and calculations.'], data: ['Know what powers the picture.', 'Transparent provenance. Honest source status. No simulated live feeds.'], performance: ['Evidence over impressive numbers.', 'Reproducible measurements on independent synthetic holdout scenes.'], architecture: ['Built to connect the whole decision.', 'From observations to forecasts, constrained corridors and operator review.'] };
const $ = (s) => document.querySelector(s);
const chosen = () => st.scenario?.routes.find(r => r.id === st.selectedRoute && r.status === 'ok');
const recommended = () => st.scenario?.routes.find(r => r.id === 'recommended' && r.status === 'ok');
const badge = (text, type = '') => `<span class="badge ${type}">${esc(text)}</span>`;
const b = (action, text, ic, cls = 'btn') => `<button class="${cls}" data-action="${action}">${ic ? icon(ic, 16) : ''}${text}</button>`;
const smallLabel = (a, b) => `<div class="stat-pair"><span>${a}</span><b>${b}</b></div>`;
const chips = (items) => `<div class="chips">${items.map(x => `<span>${x}</span>`).join('')}</div>`;
let requestId = 0, judgeTimer, liveTimer, lastTick = 0, sliderTimer;
let dragging = null;
function shell() {
    $('#app').innerHTML = `<aside class="rail"><button class="brand-symbol" data-page="mission" title="POLAR PULSE Mission Control" aria-label="Mission control">${logo()}</button><div class="rail-divider"></div><nav>${NAV.map(n => `<button class="nav-item ${n.id === st.page ? 'active' : ''}" data-page="${n.id}" aria-label="${n.label}" title="${n.label}">${icon(n.icon, 21)}<span>${n.label}</span></button>`).join('')}</nav><div class="rail-bottom"><button class="nav-item" data-action="help" title="Help and keyboard shortcuts" aria-label="Help">${icon('help', 21)}<span>Help / shortcuts</span></button><div class="team-dot" title="POLAR PULSE research prototype">PP</div></div></aside>
 <div class="app-frame"><header class="topbar"><div class="wordmark"><strong>POLAR<span>PULSE</span></strong><small>ANTARCTIC NAVIGATION INTELLIGENCE</small></div><div class="top-divider"></div><div class="mission-select"><span class="mini-label">MISSION</span><select id="mission-select" aria-label="Mission scenario"><option value="supply">Prydz Bay supply transit</option><option value="survey">East corridor survey</option></select></div><div class="top-right"><div class="engine-state"><i></i>LOCAL ENGINE<span>Demo data</span></div><div class="clock"><span id="utc-clock">--:--:--</span><small>SYSTEM UTC</small></div><button class="icon-btn" data-action="fullscreen" aria-label="Toggle fullscreen" title="Fullscreen">${icon('expand', 19)}</button></div></header><main id="main"></main><footer class="app-footer"><span><i></i>LOCAL RESEARCH PROTOTYPE <em>/</em> PS 26059</span><span>SIMULATED ENVIRONMENT <em>/</em> NOT FOR NAVIGATION</span><button data-action="help">Build 1.0 · About this demo ${icon('info', 12)}</button></footer></div><div id="modal-root"></div><div id="toast-root" aria-live="polite"></div>`;
    tickClock();
}
function tickClock() { const e = $('#utc-clock'); if (e)
    e.textContent = new Date().toISOString().slice(11, 19); }
function heading() { const [title, sub] = titles[st.page]; return `<section class="page-heading"><div><div class="eyebrow">${NAV.find(n => n.id === st.page)?.label.toUpperCase()} <span>/</span> POLAR OPERATIONS</div><h1>${title}</h1><p>${sub}</p></div><div class="heading-actions">${b('export', 'Briefing', 'download', 'btn btn-quiet')}${b(st.scenario?.options.hazard ? 'clear-hazard' : 'hazard', st.scenario?.options.hazard ? 'Clear hazard' : 'Simulate hazard', 'bolt', 'btn btn-warning')}${b(st.judge ? 'exit-judge' : 'judge', st.judge ? 'Exit judge mode' : 'Run judge demo', st.judge ? 'cross' : 'play', 'btn btn-primary')}</div></section>`; }
function kpis() {
    const s = st.scenario, r = chosen(), lead = s.delta?.lead_time_h;
    const saved = s.fuel_saved_vs_fastest_l;
    return `<section class="kpi-strip"><article><div class="kpi-icon">${icon('shield', 20)}</div><div><span class="mini-label">ROUTE EXPOSURE</span><div class="kpi-value">${r ? fmt(r.risk, 1) : '--'}<small>/ 100</small></div><p>Policy index · not a probability</p></div><div class="mini-gauge"><svg viewBox="0 0 54 40"><path d="M5 33a22 22 0 0 1 44 0" fill="none" stroke="#294252" stroke-width="4"/><path d="M5 33a22 22 0 0 1 44 0" fill="none" stroke="#50e2bc" stroke-width="4" stroke-dasharray="${(r?.risk || 0) / 100 * 69} 69"/></svg></div></article>
 <article><div class="kpi-icon ice">${icon('radar', 20)}</div><div><span class="mini-label">${lead != null ? 'PREDICTIVE SAFETY LEAD TIME' : 'FORECAST WINDOW'}</span><div class="kpi-value">${lead != null ? fmt(lead, 1) : '72'}<small>hours</small></div><p>${lead != null ? 'Before the old corridor breaches clearance' : 'Six snapshots · explicit uncertainty'}</p></div></article>
 <article><div class="kpi-icon fuel">${icon('fuel', 20)}</div><div><span class="mini-label">EST. VOYAGE FUEL</span><div class="kpi-value">${r ? fmt(r.fuel_l) : '--'}<small>L</small></div><p>${saved != null && st.selectedRoute === 'recommended' ? `${fmt(Math.abs(saved))} L ${saved >= 0 ? 'less' : 'more'} than fastest policy` : 'Illustrative vessel model'}</p></div></article>
 <article><div class="kpi-icon time">${icon('clock', 20)}</div><div><span class="mini-label">ARRIVAL ESTIMATE</span><div class="kpi-value time-value">${r ? duration(r.eta_h) : 'No route'}</div><p>${r ? `${fmt(r.distance_km, 1)} km · offshore destination` : 'Review waypoints or scenario inputs'}</p></div></article></section>`;
}
function stageStrip() { if (!st.judge)
    return ''; const j = st.judgeStep; return `<div class="judge-strip"><div class="judge-label">${icon('play', 16)} JUDGE MODE</div><div class="judge-steps">${['DATA', 'PREDICT', 'RISK', 'ROUTE', 'DECIDE'].map((v, i) => `<span class="${i <= Math.floor(j / 2) ? 'on' : ''}"><b>${i + 1}</b>${v}</span>`).join('')}</div><div class="judge-actions">${b('judge-pause', st.judgePaused ? 'Resume' : 'Pause', st.judgePaused ? 'play' : 'pause', 'btn btn-tiny')}${b('judge-next', 'Next', 'arrow', 'btn btn-tiny')}</div></div>`; }
function mapCard() {
    const s = st.scenario;
    return `<section class="map-card"><div class="map-head"><div><span class="map-dot"></span><b>PRYDZ BAY OPERATIONS</b><span class="map-sub">SOUTH POLAR STEREOGRAPHIC</span></div><div class="map-mode">${badge('SIMULATED', 'amber')}<span id="map-horizon">${st.hour === 0 ? 'NOW' : `+${fmt(st.hour, 1)} H`}</span></div></div>
 <div class="map-stage ${st.picking ? 'picking' : ''}"><div id="map-render">${mapSVG(st)}</div><div class="map-tools"><div class="segmented">${['ice', 'risk', 'difference'].map(x => `<button data-layer="${x}" class="${st.layer === x ? 'selected' : ''}" title="${x === 'difference' ? 'Concentration difference from present' : x === 'risk' ? 'Heuristic exposure index' : 'Sea-ice concentration'}">${x === 'ice' ? 'Sea ice' : x === 'risk' ? 'Risk field' : 'Δ Ice'}</button>`).join('')}</div><button class="map-tool ${st.currents ? 'enabled' : ''}" data-action="currents" title="Toggle ocean current vectors" aria-label="Toggle current vectors">${icon('wind', 17)}</button><button class="map-tool ${st.trajectories ? 'enabled' : ''}" data-action="trajectories" title="Toggle trajectory forecasts" aria-label="Toggle trajectory forecasts">${icon('route', 17)}</button></div>
 <div class="zoom-tools"><button data-action="zoom-in" aria-label="Zoom in">${icon('plus', 18)}</button><button data-action="zoom-out" aria-label="Zoom out">${icon('minus', 18)}</button><button data-action="recenter" aria-label="Recenter map">${icon('target', 18)}</button></div>
 <div class="map-overlay-note">${st.picking ? `Click an offshore point to set the ${st.picking === 'start' ? 'origin' : 'destination'}.` : 'Drag to pan · scroll to zoom · click to inspect'}</div>
 ${st.busy ? '<div class="map-busy"><div class="scan-orbit"></div><strong>Evaluating the new corridor</strong><span>Forecasts → time-dependent exclusions → validated routes</span></div>' : ''}</div>
 <div class="map-bottom"><div class="map-legend"><span>${st.layer === 'risk' ? 'EXPOSURE INDEX' : st.layer === 'difference' ? 'ICE CHANGE (pp)' : 'SEA-ICE CONCENTRATION'}</span><div class="legend-ramp ${st.layer}"></div><em>${st.layer === 'difference' ? '−22 → +22' : st.layer === 'risk' ? '0 → 100' : '0 → 100%'}</em></div><span class="map-credit">Natural Earth reference · Not a marine chart</span></div></section>`;
}
function timeline() { return `<section class="timeline"><button class="play-button" data-action="play" aria-label="${st.playing ? 'Pause' : 'Play'} voyage simulation">${icon(st.playing ? 'pause' : 'play', 18)}</button><div class="timeline-label"><span class="mini-label">FORECAST SNAPSHOT</span><b id="time-label">${st.hour === 0 ? 'Present' : `T + ${fmt(st.hour, 1)} h`}</b></div><div class="time-track"><input id="time-slider" type="range" min="0" max="72" step=".5" value="${st.hour}" aria-label="Forecast horizon in hours"/><div class="time-ticks">${[0, 6, 12, 24, 48, 72].map(h => `<button data-hour="${h}" style="left:${h / 72 * 100}%">${h === 0 ? 'NOW' : `+${h}h`}</button>`).join('')}</div></div><div class="play-speed"><select id="play-speed" aria-label="Simulation playback speed">${[1, 5, 10].map(x => `<option ${st.speed === x ? 'selected' : ''} value="${x}">${x}×</option>`).join('')}</select><small>1× = 1 sim min/s</small></div><button class="icon-btn" data-action="reset-play" title="Reset voyage clock" aria-label="Reset voyage clock">${icon('reset', 17)}</button></section>`; }
function routeCards() { return `<section class="route-cards">${st.scenario.routes.map(r => `<button class="route-card ${r.id === st.selectedRoute ? 'active' : ''} ${r.status !== 'ok' ? 'unavailable' : ''}" data-route="${r.id}" ${r.status !== 'ok' ? 'disabled' : ''} style="--route-color:${colors[r.id]}"><div class="route-card-title"><span class="route-line"></span>${names[r.id]}${r.id === 'recommended' ? '<span class="smart-tag">AI</span>' : ''}${r.id === st.selectedRoute ? icon('check', 15) : ''}</div>${r.status === 'ok' ? `<div class="route-card-metrics"><b>${fmt(r.distance_km, 1)}<small>km</small></b><b>${fmt(r.fuel_l)}<small>L</small></b><b>${fmt(r.risk, 1)}<small>index</small></b></div><div class="route-card-foot"><span>${duration(r.eta_h)} ETA</span><span>Clearance +${fmt(r.min_clearance_km, 1)} km</span></div>` : `<div class="no-route-small">No admissible route</div><small>${esc(r.reason)}</small>`}</button>`).join('')}</section>`; }
function missionPanel() {
    const s = st.scenario, r = chosen();
    const lead = s.delta?.lead_time_h;
    const m0 = s.environment.average[0], m24 = s.environment.average[3];
    return `<aside class="intelligence-panel"><div class="panel-title"><div class="ai-orb">${icon('spark', 20)}</div><div><span class="mini-label">POLAR INTELLIGENCE</span><h3>${s.options.hazard ? 'A crossing, anticipated.' : 'The route ahead, connected.'}</h3></div></div>
 ${s.delta ? `<div class="lead-callout"><span>THREAT FLAGGED BEFORE ENCOUNTER</span><strong>${lead != null ? fmt(lead, 1) : '--'} <small>hours</small></strong><p>SIM-X09 / synthetic observation injection</p></div>` : `<div class="mini-forecast"><div><span class="mini-label">REGIONAL SEA ICE</span><b>${fmt(m0, 1)}<small>%</small><em>→</em>${fmt(m24, 1)}<small>%</small></b></div>${spark(s.environment.average, '#79d5f1', 125, 36)}<p>Present to +24 h · simulated regional mean</p></div>`}
 <div class="insight-box"><span class="insight-badge">${icon(s.options.hazard ? 'shield' : 'route', 14)} ${s.options.hazard ? 'CORRIDOR REASSESSED' : 'RECOMMENDATION READY'}</span><p>${s.delta ? `The previous corridor breaches the modeled iceberg envelope. The alternative adds <b>${sign(s.delta.distance_km)} km</b> with <b>${sign(s.delta.delay_minutes, 0)} min</b> travel time.` : r ? `A <b>${fmt(r.distance_km, 1)} km</b> corridor balances projected ice exposure, fuel use and arrival time. Every edge is checked against future hazards.` : 'No admissible corridor. Review constraints and waypoints.'}</p><button class="text-button" data-action="explain">Why this route? ${icon('arrow', 15)}</button>${s.delta ? '<button class="text-button" data-action="focus-hazard">Focus predicted crossing ↗</button>' : ''}</div>
 <div class="section-label">MISSION WATCH <span>${s.alerts.length} EVENTS</span></div><div class="alerts-mini">${s.alerts.slice(0, 2).map(a => `<button class="alert-row ${a.severity}" data-alert="${a.id}"><span class="alert-icon">${icon(a.severity === 'critical' ? 'alert' : a.severity === 'success' ? 'check' : 'radar', 16)}</span><span><b>${esc(a.title)}</b><small>${a.hour != null && a.hour > 0 ? `Forecast +${fmt(a.hour, 1)} h` : 'Current scenario'}</small></span>${icon('arrow', 13)}</button>`).join('')}</div>
 <div class="weather-row"><span>${icon('wind', 17)}<b>${fmt(s.environment.wind_m_s, 1)}</b> m/s</span><span>${icon('wave', 17)}<b>${fmt(s.environment.wave_m, 1)}</b> m</span><span class="simulation-label">SIM</span></div><div class="panel-bottom-note">Forecast → assess → optimize → explain</div></aside>`;
}
function seaIcePanel() {
    const s = st.scenario, e = s.environment;
    return `<aside class="intelligence-panel"><div class="panel-title"><div class="ai-orb">${icon('snow', 20)}</div><div><span class="mini-label">SEA-ICE OUTLOOK</span><h3>Watch the concentration shift.</h3></div></div><div class="large-number"><span id="forecast-average">${fmt(lerpArray(e.horizons, e.average, st.hour), 1)}</span><small>%</small></div><p class="muted">Regional ocean-cell mean at the selected horizon.</p>${lineChart([{ values: e.average, color: '#79d5f1', label: 'Forecast concentration' }], e.horizons.map((h) => h ? `+${h}h` : 'Now'), 145, '%')}
 ${smallLabel('Forecast engine', 'Random forest · 40 trees')}${smallLabel('Local grid', '10 km · synthetic')}${smallLabel('24 h nominal interval', `± ${fmt(e.interval_pp[3], 1)} pp`)}<div class="notice"><b>Uncertainty is visible.</b><p>Intervals are calibrated on synthetic scenes. Empirical coverage, including shortfalls, is available in Model Performance.</p></div><button class="text-button" data-page="performance">Inspect measured performance ${icon('arrow', 15)}</button></aside>`;
}
function icebergPanel() {
    const s = st.scenario, r = chosen();
    const selected = s.icebergs.find(b => b.id === st.selectedBerg) || s.icebergs[0];
    return `<aside class="intelligence-panel"><div class="panel-title"><div class="ai-orb">${icon('ice', 20)}</div><div><span class="mini-label">TRACKED IN THIS SCENARIO</span><h3>${s.icebergs.length} simulated icebergs</h3></div></div><div class="berg-list">${s.icebergs.map(b => { const cpa = r?.all_cpa?.find((v) => v.berg_id === b.id); return `<button data-berg="${b.id}" class="berg-row ${selected.id === b.id ? 'selected' : ''} ${b.id === 'SIM-X09' ? 'threat' : ''}"><span>${icon('ice', 19)}</span><div><b>${b.id}</b><small>${fmt(b.speed_km_h, 2)} km/h drift</small></div><div class="berg-cpa"><b>${cpa ? fmt(cpa.cpa_km, 1) : '--'}</b><small>CPA km</small></div></button>`; }).join('')}</div>
 <div class="berg-detail"><span class="mini-label">${selected.id} / SELECTED TRACK</span>${smallLabel('Estimated diameter', `${fmt(selected.size_km, 1)} km`)}${smallLabel('Drift heading', `${fmt(selected.heading_deg, 0)}° grid bearing`)}${smallLabel('24 h nominal radius', `${fmt(lerpArray(selected.times, selected.uncertainty_km, 24), 1)} km`)}<p class="tiny muted">Kalman-estimated state + forcing. Dotted envelope includes iceberg size, 8 km demo margin and nominal forecast uncertainty.</p></div></aside>`;
}
function sliders() { const o = st.scenario.options; return `<div class="priority-sliders">${[['safety', 'Safety priority', 'shield'], ['fuel', 'Fuel priority', 'fuel'], ['time', 'Time priority', 'clock']].map(([key, label, ic]) => `<label><span>${icon(ic, 15)} ${label}<b id="val-${key}">${o[key]}</b></span><input type="range" data-priority="${key}" min="0" max="100" step="5" value="${o[key]}" aria-label="${label}"/></label>`).join('')}</div>`; }
function routePanel() { const s = st.scenario, r = chosen(); return `<aside class="intelligence-panel"><div class="panel-title"><div class="ai-orb">${icon('sliders', 20)}</div><div><span class="mini-label">ROUTE OBJECTIVES</span><h3>Make the trade-off yours.</h3></div></div>${sliders()}<div class="waypoint-actions">${b('pick-start', 'Set origin', 'target', 'btn btn-small')}${b('pick-goal', 'Set destination', 'target', 'btn btn-small')}</div><div class="notice green"><b>Safety exclusions stay on.</b><p>Land buffer · ice &lt;78% · waves &lt;5 m · time-dependent iceberg clearance. Sliders cannot bypass these demo constraints.</p></div>${smallLabel('Search method', 'Time-labelled weighted A*')}${smallLabel('Search time', r ? `${fmt(r.compute_ms, 0)} ms` : '--')}${smallLabel('Expanded labels', r ? fmt(r.expanded_states) : '--')}<button class="text-button" data-action="whatif">Open what-if controls ${icon('arrow', 15)}</button><button class="text-button" data-action="reset-all">Restore default waypoints ${icon('reset', 15)}</button></aside>`; }
function voyagePanel() {
    const s = st.scenario, r = chosen();
    const dep = s.options.departure_hour;
    const progress = r ? clamp((st.elapsed - dep) / r.eta_h, 0, 1) : 0;
    const point = r ? pointAt(r, Math.max(st.elapsed, dep)) : s.mission.start;
    const nearest = Math.min(...s.icebergs.map(b => { const p = lerpArray(b.times, b.positions, st.elapsed); return Math.hypot(p[0] - point[0], p[1] - point[1]); }));
    return `<aside class="intelligence-panel"><div class="panel-title"><div class="ai-orb">${icon('ship', 20)}</div><div><span class="mini-label">SIMULATED VESSEL</span><h3>RV POLAR ONE</h3></div></div><div class="voyage-progress"><strong id="voyage-progress">${fmt(progress * 100, 1)}<small>%</small></strong><span>VOYAGE PROGRESS</span><div class="bar-track"><i id="voyage-progress-bar" style="width:${progress * 100}%"></i></div></div><div id="voyage-telemetry">${smallLabel('Scenario elapsed', `${fmt(st.elapsed, 2)} h`)}${smallLabel('Remaining time', r ? duration(Math.max(0, r.eta_h - (st.elapsed - dep))) : '--')}${smallLabel('Fuel remaining', r ? `${fmt(s.mission.fuel_capacity_l - r.fuel_l * progress)} L` : '--')}${smallLabel('Nearest iceberg', `${fmt(nearest, 1)} km`)}</div><div class="notice"><b>Time-synchronized preview.</b><p>At 1×, each real second represents one simulated minute. The vessel, drift positions and sea-ice field use the same scenario clock. Fuel remaining uses linear voyage interpolation.</p></div><div class="button-row">${b('play', st.playing ? 'Pause voyage' : 'Play voyage', st.playing ? 'pause' : 'play', 'btn btn-primary')}${b('reset-play', 'Reset', 'reset', 'btn')}</div></aside>`;
}
function refreshVoyage() {
    const s = st.scenario, r = chosen();
    if (!r)
        return;
    const dep = s.options.departure_hour;
    const progress = clamp((st.elapsed - dep) / r.eta_h, 0, 1), point = pointAt(r, Math.max(st.elapsed, dep));
    const nearest = Math.min(...s.icebergs.map(b => { const p = lerpArray(b.times, b.positions, st.elapsed); return Math.hypot(p[0] - point[0], p[1] - point[1]); }));
    if ($('#voyage-progress'))
        $('#voyage-progress').innerHTML = `${fmt(progress * 100, 1)}<small>%</small>`;
    if ($('#voyage-progress-bar'))
        $('#voyage-progress-bar').style.width = `${progress * 100}%`;
    if ($('#voyage-telemetry'))
        $('#voyage-telemetry').innerHTML = smallLabel('Scenario elapsed', `${fmt(st.elapsed, 2)} h`) + smallLabel('Remaining time', duration(Math.max(0, r.eta_h - (st.elapsed - dep)))) + smallLabel('Fuel remaining', `${fmt(s.mission.fuel_capacity_l - r.fuel_l * progress)} L`) + smallLabel('Nearest iceberg', `${fmt(nearest, 1)} km`);
}
function comparisonTable() { return `<section class="content-panel"><div class="section-heading"><h3>Every trade-off, side by side.</h3><span class="muted tiny">All values computed from route geometry and the same scenario.</span></div><div class="table-wrap"><table><thead><tr><th>Corridor policy</th><th>Distance</th><th>ETA</th><th>Fuel</th><th>Exposure index</th><th>Mean sea ice</th><th>Min. clearance</th><th>Est. CO₂</th></tr></thead><tbody>${st.scenario.routes.map(r => r.status === 'ok' ? `<tr class="${r.id === st.selectedRoute ? 'selected' : ''}" data-route="${r.id}"><td><i style="background:${colors[r.id]}"></i>${names[r.id]}</td><td>${fmt(r.distance_km, 1)} km</td><td>${duration(r.eta_h)}</td><td>${fmt(r.fuel_l)} L</td><td>${fmt(r.risk, 1)} /100</td><td>${fmt(r.ice_exposure_pct, 1)}%</td><td>+${fmt(r.min_clearance_km, 1)} km</td><td>${fmt(r.co2_kg)} kg</td></tr>` : `<tr><td>${names[r.id]}</td><td colspan="7">No admissible route: ${esc(r.reason)}</td></tr>`).join('')}</tbody></table></div><p class="table-note">Clearance is the distance beyond a moving exclusion envelope, not distance to the iceberg center. CO₂ uses an illustrative 2.68 kg/L combustion-only factor. Equal corridors are allowed when objectives agree.</p></section>`; }
function mapBoard() {
    let panel = st.page === 'ice' ? seaIcePanel() : st.page === 'icebergs' ? icebergPanel() : st.page === 'routes' ? routePanel() : st.page === 'voyage' ? voyagePanel() : missionPanel();
    return `<div class="mission-layout">${mapCard()}${panel}</div>${timeline()}${routeCards()}${st.page === 'routes' ? comparisonTable() : ''}${st.page === 'voyage' ? `<div class="notice wide">${icon('info', 17)} Simulation is not vessel telemetry. Use the hazard button to replan from the current simulated position. Reset restores the original mission.</div>` : ''}`;
}
function explanation() {
    const s = st.scenario, r = chosen();
    if (!r)
        return `<div class="notice"><b>No admissible route.</b><p>The engine will not draw a fallback line through a blocked corridor. Choose valid offshore waypoints or review scenario severity.</p></div>`;
    const fast = s.routes.find(v => v.id === 'fastest' && v.status === 'ok');
    return `<div class="explanation-intro"><span class="insight-badge">${icon('shield', 16)} CONSTRAINTS CHECKED, TRADE-OFFS EXPOSED</span><h2>${names[r.id]} is a computed choice,<br>not a decorative green line.</h2><p>The engine searches a time-labelled grid, checks moving iceberg envelopes, then independently re-evaluates the returned geometry. Fuel and exposure follow the route, not preset labels.</p></div>
 <div class="explanation-facts"><article><span>SEA-ICE EXPOSURE</span><b>${fmt(r.ice_exposure_pct, 1)}<small>%</small></b><p>Distance-weighted concentration along the voyage.</p></article><article><span>MODELED CLEARANCE</span><b>+${fmt(r.min_clearance_km, 1)}<small>km</small></b><p>Minimum margin beyond the moving exclusion envelope.</p></article><article><span>FUEL VS FASTEST</span><b>${fast ? sign(r.fuel_l - fast.fuel_l, 0) : '--'}<small>L</small></b><p>Same scenario, different speed and objective policy.</p></article></div>
 ${s.delta ? `<div class="delta-summary"><h3>What changed after the new observation?</h3><div>${smallLabel('Previous → alternative exposure', `${fmt(s.delta.previous_risk, 1)} → ${fmt(s.delta.new_risk, 1)} /100`)}${smallLabel('First old-route envelope breach', s.delta.lead_time_h != null ? `+${fmt(s.delta.lead_time_h, 1)} h` : 'Not observed')}${smallLabel('Distance / arrival change', `${sign(s.delta.distance_km)} km / ${sign(s.delta.delay_minutes, 0)} min`)}${smallLabel('Fuel change', `${sign(s.delta.fuel_l, 0)} L (${sign(s.delta.fuel_pct)}%)`)}</div><p class="tiny muted">${esc(s.delta.basis)} A safer alternative can cost more fuel; the display does not force a savings claim.</p></div>` : ''}
 <div class="notice"><b>What this explanation is not.</b><p>These are transparent policy contributions, not SHAP values. Exposure scores are not collision probabilities. Weighted A* uses a 3.2 heuristic weight and 0.75 h label buckets, so global optimality is not claimed.</p></div>`;
}
function copilot() { return `<section class="content-panel copilot-panel"><div class="section-heading"><h3>${icon('spark', 19)} POLAR COPILOT</h3>${badge('STATE-GROUNDED', 'cyan')}</div><p class="muted">Ask about the current mission. Answers are deterministic and linked to calculated values; no API key or external LLM is used.</p><div class="copilot-presets">${['Why this route?', 'Why did the route change?', 'What is the biggest hazard?', 'What happens over the next 24 hours?', 'Can we reduce fuel?'].map(q => `<button data-question="${esc(q)}">${esc(q)}</button>`).join('')}</div><form id="copilot-form"><input id="copilot-input" maxlength="1000" placeholder="Ask about this scenario..." aria-label="Copilot question"/><button class="btn btn-primary" type="submit">Ask ${icon('arrow', 16)}</button></form><div id="copilot-answer" class="copilot-answer">${st.copilotAnswer ? esc(st.copilotAnswer) : 'Try “Why did the route change?” after injecting a hazard.'}</div></section>`; }
function decisionPage() { const r = chosen(); return `<div class="decision-grid"><section class="content-panel">${explanation()}</section><section class="content-panel"><div class="section-heading"><h3>Exposure, broken down.</h3>${badge('TRANSPARENT POLICY')}</div><p class="muted">These contributions sum to the selected route’s time-weighted exposure index.</p>${r ? bars(r.risk_contributions) : ''}<div class="formula">R = 0.38 I + 0.32 B + 0.14 W<br>+ 0.08 C + 0.08 U</div><p class="tiny muted">I: normalized concentration · B: proximity kernel · W: wave severity · C: current magnitude · U: forecast interval width. All normalized to a 0–100 index.</p><div class="resilience"><span class="mini-label">HEURISTIC ROUTE RESILIENCE</span><strong>${st.scenario.resilience ?? '--'}<small>/100</small></strong><p>50% low exposure + 20% available policies + 20% fuel reserve + 10% scenario uncertainty allowance. Not a certification.</p></div>${b('whatif', 'Explore a what-if scenario', 'sliders', 'btn btn-block')}</section></div>${copilot()}${comparisonTable()}`; }
function dataPage() {
    return `<div class="data-banner"><div>${icon('database', 28)}<div><span class="mini-label">SOURCE OF TRUTH</span><h2>Demo mode, by design.</h2><p>The bundled scenario runs without internet. Public feed integrations are not silently simulated.</p></div></div>${badge('NO LIVE FEEDS CONNECTED', 'amber')}</div><div class="source-grid">${st.boot.sources.map((s) => `<article class="source-card"><div class="source-top"><span class="mini-label">${esc(s.kind)}</span>${badge(s.status, s.status === 'BUNDLED' ? 'green' : s.status === 'NOT CONNECTED' ? 'muted' : 'cyan')}</div><h3>${esc(s.name)}</h3><p>${esc(s.note)}</p><div class="source-meta"><span>${esc(s.resolution)}</span>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="Official source documentation">Source ${icon('link', 13)}</a>` : ''}</div></article>`).join('')}</div>
 <section class="content-panel"><div class="section-heading"><div><h3>Bring an observation overlay.</h3><p class="muted">Upload CSV or JSON with latitude, longitude, concentration (0–1), observed_at and optional source.</p></div><div class="button-row"><a class="btn" href="/api/data/template.csv" download>${icon('download', 16)}CSV template</a><label class="btn btn-primary" for="data-file">${icon('upload', 16)}Import observations</label><input hidden type="file" id="data-file" accept=".csv,.json"/></div></div><div class="notice"><b>Preview, not production ingestion.</b><p>Imported points are validated and drawn on the map. They do not silently replace the synthetic forecasting or routing grid. Full public-data ingestion requires resolution, projection, timestamps, missing values and model-domain checks.</p></div><div id="import-status" class="import-status">${esc(st.sourceMessage || 'No user observations imported.')}</div>${st.imported.length ? `<div class="table-wrap"><table><thead><tr><th>Latitude</th><th>Longitude</th><th>Concentration</th><th>Observed at</th><th>Source</th></tr></thead><tbody>${st.imported.slice(0, 8).map(p => `<tr><td>${fmt(p.latitude, 4)}</td><td>${fmt(p.longitude, 4)}</td><td>${fmt(p.concentration * 100, 1)}%</td><td>${esc(p.observed_at)}</td><td>${esc(p.source)}</td></tr>`).join('')}</tbody></table></div>${b('show-import', 'Show points on map', 'globe', 'btn')}` : ''}</section>`;
}
function performancePage() {
    const m = st.boot.metrics.sea_ice, im = st.boot.metrics.icebergs, at24 = m.horizons.find((h) => h.horizon_h === 24);
    const f = m.feature_importance;
    return `<div class="validation-banner">${icon('chart', 24)}<div><b>Measured on synthetic holdout data. Not Antarctic field accuracy.</b><p>Whole scenes are separated between training, calibration and evaluation. No production success rate is claimed.</p></div>${badge('REPRODUCIBLE', 'green')}</div><section class="metric-cards"><article><span class="mini-label">24 h SEA-ICE MAE</span><strong>${fmt(at24.mae_pp, 2)}<small>pp</small></strong><p>Persistence baseline: ${fmt(at24.persistence_mae_pp, 2)} pp</p></article><article><span class="mini-label">48 h ICEBERG FDE</span><strong>${fmt(im.horizons[3].fde_km, 2)}<small>km</small></strong><p>${im.test_tracks} independent synthetic tracks</p></article><article><span class="mini-label">HELD-OUT SEA-ICE ROWS</span><strong>${fmt(m.test_samples)}</strong><p>${m.test_scenes} disjoint test scenes</p></article><article><span class="mini-label">SCENARIO COMPUTE TIME</span><strong>${fmt(st.scenario.compute_ms, 0)}<small>ms</small></strong><p>Measured backend generation, includes four policies</p></article></section>
 <div class="two-column"><section class="content-panel"><div class="section-heading"><h3>Forecast skill vs persistence</h3><span class="tiny muted">MAE / percentage points</span></div>${lineChart([{ values: m.horizons.map((r) => r.mae_pp), color: '#6cd4ef', label: 'Random forest MAE' }, { values: m.horizons.map((r) => r.persistence_mae_pp), color: '#f5b778', label: 'Persistence MAE' }], m.horizons.map((r) => `+${r.horizon_h}h`), 205)}<div class="chart-legend"><span><i style="background:#6cd4ef"></i>Random forest</span><span><i style="background:#f5b778"></i>Persistence</span></div></section><section class="content-panel"><div class="section-heading"><h3>Trajectory forecast errors</h3><span class="tiny muted">Displacement / km</span></div>${lineChart([{ values: im.horizons.map((r) => r.ade_km), color: '#50e2bc', label: 'Average displacement error' }, { values: im.horizons.map((r) => r.fde_km), color: '#91aaff', label: 'Final displacement error' }], im.horizons.map((r) => `+${r.horizon_h}h`), 205)}<div class="chart-legend"><span><i style="background:#50e2bc"></i>ADE</span><span><i style="background:#91aaff"></i>FDE</span></div></section></div>
 <section class="content-panel"><div class="section-heading"><h3>Sea-ice evaluation ledger</h3>${badge('SYNTHETIC SCENES', 'amber')}</div><div class="table-wrap"><table><thead><tr><th>Horizon</th><th>RF MAE (pp)</th><th>RMSE (pp)</th><th>R², not accuracy</th><th>Baseline MAE (pp)</th><th>Interval ± (pp)</th><th>Test coverage</th></tr></thead><tbody>${m.horizons.map((h) => `<tr><td>+${h.horizon_h} h</td><td>${fmt(h.mae_pp, 3)}</td><td>${fmt(h.rmse_pp, 3)}</td><td>${fmt(h.r2, 4)}</td><td>${fmt(h.persistence_mae_pp, 3)}</td><td>${fmt(h.interval_half_width_pp, 3)}</td><td>${fmt(h.test_coverage * 100, 1)}%</td></tr>`).join('')}</tbody></table></div><p class="table-note">${esc(m.interval_note)} Long-horizon empirical coverage falls below the nominal 90%; the UI reports that shortfall rather than hiding it.</p></section>
 <div class="two-column"><section class="content-panel"><h3>What the trained forest used</h3><p class="muted tiny">Tree impurity importance. Not causal attribution and not SHAP.</p>${Object.entries(f).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="feature-bar"><span>${esc(k.replaceAll('_', ' '))}</span><div><i style="width:${v * 100}%"></i></div><b>${fmt(v * 100, 1)}%</b></div>`).join('')}</section><section class="content-panel"><h3>A reproducible experiment</h3>${smallLabel('Random seed', '26059')}${smallLabel('Train / calibration / test scenes', `${m.train_scenes} / ${m.calibration_scenes} / ${m.test_scenes}`)}${smallLabel('Train / calibration / test rows', `${fmt(m.train_samples)} / ${fmt(m.calibration_samples)} / ${fmt(m.test_samples)}`)}<p class="muted">Re-run <code>python -m ml.train</code> and <code>python -m ml.evaluate_icebergs</code> after installing development requirements.</p><button class="text-button" data-action="download-metrics">Download evaluation JSON ${icon('download', 16)}</button><div class="notice"><b>Open limitations</b><p>No real Antarctic training data, no observed-track validation and no vessel-calibrated fuel model. Deep temporal architectures remain future work, not silently fabricated features.</p></div></section></div>`;
}
function architecturePage() { const stages = [['database', '01 / OBSERVATIONS', 'Synthetic sea ice, wind, currents, iceberg history and vessel parameters.', 'Local JSON / analytic fields'], ['snow', '02 / FORECASTS', 'Trained random forest for sea ice. Kalman + forcing for iceberg movement.', '6 / 12 / 24 / 48 / 72 h'], ['shield', '03 / FUTURE RISK', 'Time-aligned concentration, moving exclusion envelopes and uncertainty.', 'Transparent policy contributions'], ['route', '04 / ROUTE SEARCH', 'Four time-labelled weighted-A* policies. Hard exclusions on every edge.', 'Distance / exposure / fuel / time'], ['spark', '05 / DECISION', 'Independent path validation, analytic CPA, measured deltas and explanations.', 'Human operator remains responsible']]; return `<section class="architecture-hero"><span class="eyebrow">POLAR PULSE / SYSTEM BLUEPRINT</span><h2>One intelligence chain.<br><em>Five accountable layers.</em></h2><p>The prototype couples predictions to decisions, rather than stopping at a forecast chart.</p><div class="pipeline">${stages.map(([ic, num, title, tag]) => `<article><span class="pipeline-icon">${icon(ic, 27)}</span><small>${num}</small><p>${title}</p><span class="pipeline-tag">${tag}</span></article>`).join('')}</div></section><div class="two-column"><section class="content-panel"><h3>Built for a dependable local demo</h3>${chips(['TypeScript', 'FastAPI', 'NumPy', 'scikit-learn training', 'Shapely', 'pyproj', 'Local SVG map'])}<p class="muted">The interface uses compiled ES modules and an offline SVG/canvas geospatial layer. FastAPI serves both the API and the built interface from one local port. Runtime forecasts load numerical JSON trees, not executable pickle files.</p>${smallLabel('One command', 'python start.py')}${smallLabel('API health', 'GET /api/health')}${smallLabel('Scenario engine', 'POST /api/scenario/simulate')}${smallLabel('Risk inspection', 'POST /api/risk/inspect')}<a class="btn" href="/docs" target="_blank" rel="noopener">Interactive API documentation ${icon('link', 15)}</a></section><section class="content-panel"><h3>Research prototype. Not a navigation product.</h3><div class="limit-list">${['No bathymetry, charted obstructions or maritime traffic rules.', 'No real vessel ice class, manoeuvrability or calibrated propulsion data.', 'No live satellite identification or weather/ocean ingestion.', 'Coarse reference shoreline, not appropriate for harbour navigation.', 'No calibrated collision probability, certified safe route or optimality guarantee.', 'No commercial deployment, agency approval or real-world accuracy claim.'].map(v => `<div>${icon('info', 16)}<p>${v}</p></div>`).join('')}</div></section></div><section class="content-panel"><div class="section-heading"><h3>The next engineering milestones</h3><span class="muted">Documented future work, not completed features</span></div><div class="future-grid"><div><b>01 / Real-data alignment</b><p>Product adapters, quality flags, coordinate transforms, validated time alignment and versioned data lineage.</p></div><div><b>02 / Scientific validation</b><p>Season- and region-held-out Antarctic evaluation; drift-track assimilation; calibrated uncertainty by horizon.</p></div><div><b>03 / Operational review</b><p>Marine charts, bathymetry, vessel constraints and expert-in-the-loop trials before any maritime use.</p></div></div></section>`; }
function render() {
    if (!st.scenario)
        return;
    document.querySelectorAll('[data-page]').forEach(el => { if (el.classList.contains('nav-item'))
        el.classList.toggle('active', el.dataset.page === st.page); });
    const select = $('#mission-select');
    if (select)
        select.value = st.scenario.options.mission;
    const isMap = ['mission', 'ice', 'icebergs', 'routes', 'voyage'].includes(st.page);
    $('#main').innerHTML = heading() + stageStrip() + (st.error ? `<div class="error-banner">${icon('alert', 17)}<span>${esc(st.error)}</span>${b('dismiss-error', 'Dismiss', undefined, 'btn btn-tiny')}</div>` : '') + (isMap ? kpis() + mapBoard() : st.page === 'decision' ? decisionPage() : st.page === 'data' ? dataPage() : st.page === 'performance' ? performancePage() : architecturePage());
    renderModal();
}
function updateMap() { if ($('#map-render'))
    $('#map-render').innerHTML = mapSVG(st); if ($('#time-label'))
    $('#time-label').textContent = st.hour === 0 ? 'Present' : `T + ${fmt(st.hour, 1)} h`; if ($('#map-horizon'))
    $('#map-horizon').textContent = st.hour === 0 ? 'NOW' : `+${fmt(st.hour, 1)} H`; if ($('#forecast-average'))
    $('#forecast-average').textContent = fmt(lerpArray(st.scenario.environment.horizons, st.scenario.environment.average, st.hour), 1); }
function toast(text, type = '') { const e = document.createElement('div'); e.className = `toast ${type}`; e.innerHTML = `${icon(type === 'error' ? 'alert' : 'check', 17)}<span>${esc(text)}</span>`; $('#toast-root').append(e); setTimeout(() => e.remove(), 4800); }
async function commit(changes, resetClock = false) {
    if (!st.scenario)
        return;
    const id = ++requestId;
    const opts = { ...st.scenario.options, ...changes };
    st.busy = true;
    st.error = null;
    render();
    try {
        const result = await api('/api/scenario/simulate', opts);
        if (id !== requestId)
            return;
        st.scenario = result;
        st.busy = false;
        st.copilotAnswer = '';
        if (resetClock) {
            st.elapsed = opts.departure_hour;
            st.hour = opts.departure_hour;
            st.playing = false;
        }
        if (!chosen()) {
            const first = result.routes.find((r) => r.status === 'ok');
            if (first)
                st.selectedRoute = first.id;
            else
                toast('No admissible route. Review waypoints or the scenario constraints.', 'error');
        }
        render();
    }
    catch (e) {
        if (id !== requestId)
            return;
        st.busy = false;
        st.error = e.message;
        render();
    }
}
function setPage(p) { st.page = p; st.modal = null; st.picking = null; if (p === 'icebergs' && !st.selectedBerg)
    st.selectedBerg = st.scenario.icebergs[0].id; if (p === 'ice')
    st.layer = 'ice'; render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
async function simulateHazard() { if (st.busy)
    return; const r = chosen(); const change = { hazard: true }; if (st.elapsed > st.scenario.options.departure_hour + .01 && r) {
    change.start = pointAt(r, st.elapsed);
    change.departure_hour = st.elapsed;
} st.playing = false; await commit(change); if (!st.error)
    toast('New synthetic observation assimilated. Corridors recalculated.'); }
function renderModal() {
    const root = $('#modal-root');
    if (!st.modal) {
        root.innerHTML = '';
        return;
    }
    let title = '', content = '';
    const s = st.scenario;
    if (st.modal === 'explain') {
        title = 'Why this corridor?';
        content = explanation();
    }
    else if (st.modal === 'whatif') {
        title = 'What-if laboratory';
        content = `<p class="modal-sub">Change a forcing assumption. The forecast, drift, exposure field and all four routes will be recomputed.</p><div class="whatif-grid">${[['wind', 'Wind forcing', 'wind', .5, 2], ['current', 'Ocean current', 'wave', .5, 2], ['ice', 'Ice concentration multiplier', 'snow', .5, 1.6], ['drift', 'Iceberg drift multiplier', 'ice', .5, 2]].map(([key, label, ic, min, max]) => `<label class="whatif-control"><span>${icon(ic, 20)}<b>${label}</b><strong id="val-${key}">${fmt(s.options[key], 2)}×</strong></span><input data-whatif="${key}" type="range" min="${min}" max="${max}" step=".05" value="${s.options[key]}" aria-label="${label}"/><small>${min}× baseline <em>${max}×</em></small></label>`).join('')}</div><div class="notice"><b>No predetermined improvement.</b><p>Stronger wind or ice can make a route worse or leave no admissible path. The interface will report that outcome instead of fabricating a solution.</p></div><div class="modal-actions">${b('reset-forcing', 'Reset forcing', 'reset', 'btn')}${b('close-modal', 'Return to mission', 'arrow', 'btn btn-primary')}</div>`;
    }
    else if (st.modal === 'cell') {
        const v = st.inspector;
        title = 'Inspect a future map cell';
        content = v ? `<div class="coordinate-heading">${fmt(Math.abs(v.lat), 4)}° S <span>/</span> ${fmt(v.lon, 4)}° E ${badge(`T + ${fmt(v.hour, 1)} h`, 'cyan')}</div><div class="cell-stats"><div><span>Sea-ice concentration</span><b>${fmt(v.ice_pct, 1)}<small>%</small></b></div><div><span>Exposure index</span><b>${fmt(v.risk, 1)}<small>/100</small></b></div><div><span>Nearest iceberg</span><b>${fmt(v.nearest_berg_km, 1)}<small>km</small></b></div></div>${bars(v.contributions)}<p class="tiny muted">${esc(v.note)}</p>` : '<div class="loading-note">Calculating contributions for the selected cell...</div>';
    }
    else if (st.modal === 'export') {
        title = 'Mission briefing';
        content = `<div class="report-preview"><span class="eyebrow">POLAR PULSE / ${s.mission.id}</span><h2>${esc(s.mission.label)}</h2><p>Includes route comparisons, the active scenario, model-derived metrics, provenance and limitations.</p>${smallLabel('Scenario type', 'Synthetic research demonstration')}${smallLabel('Selected corridor', names[st.selectedRoute])}${smallLabel('Generated', new Date(s.computed_at).toLocaleString())}</div><div class="modal-actions">${b('export-json', 'Download full JSON', 'download', 'btn')}${b('print-report', 'Open printable briefing', 'file', 'btn btn-primary')}</div><p class="tiny muted">The printable briefing can be saved as PDF using your browser’s Print dialog.</p>`;
    }
    else if (st.modal === 'help') {
        title = 'A demo you can confidently explain.';
        content = `<div class="help-brand">${logo()}<div><h2>POLAR PULSE</h2><p>Predict. Protect. Navigate.</p></div></div><p>Built for the supplied SIH PS 26059 brief. This is an independent research prototype, not an NCPOR or MoES deployment or endorsement.</p><div class="help-grid">${[['J', 'Start / exit judge demo'], ['H', 'Inject a synthetic hazard'], ['Space', 'Play / pause voyage'], ['F', 'Fullscreen'], ['Esc', 'Close a panel']].map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div><div class="notice"><b>What is real in this prototype?</b><p>The model training, forecast inference, Kalman filtering, route search, route metrics, uncertainty displays and API requests execute. The environmental data and vessel are simulated. The coast and Bharati reference coordinate come from public reference sources.</p></div><p class="muted">Launch locally with <code>python start.py</code>. No Node server, paid map token, external LLM or internet connection is required after package installation.</p>`;
    }
    else if (st.modal === 'judge-summary') {
        title = 'From a future hazard to an explained decision.';
        const d = s.delta;
        content = `<div class="demo-end"><span class="insight-badge">${icon('check', 17)} GUIDED SCENARIO COMPLETE</span><h2>We did not just see the ice.<br>We changed the decision.</h2>${d ? `<div class="explanation-facts"><article><span>PREDICTIVE LEAD TIME</span><b>${d.lead_time_h != null ? fmt(d.lead_time_h, 1) : '--'}<small>h</small></b></article><article><span>NEW CLEARANCE MARGIN</span><b>+${fmt(d.new_clearance_km, 1)}<small>km</small></b></article><article><span>ADDITIONAL DISTANCE</span><b>${sign(d.distance_km)}<small>km</small></b></article></div><p>The alternative changes fuel by <b>${sign(d.fuel_l, 0)} L</b> and arrival by <b>${sign(d.delay_minutes, 0)} minutes</b>. Every number is derived from this scenario.</p>` : ''}<div class="notice green"><b>The differentiator</b><p>A connected forecast → future exposure → time-aware route → independent validation → explanation loop. The demo shows its uncertainty and its costs.</p></div></div><div class="modal-actions">${b('export', 'Export briefing', 'download', 'btn')}${b('judge-restart', 'Replay the story', 'play', 'btn btn-primary')}</div>`;
    }
    root.innerHTML = `<div class="modal-backdrop" data-backdrop="true"><section class="modal ${['explain', 'judge-summary'].includes(st.modal) ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close panel">${icon('cross', 21)}</button></div><div class="modal-body">${content}</div></section></div>`;
}
async function ask(question) { st.copilotAnswer = 'Reading the active scenario...'; if ($('#copilot-answer'))
    $('#copilot-answer').textContent = st.copilotAnswer; try {
    const a = await api('/api/copilot', { question, options: st.scenario.options, route_id: st.selectedRoute });
    st.copilotAnswer = a.answer;
    if ($('#copilot-answer'))
        $('#copilot-answer').textContent = a.answer;
}
catch (e) {
    st.copilotAnswer = e.message;
    if ($('#copilot-answer'))
        $('#copilot-answer').textContent = st.copilotAnswer;
} }
function printReport() {
    const s = st.scenario, w = window.open('', '_blank');
    if (!w) {
        toast('Allow pop-ups to open the printable mission briefing.', 'error');
        return;
    }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>POLAR PULSE Mission Briefing</title><style>body{font:14px/1.6 system-ui;color:#173044;max-width:960px;margin:45px auto;padding:20px}h1{font-size:34px;margin-bottom:0}h2{border-bottom:1px solid #ccd8df;padding-bottom:8px}small{color:#617486}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:10px;border:1px solid #d5dfe4;text-align:left}.note{padding:15px;background:#edf5f7;border-left:4px solid #1895ad}button{padding:10px 18px;cursor:pointer}@media print{button{display:none}body{margin:0;padding:0}.note{break-inside:avoid}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><h1>POLAR PULSE</h1><small>PREDICT. PROTECT. NAVIGATE. / PS 26059</small><h2>${esc(s.mission.label)}</h2><p><b>Mission:</b> ${s.mission.id}<br><b>Vessel:</b> ${esc(s.mission.vessel)} (fictional)<br><b>Data:</b> Synthetic research scenario<br><b>Computed:</b> ${esc(s.computed_at)}</p><div class="note"><b>Research demonstration only. NOT FOR NAVIGATION.</b><br>${esc(s.disclaimer)}</div><h2>Calculated corridor comparison</h2><table><thead><tr><th>Policy</th><th>Distance km</th><th>ETA h</th><th>Fuel L</th><th>Exposure /100</th><th>Clearance km</th></tr></thead><tbody>${s.routes.map(r => r.status === 'ok' ? `<tr><td>${names[r.id]}</td><td>${fmt(r.distance_km, 2)}</td><td>${fmt(r.eta_h, 2)}</td><td>${fmt(r.fuel_l, 1)}</td><td>${fmt(r.risk, 2)}</td><td>${fmt(r.min_clearance_km, 2)}</td></tr>` : `<tr><td>${names[r.id]}</td><td colspan="5">No admissible path</td></tr>`).join('')}</tbody></table>${s.delta ? `<h2>Updated-observation reroute</h2><p>Predicted lead time: ${fmt(s.delta.lead_time_h, 2)} hours.<br>Distance change: ${sign(s.delta.distance_km, 2)} km.<br>Arrival change: ${sign(s.delta.delay_minutes, 1)} min.<br>Fuel change: ${sign(s.delta.fuel_l, 1)} L.<br>Previous to new exposure: ${fmt(s.delta.previous_risk, 2)} → ${fmt(s.delta.new_risk, 2)} /100.</p><p>${esc(s.delta.basis)}</p>` : ''}<h2>Methods and assumptions</h2><p>40-tree random forest trained on independent synthetic scenes; nominal calibrated intervals; Kalman position/velocity filtering with vector forcing; time-labelled weighted A* (3.2 heuristic weight, 0.75 h buckets); geodesic route lengths; piecewise-linear analytic closest approach; independent path validation. Fuel uses an illustrative hotel-load, cubic-speed, ice-drag and wave-penalty model. No real-vessel calibration.</p><h2>Provenance</h2><ul>${st.boot.sources.map((x) => `<li><b>${esc(x.name)}</b>: ${esc(x.status)}. ${esc(x.note)}${x.url ? `<br><small>${esc(x.url)}</small>` : ''}</li>`).join('')}</ul><h2>Scientific limitations</h2><p>No real Antarctic forecast validation, calibrated collision probabilities, bathymetry, operational vessel ice-class model or certified navigation safety. Public observational imports are overlays only. This prototype must not be used for real voyages.</p></body></html>`);
    w.document.close();
}
const judgeCaptions = ['A research vessel is heading toward an offshore waypoint near Bharati.', 'Forecast concentration changes over 24 hours. It is not a static ice map.', 'Iceberg observations become trajectories with explicit uncertainty.', 'Four corridor policies expose safety, fuel and time trade-offs.', 'Inject a new synthetic iceberg observation into the future corridor.', 'The original route now breaches a predicted exclusion envelope.', 'An alternative is calculated and independently checked.', 'Every detour has a reason, a fuel cost and an arrival trade-off.', 'Measured scenario outcomes. No hard-coded success numbers.'];
async function applyJudgeStep(index) {
    if (!st.judge)
        return;
    st.judgeStep = clamp(index, 0, 8);
    st.modal = null;
    const i = st.judgeStep;
    if (i === 0) {
        st.page = 'mission';
        st.hour = 0;
        st.layer = 'ice';
    }
    if (i === 1) {
        st.page = 'ice';
        st.hour = 24;
        st.layer = 'ice';
    }
    if (i === 2) {
        st.page = 'icebergs';
        st.hour = 12;
        st.selectedBerg = 'SIM-B17';
        st.trajectories = true;
    }
    if (i === 3) {
        st.page = 'routes';
        st.hour = 0;
        st.selectedRoute = 'recommended';
    }
    if (i === 4) {
        st.page = 'mission';
        st.hour = 0;
        if (!st.scenario.options.hazard)
            await commit({ hazard: true });
    }
    if (i === 5) {
        st.page = 'icebergs';
        st.hour = st.scenario.delta?.lead_time_h ?? 12;
        st.layer = 'risk';
        st.selectedBerg = 'SIM-X09';
        const a = st.scenario.alerts.find(a => a.id === 'threat');
        if (a?.xy) {
            const p = project(a.xy);
            st.zoom = 1.6;
            st.pan = [W / 2 - p[0] * st.zoom, H / 2 - p[1] * st.zoom];
        }
    }
    if (i === 6) {
        st.page = 'mission';
        st.hour = 0;
        st.layer = 'ice';
        st.selectedRoute = 'recommended';
        st.zoom = 1;
        st.pan = [0, 0];
    }
    if (i === 7) {
        st.page = 'decision';
    }
    if (i === 8) {
        st.page = 'mission';
        st.modal = 'judge-summary';
        st.judgePaused = true;
    }
    if (!st.judge)
        return;
    render();
    toast(judgeCaptions[i]);
    scheduleJudge();
}
function scheduleJudge() { window.clearTimeout(judgeTimer); if (st.judge && !st.judgePaused && st.judgeStep < 8)
    judgeTimer = window.setTimeout(() => applyJudgeStep(st.judgeStep + 1), 6500); }
async function startJudge() { window.clearTimeout(judgeTimer); st.playing = false; st.judge = true; st.judgePaused = false; st.judgeStep = 0; st.zoom = 1; st.pan = [0, 0]; st.elapsed = 0; st.modal = null; st.page = 'mission'; st.selectedRoute = 'recommended'; await commit(DEFAULT, true); if (st.judge)
    await applyJudgeStep(0); }
function exitJudge() { st.judge = false; window.clearTimeout(judgeTimer); st.modal = null; render(); }
function playToggle() { if (st.judge)
    exitJudge(); if (!chosen())
    return; if (st.elapsed >= chosen().points.at(-1)[2]) {
    st.elapsed = st.scenario.options.departure_hour;
    st.hour = st.elapsed;
} st.playing = !st.playing; lastTick = performance.now(); render(); }
function liveTick() {
    const now = performance.now();
    if (st.playing && !st.busy && chosen()) {
        const delta = lastTick ? Math.min((now - lastTick) / 1000, .5) : .2;
        const r = chosen();
        st.elapsed = Math.max(st.elapsed, st.scenario.options.departure_hour) + delta * st.speed / 60;
        const end = r.points.at(-1)[2];
        if (st.elapsed >= end) {
            st.elapsed = end;
            st.playing = false;
            toast('Simulated voyage reached the offshore waypoint.');
        }
        st.hour = st.elapsed;
        updateMap();
        const slider = $('#time-slider');
        if (slider)
            slider.value = String(st.hour);
        if (st.page === 'voyage')
            refreshVoyage();
    }
    lastTick = now;
}
async function onAction(action) {
    if (action === 'judge' || action === 'judge-restart') {
        await startJudge();
        return;
    }
    if (action === 'exit-judge') {
        exitJudge();
        return;
    }
    if (action === 'judge-pause') {
        st.judgePaused = !st.judgePaused;
        scheduleJudge();
        render();
        return;
    }
    if (action === 'judge-next') {
        st.judgePaused = true;
        await applyJudgeStep(st.judgeStep + 1);
        return;
    }
    if (action === 'hazard') {
        await simulateHazard();
        return;
    }
    if (action === 'clear-hazard') {
        await commit({ hazard: false }, true);
        return;
    }
    if (action === 'play') {
        playToggle();
        return;
    }
    if (action === 'reset-play') {
        st.playing = false;
        st.elapsed = st.scenario.options.departure_hour;
        st.hour = st.elapsed;
        render();
        return;
    }
    if (action === 'reset-all') {
        st.playing = false;
        st.elapsed = 0;
        st.selectedRoute = 'recommended';
        await commit(DEFAULT, true);
        return;
    }
    if (action === 'reset-forcing') {
        await commit({ wind: 1, current: 1, ice: 1, drift: 1 });
        return;
    }
    if (action === 'explain') {
        st.modal = 'explain';
        renderModal();
        return;
    }
    if (action === 'whatif') {
        st.modal = 'whatif';
        renderModal();
        return;
    }
    if (action === 'export') {
        st.modal = 'export';
        renderModal();
        return;
    }
    if (action === 'help') {
        st.modal = 'help';
        renderModal();
        return;
    }
    if (action === 'close-modal') {
        st.modal = null;
        renderModal();
        return;
    }
    if (action === 'export-json') {
        try {
            const r = await api('/api/reports/mission', st.scenario.options);
            download('POLAR_PULSE_mission_briefing.json', JSON.stringify(r, null, 2));
            toast('Mission data and methodology exported.');
        }
        catch (e) {
            toast(e.message, 'error');
        }
        return;
    }
    if (action === 'print-report') {
        printReport();
        return;
    }
    if (action === 'download-metrics') {
        download('POLAR_PULSE_model_evaluation.json', JSON.stringify(st.boot.metrics, null, 2));
        return;
    }
    if (action === 'currents') {
        st.currents = !st.currents;
        render();
        return;
    }
    if (action === 'trajectories') {
        st.trajectories = !st.trajectories;
        render();
        return;
    }
    if (action === 'zoom-in') {
        st.zoom = clamp(st.zoom * 1.2, 1, 4);
        updateMap();
        return;
    }
    if (action === 'zoom-out') {
        st.zoom = clamp(st.zoom / 1.2, 1, 4);
        if (st.zoom === 1)
            st.pan = [0, 0];
        updateMap();
        return;
    }
    if (action === 'focus-hazard') {
        const a = st.scenario.alerts.find(a => a.id === 'threat');
        if (a?.xy) {
            const p = project(a.xy);
            st.zoom = 1.9;
            st.pan = [W / 2 - p[0] * st.zoom, H / 2 - p[1] * st.zoom];
            updateMap();
        }
        return;
    }
    if (action === 'recenter') {
        st.zoom = 1;
        st.pan = [0, 0];
        updateMap();
        return;
    }
    if (action === 'pick-start' || action === 'pick-goal') {
        st.picking = action === 'pick-start' ? 'start' : 'goal';
        render();
        return;
    }
    if (action === 'show-import') {
        setPage('mission');
        return;
    }
    if (action === 'dismiss-error') {
        st.error = null;
        render();
        return;
    }
    if (action === 'fullscreen') {
        try {
            if (document.fullscreenElement)
                await document.exitFullscreen();
            else
                await document.documentElement.requestFullscreen();
        }
        catch {
            toast('Use your browser fullscreen shortcut (F11).');
        }
        return;
    }
}
document.addEventListener('click', async (e) => {
    const target = e.target;
    if (target.classList.contains('modal-backdrop')) {
        st.modal = null;
        renderModal();
        return;
    }
    const el = target.closest('[data-action],[data-page],[data-route],[data-layer],[data-hour],[data-berg],[data-alert],[data-question]');
    if (!el || !st.scenario)
        return;
    if (el.dataset.action) {
        await onAction(el.dataset.action);
        return;
    }
    if (el.dataset.page) {
        setPage(el.dataset.page);
        return;
    }
    if (el.dataset.route) {
        st.selectedRoute = el.dataset.route;
        st.copilotAnswer = '';
        render();
        return;
    }
    if (el.dataset.layer) {
        st.layer = el.dataset.layer;
        render();
        return;
    }
    if (el.dataset.hour) {
        st.hour = Number(el.dataset.hour);
        st.playing = false;
        render();
        return;
    }
    if (el.dataset.berg) {
        st.selectedBerg = el.dataset.berg;
        if (st.page !== 'icebergs')
            st.page = 'icebergs';
        render();
        return;
    }
    if (el.dataset.alert) {
        const a = st.scenario.alerts.find(a => a.id === el.dataset.alert);
        if (a) {
            if (a.hour != null)
                st.hour = a.hour;
            st.selectedBerg = a.berg_id || null;
            if (a.id === 'reroute') {
                st.modal = 'explain';
                renderModal();
            }
            else if (a.id === 'data')
                setPage('data');
            else
                render();
        }
        return;
    }
    if (el.dataset.question) {
        await ask(el.dataset.question);
        return;
    }
});
document.addEventListener('submit', e => { if (e.target.id === 'copilot-form') {
    e.preventDefault();
    const input = $('#copilot-input');
    if (input.value.trim())
        ask(input.value.trim());
} });
document.addEventListener('input', e => { const t = e.target; if (t.id === 'time-slider') {
    st.hour = Number(t.value);
    st.playing = false;
    updateMap();
} if (t.dataset.priority) {
    const v = $(`#val-${t.dataset.priority}`);
    if (v)
        v.textContent = t.value;
} if (t.dataset.whatif) {
    const v = $(`#val-${t.dataset.whatif}`);
    if (v)
        v.textContent = `${fmt(t.value, 2)}×`;
} });
document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'mission-select') {
        st.playing = false;
        st.selectedRoute = 'recommended';
        await commit({ ...DEFAULT, mission: t.value }, true);
    }
    if (t.id === 'play-speed')
        st.speed = Number(t.value);
    if (t.id === 'time-slider')
        render();
    if (t.dataset.priority)
        await commit({ [t.dataset.priority]: Number(t.value) });
    if (t.dataset.whatif)
        await commit({ [t.dataset.whatif]: Number(t.value) });
    if (t.id === 'data-file' && t.files?.[0]) {
        const file = t.files[0];
        if (file.size > 2_000_000) {
            toast('Use a CSV or JSON file smaller than 2 MB.', 'error');
            return;
        }
        try {
            const text = await file.text();
            const raw = file.name.toLowerCase().endsWith('.json') ? JSON.parse(text) : parseCSV(text);
            const rows = (Array.isArray(raw) ? raw : raw.rows).map((r) => { if (['latitude', 'longitude', 'concentration', 'observed_at'].some(k => r[k] === undefined || r[k] === null || String(r[k]).trim() === ''))
                throw new Error('Every observation needs latitude, longitude, concentration and observed_at.'); return { latitude: Number(r.latitude), longitude: Number(r.longitude), concentration: Number(r.concentration), observed_at: r.observed_at, source: r.source || file.name }; });
            const result = await api('/api/data/import', { rows });
            st.imported = result.rows;
            st.sourceMessage = `${result.accepted} points accepted; ${result.outside_coverage} outside coverage. Overlay only: simulation forecasts remain unchanged.`;
            render();
            toast('Observation overlay validated.');
        }
        catch (error) {
            st.sourceMessage = error.message;
            render();
            toast(st.sourceMessage, 'error');
        }
    }
});
function mapLocation(clientX, clientY) { const svg = $('#polar-map'); if (!svg)
    return null; const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY; const inv = svg.getScreenCTM()?.inverse(); if (!inv)
    return null; const local = p.matrixTransform(inv); return unproject([(local.x - st.pan[0]) / st.zoom, (local.y - st.pan[1]) / st.zoom]); }
document.addEventListener('pointerdown', e => { const target = e.target; if (target.closest('#polar-map') && !target.closest('[data-berg]')) {
    dragging = { x: e.clientX, y: e.clientY, pan: [...st.pan], moved: false };
} });
document.addEventListener('pointermove', e => { if (!dragging)
    return; const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y; if (Math.abs(dx) + Math.abs(dy) > 5) {
    dragging.moved = true;
    const svg = $('#polar-map');
    const rect = svg?.getBoundingClientRect();
    if (!rect)
        return;
    st.pan = [dragging.pan[0] + dx / rect.width * W, dragging.pan[1] + dy / rect.height * H];
    $('#geo-layer')?.setAttribute('transform', `translate(${st.pan[0]} ${st.pan[1]}) scale(${st.zoom})`);
} });
document.addEventListener('pointerup', async (e) => {
    if (!dragging)
        return;
    const d = dragging;
    dragging = null;
    if (d.moved) {
        updateMap();
        return;
    }
    const p = mapLocation(e.clientX, e.clientY);
    if (!p || p[0] < -530 || p[0] > 530 || p[1] < 2180 || p[1] > 2690)
        return;
    if (st.picking) {
        const key = st.picking;
        st.picking = null;
        await commit({ [key]: p }, true);
        toast(`${key === 'start' ? 'Origin' : 'Destination'} updated. Route constraints checked.`);
    }
    else {
        st.modal = 'cell';
        st.inspector = null;
        renderModal();
        try {
            st.inspector = await api('/api/risk/inspect', { options: st.scenario.options, horizon: st.hour, x: p[0], y: p[1] });
            renderModal();
        }
        catch (error) {
            st.modal = null;
            renderModal();
            toast(error.message, 'error');
        }
    }
});
document.addEventListener('wheel', e => { if (!e.target.closest('#polar-map'))
    return; e.preventDefault(); const old = st.zoom; st.zoom = clamp(st.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 1, 4); if (st.zoom === 1)
    st.pan = [0, 0];
else {
    const factor = st.zoom / old;
    st.pan = [W / 2 - (W / 2 - st.pan[0]) * factor, H / 2 - (H / 2 - st.pan[1]) * factor];
} updateMap(); }, { passive: false });
document.addEventListener('keydown', e => {
    const target = e.target;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
        return;
    if (e.key === 'Escape') {
        st.modal = null;
        st.picking = null;
        renderModal();
        return;
    }
    if (!st.scenario)
        return;
    if (e.key.toLowerCase() === 'j') {
        st.judge ? exitJudge() : startJudge();
    }
    if (e.key.toLowerCase() === 'h')
        simulateHazard();
    if (e.key.toLowerCase() === 'f')
        onAction('fullscreen');
    if (e.code === 'Space') {
        e.preventDefault();
        playToggle();
    }
});
async function init() {
    shell();
    $('#main').innerHTML = `<section class="startup"><div class="startup-logo">${logo()}</div><span class="eyebrow">POLAR PULSE / INITIALIZING</span><h1>The next passage starts here.</h1><p>Loading the local scenario, forecasting fields and calculating four corridors.</p><div class="startup-line"></div><small>No live feeds. No external map requests. A transparent research prototype.</small></section>`;
    try {
        const boot = await api('/api/bootstrap');
        st.boot = boot;
        st.scenario = boot.scenario;
        render();
    }
    catch (error) {
        $('#main').innerHTML = `<section class="startup"><h1>Let’s reconnect the local engine.</h1><p>${esc(error.message)}</p><p>Keep the Python terminal open and visit <code>http://127.0.0.1:8000</code>.</p><button class="btn btn-primary" onclick="location.reload()">Try again</button></section>`;
    }
    window.setInterval(tickClock, 1000);
    liveTimer = window.setInterval(liveTick, 250);
}
init();
//# sourceMappingURL=app.js.map