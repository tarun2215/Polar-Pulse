import { esc, fmt } from './utils.js';
export function lineChart(series, labels, height = 130, unit = '', ymax) {
    const w = 460, h = height, left = 36, right = 12, top = 18, bottom = 26;
    const max = ymax ?? Math.max(...series.flatMap(s => s.values), 1) * 1.15;
    const px = (i) => left + i * (w - left - right) / Math.max(labels.length - 1, 1);
    const py = (y) => h - bottom - y / max * (h - bottom - top);
    const grids = [0, .5, 1].map(f => `<line x1="${left}" y1="${py(max * f)}" x2="${w - right}" y2="${py(max * f)}" stroke="#254052" stroke-dasharray="3 5"/><text x="${left - 7}" y="${py(max * f) + 4}" fill="#7e9bae" font-size="10" text-anchor="end">${fmt(max * f, max < 10 ? 1 : 0)}</text>`).join('');
    return `<svg class="line-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(series.map(s => s.label).join(' versus '))} ${esc(unit)}">${grids}${series.map(s => {
        const pts = s.values.map((v, i) => `${px(i)},${py(v)}`).join(' ');
        return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round"/>` + s.values.map((v, i) => `<circle cx="${px(i)}" cy="${py(v)}" r="3.2" fill="${s.color}"/><text x="${px(i)}" y="${py(v) - 8}" text-anchor="middle" fill="${s.color}" font-size="10">${fmt(v, 1)}</text>`).join('');
    }).join('')}${labels.map((x, i) => `<text x="${px(i)}" y="${h - 4}" text-anchor="middle" fill="#7e9bae" font-size="10">${esc(x)}</text>`).join('')}</svg>`;
}
export function spark(values, color = '#50e2bc', w = 120, h = 30) {
    const mi = Math.min(...values), ma = Math.max(...values);
    const pts = values.map((v, i) => `${i * w / Math.max(1, values.length - 1)},${h - 3 - (v - mi) / Math.max(1, ma - mi) * (h - 6)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8"/></svg>`;
}
export function bars(data) {
    return Object.entries(data).map(([k, v]) => `<div class="factor"><div><span>${esc(k)}</span><b>${fmt(v, 1)} <small>pts</small></b></div><div class="bar-track"><i style="width:${Math.min(100, v / 40 * 100)}%"></i></div></div>`).join('');
}
//# sourceMappingURL=charts.js.map