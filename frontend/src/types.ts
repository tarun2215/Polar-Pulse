export type Page = 'mission'|'ice'|'icebergs'|'routes'|'voyage'|'decision'|'data'|'performance'|'architecture';
export interface Options {
  mission: 'supply'|'survey'; wind:number; current:number; ice:number; drift:number;
  safety:number; fuel:number; time:number; hazard:boolean;
  start: [number,number]|null; goal:[number,number]|null; departure_hour:number;
}
export interface Route {
  id:string; name:string; status:string; points?:number[][]; speed_km_h?:number;
  distance_km?:number; eta_h?:number; fuel_l?:number; co2_kg?:number; risk?:number;
  ice_exposure_pct?:number; min_clearance_km?:number; closest_approach?:any;
  risk_contributions?:Record<string,number>; profile?:any[]; compute_ms?:number;
  expanded_states?:number; admissible?:boolean; first_threat_h?:number; reason?:string;
  [key:string]:any;
}
export interface Scenario {
  mission:any; options:Options; routes:Route[]; original_route:Route|null;
  environment:any; icebergs:any[]; alerts:any[]; delta:any; resilience:number|null;
  fuel_saved_vs_fastest_l:number|null; compute_ms:number; policy:any;
  computed_at:string; disclaimer:string; [key:string]:any;
}
export interface State {
  boot:any; scenario:Scenario|null; page:Page; selectedRoute:string; selectedBerg:string|null;
  hour:number; elapsed:number; playing:boolean; speed:number; layer:'ice'|'risk'|'difference';
  currents:boolean; trajectories:boolean; alternatives:boolean; icebergs:boolean;
  zoom:number; pan:[number,number]; modal:string|null; inspector:any;
  picking:'start'|'goal'|null; busy:boolean; error:string|null; judge:boolean; judgeStep:number;
  judgePaused:boolean; copilotAnswer:string; imported:any[]; sourceMessage:string;
}
export const colors:Record<string,string>={fastest:'#a5b4cb',safest:'#74a7ff',eco:'#ffbd78',recommended:'#50e2bc'};
export const names:Record<string,string>={fastest:'Fastest',safest:'Safety priority',eco:'Fuel saver',recommended:'AI balanced'};
