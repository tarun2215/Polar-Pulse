import type {State} from './types.js';
import {colors} from './types.js';
import {esc,fmt,clamp,lerpArray,pointAt} from './utils.js';

export const W=1000,H=481.132;
export const project=(p:number[])=>[(p[0]+530)/1060*W,(2690-p[1])/510*H];
export const unproject=(p:number[])=>[p[0]/W*1060-530,2690-p[1]/H*510];
const line=(points:number[][])=>points.map((p,i)=>{const q=project(p);return `${i?'L':'M'}${q[0].toFixed(2)},${q[1].toFixed(2)}`}).join(' ');
function geoPath(geo:any,converter=project):string {
  if(!geo)return '';
  const polygons=geo.type==='Polygon'?[geo.coordinates]:geo.type==='MultiPolygon'?geo.coordinates:[];
  return polygons.map((polygon:number[][][])=>polygon.map(ring=>ring.map((p,i)=>{const q=converter(p);return `${i?'L':'M'}${q[0].toFixed(2)},${q[1].toFixed(2)}`}).join(' ')+'Z').join(' ')).join(' ');
}
let heatCacheKey='',heatCacheImage='';
function heatmap(st:State):string {
 const s=st.scenario!,e=s.environment;
 const key=`${s.computed_at}/${st.hour.toFixed(2)}/${st.layer}`;
 if(key===heatCacheKey)return heatCacheImage;
 const values=lerpArray(e.horizons,st.layer==='risk'?e.risk:e.forecast,st.hour);
 const nx=e.x.length,ny=e.y.length;const canvas=document.createElement('canvas');canvas.width=nx;canvas.height=ny;
 const ctx=canvas.getContext('2d')!;const image=ctx.createImageData(nx,ny);
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   const idx=j*nx+i,d=((ny-1-j)*nx+i)*4;
   if(e.land_mask[idx])continue;
   let v=values[idx];let r=0,g=0,b=0,a=0;
   if(st.layer==='difference'){
     v=v-e.forecast[0][idx];const u=clamp(Math.abs(v)/22,0,1);
     [r,g,b]=v>=0?[75,202,240]:[253,175,111];a=20+u*165;
   }else if(st.layer==='risk'){
     const u=clamp(v/75,0,1);r=40+u*215;g=152-u*62;b=172-u*99;a=25+u*135;
   }else{
     const u=clamp((v-8)/75,0,1);r=20+u*155;g=73+u*155;b=106+u*139;a=12+u*165;
   }
   image.data[d]=r;image.data[d+1]=g;image.data[d+2]=b;image.data[d+3]=a;
 }
 ctx.putImageData(image,0,0);heatCacheKey=key;heatCacheImage=canvas.toDataURL();return heatCacheImage;
}
export function mapSVG(st:State):string {
 const s=st.scenario!,geo=st.boot.geography,r=s.routes.find(v=>v.id===st.selectedRoute&&v.status==='ok');
 const selected=r||s.routes.find(v=>v.status==='ok');
 const routeLines=s.routes.filter(v=>v.status==='ok'&&(st.alternatives||v.id===st.selectedRoute)).sort((a,b)=>Number(a.id===st.selectedRoute)-Number(b.id===st.selectedRoute)).map(v=>{
   const active=v.id===st.selectedRoute;
   return `<path d="${line(v.points!)}" fill="none" stroke="${colors[v.id]}" stroke-width="${active?4:1.8}" opacity="${active?1:.42}" ${active?'filter="url(#routeGlow)"':'stroke-dasharray="6 7"'} stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
   ${active?`<path d="${line(v.points!)}" class="route-flow" fill="none" stroke="#e6fff7" stroke-width="1.25" stroke-dasharray="3 31" opacity=".9" vector-effect="non-scaling-stroke"/>`:''}`;
 }).join('');
 const old=s.original_route?.points?`<path d="${line(s.original_route.points)}" fill="none" stroke="#fa7882" stroke-width="2.2" opacity=".72" stroke-dasharray="5 6" vector-effect="non-scaling-stroke"/>`:'';
 const currents=st.currents?s.environment.currents.map((p:number[])=>{
   const q=project(p),angle=Math.atan2(-p[3],p[2])*180/Math.PI;
   return `<g transform="translate(${q[0]} ${q[1]}) rotate(${angle})" opacity=".35"><path d="M-9 0H9m-4-3 4 3-4 3" stroke="#76b4c4" stroke-width="1" fill="none"/></g>`;
 }).join(''):'';
 const bergs=st.icebergs?s.icebergs.map((b:any,index:number)=>{
   const current=lerpArray(b.times,b.positions,st.hour),p=project(current);
   const futureH=Math.min(72,Math.max(st.hour,24)),future=project(lerpArray(b.times,b.positions,futureH));
   const sigma=lerpArray(b.times,b.uncertainty_km,futureH),rad=(8+b.radius_km+sigma)/1060*W;
   const selectedB=st.selectedBerg===b.id,threat=b.id==='SIM-X09';
   const color=threat?'#ff7d88':selectedB?'#b4f3ff':'#83bed8';
   const labelX=b.id==='SIM-B17'?-16:16,labelY=b.id==='SIM-B17'?-13:(index%2?-8:5),labelAnchor=b.id==='SIM-B17'?'end':'start';
   const trajectory=st.trajectories?`<path d="${line(b.positions.filter((_:any,i:number)=>i%8===0))}" fill="none" stroke="${color}" opacity=".60" stroke-width="1.3" stroke-dasharray="4 5"/><circle cx="${future[0]}" cy="${future[1]}" r="${rad}" fill="${color}" fill-opacity=".045" stroke="${color}" stroke-opacity=".38" stroke-dasharray="4 5"/>${[6,12,24,48].map(t=>{const q=project(lerpArray(b.times,b.positions,t));return `<circle cx="${q[0]}" cy="${q[1]}" r="2" fill="${color}"/>`;}).join('')}`:'';
   return `${trajectory}<g data-berg="${b.id}" class="berg-marker" transform="translate(${p[0]} ${p[1]})"><circle r="${threat?22:17}" fill="${color}" fill-opacity=".055" stroke="${color}" stroke-opacity=".25"/>${threat?'<circle class="hazard-pulse" r="26" fill="none" stroke="#ff7d88" opacity=".3"/>':''}<path d="m-9 6 3-13 7-4 9 9-3 10Z" fill="${threat?'#ffd5d9':'#c2e4ee'}" stroke="${color}" stroke-width="1.2"/><path d="m-6-7 7 7 6 8M1 0l9-2" fill="none" stroke="#547581" stroke-width=".8"/><text x="${labelX}" y="${labelY}" text-anchor="${labelAnchor}" class="map-label" fill="${color}">${b.id}</text>${threat?'<text x="16" y="19" font-size="9" fill="#ff929b" letter-spacing="1">INJECTED OBSERVATION</text>':''}</g>`;
 }).join(''):'';
 const vesselXY=selected?pointAt(selected,Math.max(st.elapsed,s.options.departure_hour)):s.mission.start;
 const vp=project(vesselXY);
 const vnext=selected?pointAt(selected,Math.max(st.elapsed,s.options.departure_hour)+.3):s.mission.goal;
 const vn=project(vnext);const heading=Math.atan2(vn[1]-vp[1],vn[0]-vp[0])*180/Math.PI+90;
 const vessel=`<g transform="translate(${vp[0]} ${vp[1]})"><circle r="29" fill="#59d8ef" opacity=".06"/><circle r="20" fill="none" stroke="#59d8ef" opacity=".2"/><g transform="rotate(${heading})"><path d="M0-15 7 4 5 12H-5L-7 4Z" fill="#f2fbff" stroke="#86e7ff" stroke-width="1.5"/><path d="M-3 0h6v8h-6Z" fill="#2a596e"/></g><text x="25" y="-10" fill="#f0faff" class="map-label">RV POLAR ONE</text><text x="25" y="6" fill="#83a9ba" font-size="10">SIMULATED VESSEL</text></g>`;
 let ghost='';
 if(selected&&st.hour>st.elapsed+.5){const gp=project(pointAt(selected,st.hour));ghost=`<g transform="translate(${gp[0]} ${gp[1]})"><circle r="8" fill="#50e2bc" fill-opacity=".22" stroke="#50e2bc"/><text x="14" y="-9" fill="#82ddc1" font-size="10">PROJECTED +${fmt(st.hour,1)}h</text></g>`;}
 const goal=project(s.mission.goal),station=project(geo.station.xy);
 const graticules=geo.graticules.map((g:any)=>`<path d="${line(g.points)}" fill="none" stroke="#406075" stroke-opacity=".22" stroke-width=".8"/>`).join('');
 const land=geoPath(geo.land);
 const world=geoPath(geo.antarctica,p=>[60+p[0]/4100*55,60-p[1]/4100*55]);
 const heat=heatmap(st);
 const impact=s.delta?`<g transform="translate(${project(s.alerts[0].xy)[0]} ${project(s.alerts[0].xy)[1]})"><circle r="40" fill="#ff7984" fill-opacity=".04" stroke="#ff7984" stroke-opacity=".35" stroke-dasharray="4 4"/></g>`:'';
 const imports=st.imported.map(p=>{const q=project([p.x,p.y]);return `<g><rect x="${q[0]-4}" y="${q[1]-4}" width="8" height="8" fill="#e4acff"/><title>Imported observation: ${fmt(p.concentration*100,1)}% / ${esc(p.observed_at)}</title></g>`;}).join('');
 return `<svg id="polar-map" class="polar-map ${st.picking?'picking':''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Interactive south-polar navigation map. Simulated sea ice, iceberg trajectories and computed vessel corridors.">
 <defs><linearGradient id="oceanBg" x2=".9" y2="1"><stop stop-color="#071521"/><stop offset="1" stop-color="#0a2132"/></linearGradient><linearGradient id="landFill" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#163b50"/><stop offset="1" stop-color="#0d2539"/></linearGradient><pattern id="landHatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path d="M0 0V10" stroke="#426379" stroke-width=".5" opacity=".25"/></pattern><filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge></filter><clipPath id="mapClip"><rect width="${W}" height="${H}"/></clipPath><radialGradient id="locatorBg"><stop stop-color="#173447"/><stop offset="1" stop-color="#0a1b28"/></radialGradient></defs>
 <rect width="${W}" height="${H}" fill="url(#oceanBg)"/>
 <g clip-path="url(#mapClip)"><g id="geo-layer" transform="translate(${st.pan[0]} ${st.pan[1]}) scale(${st.zoom})">
 ${graticules}<image href="${heat}" x="-4.72" y="-4.72" width="1009.44" height="490.57" opacity=".97" preserveAspectRatio="none"/>
 <path d="${land}" fill="url(#landFill)" stroke="#4f7c94" stroke-width="1.3"/><path d="${land}" fill="url(#landHatch)"/>
 ${currents}<text x="760" y="411" text-anchor="middle" fill="#8caabb" opacity=".32" font-size="18" letter-spacing="5">EAST ANTARCTICA</text>
 <text x="488" y="290" fill="#89bccf" opacity=".23" font-size="25" letter-spacing="9" transform="rotate(-6 488 290)">PRYDZ BAY</text>
 ${old}${routeLines}${impact}${bergs}${imports}${vessel}${ghost}
 <g transform="translate(${goal[0]} ${goal[1]})"><circle r="9" fill="#50e2bc" fill-opacity=".14" stroke="#50e2bc" stroke-width="1.5"/><circle r="3" fill="#50e2bc"/><text x="17" y="5" fill="#a6efda" class="map-label">OFFSHORE APPROACH</text></g>
 <g transform="translate(${station[0]} ${station[1]})"><path d="M-4 4V-4h8v8Z" fill="#cad4dc"/><text x="12" y="3" fill="#abbcc9" font-size="11">BHARATI STATION</text><text x="12" y="17" fill="#6c8c9f" font-size="9">REFERENCE ONLY / NO BERTHING ROUTE</text></g>
 </g></g>
 <g transform="translate(926 76)"><circle r="24" fill="#071522" fill-opacity=".78" stroke="#426379" stroke-opacity=".4"/><path d="M0-15 5 8 0 4-5 8Z" fill="#abd6e6"/><text y="-32" text-anchor="middle" fill="#a3b9c7" font-size="11">N</text></g>
 <g transform="translate(28 317)"><rect x="-8" y="-8" width="140" height="147" rx="10" fill="#071522" opacity=".9" stroke="#36566c" stroke-opacity=".4"/><circle cx="60" cy="60" r="56" fill="url(#locatorBg)" stroke="#385e76" stroke-width=".8"/><circle cx="60" cy="60" r="28" fill="none" stroke="#3e6172" stroke-opacity=".3"/><path d="M4 60h112M60 4v112" stroke="#3e6172" stroke-opacity=".3"/><path d="${world}" fill="#33627b" stroke="#76a6bb" stroke-width=".5"/><path d="M60 60 51 20 67 20Z" fill="#50e2bc" fill-opacity=".15"/><circle cx="59" cy="26" r="3" fill="#50e2bc"/><text x="60" y="128" text-anchor="middle" fill="#91adbf" font-size="9" letter-spacing="1.5">ANTARCTICA / 76 E</text></g>
 <g transform="translate(810 445)"><path d="M0-4v8m0-4h110m0-4v8" stroke="#a3bac8"/><text x="55" y="-10" text-anchor="middle" fill="#95aebe" font-size="10">~117 km / projected</text></g>
 </svg>`;
}
