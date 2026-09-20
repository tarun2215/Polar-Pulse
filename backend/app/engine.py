"""Single source of truth for dashboard, planners, reports and copilot answers."""
from pathlib import Path
from dataclasses import asdict
from collections import OrderedDict
from threading import RLock
from time import perf_counter
from datetime import datetime,timezone
import copy,json
import numpy as np
from .environment import Environment
from .geography import geometry_payload,lonlat,XX,YY,LAND_MASK
from .routing import Planner,profiles,point_on_route,assess_route,MAX_ICE,MAX_WAVE

ROOT=Path(__file__).resolve().parents[2]
MISSIONS={
    'supply':{'id':'POLAR-26059-01','label':'Prydz Bay supply transit','origin':'Southern Ocean waypoint',
              'destination':'Bharati offshore approach','start':[-270.,2640.],'goal':[20.,2320.]},
    'survey':{'id':'POLAR-26059-02','label':'East corridor survey','origin':'Western survey waypoint',
              'destination':'Eastern offshore waypoint','start':[-290.,2600.],'goal':[220.,2460.]}}
DEFAULT={'mission':'supply','wind':1.,'current':1.,'ice':1.,'drift':1.,'safety':75.,'fuel':45.,'time':45.,
         'hazard':False,'start':None,'goal':None,'departure_hour':0.}
SOURCES=[
    {'name':'Synthetic sea-ice scenes','kind':'SEA ICE','status':'BUNDLED','resolution':'10 km demo grid',
     'source':'Seeded simulator + trained RF','note':'Not satellite observations; independent scenes for train/calibration/test.'},
    {'name':'Synthetic wind & currents','kind':'FORCING','status':'BUNDLED','resolution':'10 km / analytic field',
     'source':'Local scenario generator','note':'Physically inspired ranges, no live meteorological ingestion.'},
    {'name':'Synthetic iceberg observations','kind':'ICEBERGS','status':'BUNDLED','resolution':'6-hour observation interval',
     'source':'SIM-* tracks, seeded noise','note':'No real-world iceberg identity or satellite detection claimed.'},
    {'name':'Natural Earth coastline','kind':'GEOGRAPHY','status':'BUNDLED','resolution':'1:110 million reference',
     'source':'Natural Earth, public domain','url':'https://www.naturalearthdata.com/downloads/110m-physical-vectors/',
     'note':'Bundled Antarctica geometry. Insufficient resolution for navigation or harbour approaches.'},
    {'name':'NSIDC sea-ice products','kind':'PUBLIC DATA','status':'NOT CONNECTED','resolution':'Product dependent; often 25 km',
     'url':'https://nsidc.org/data/g02202/versions/6','note':'Integration target only. No credentials or live download configured.'},
    {'name':'ERA5 / Copernicus Marine','kind':'PUBLIC DATA','status':'NOT CONNECTED','resolution':'Product dependent',
     'url':'https://cds.climate.copernicus.eu/','note':'Future adapters need licensed access, units, CRS and time alignment.'},
    {'name':'Bharati station reference','kind':'REFERENCE','status':'VERIFIED REFERENCE','resolution':'Station coordinate only',
     'url':'https://ncpor.res.in/antarcticas/display/177-bharati','note':'NCPOR coordinate reference. Route ends at a fictional offshore waypoint, NOT at the station.'}]

class Engine:
    def __init__(self):
        self.cache=OrderedDict();self.lock=RLock();self.geography=geometry_payload()
    def normalize(self,options):
        return DEFAULT|{k:v for k,v in options.items() if k in DEFAULT}
    def get(self,options=None):
        opts=self.normalize(options or {});key=json.dumps(opts,sort_keys=True)
        with self.lock:
            if key in self.cache:
                self.cache.move_to_end(key);return self.cache[key]
            value=self._build(opts)
            self.cache[key]=value
            while len(self.cache)>8:self.cache.popitem(last=False)
            return value
    def _build(self,opts):
        began=perf_counter();mission=copy.deepcopy(MISSIONS[opts['mission']])
        start=opts['start'] or mission['start'];goal=opts['goal'] or mission['goal']
        threat=None;original=None;baseline=None
        if opts['hazard']:
            # Purposefully construct a test encounter at a future point on the
            # pre-event route. The optimization itself is NOT scripted.
            base_opts=opts|{'hazard':False}
            baseline=self.get(base_opts)
            original=next((r for r in baseline['payload']['routes'] if r['id']=='recommended' and r['status']=='ok'),None)
            if original:
                intercept=opts['departure_hour']+min(12.,original['eta_h']*.38)
                threat=(point_on_route(original,intercept),intercept)
        env=Environment(opts['wind'],opts['current'],opts['ice'],opts['drift'],threat)
        planner=Planner(env)
        routes=[planner.plan(start,goal,p,opts['departure_hour'],max_expansions=9000) for p in profiles(opts['safety'],opts['fuel'],opts['time'])]
        valid=[r for r in routes if r['status']=='ok'];recommended=next((r for r in valid if r['id']=='recommended'),None)
        delta=None;original_assessed=None
        if original:
            original_assessed=copy.deepcopy(original);original_assessed.update(assess_route(original,env))
            original_assessed['name']='Previous corridor under updated conditions'
            if recommended:
                delta={'previous_risk':original_assessed['risk'],'new_risk':recommended['risk'],
                       'risk_points':round(original_assessed['risk']-recommended['risk'],2),
                       'distance_km':round(recommended['distance_km']-original_assessed['distance_km'],2),
                       'delay_minutes':round((recommended['eta_h']-original_assessed['eta_h'])*60,1),
                       'fuel_l':round(recommended['fuel_l']-original_assessed['fuel_l'],1),
                       'fuel_pct':round(100*(recommended['fuel_l']/max(original_assessed['fuel_l'],1)-1),2),
                       'previous_clearance_km':original_assessed['min_clearance_km'],
                       'new_clearance_km':recommended['min_clearance_km'],
                       'lead_time_h':original_assessed['first_threat_h'],
                       'iceberg_id':'SIM-X09','basis':'Same departure, same updated environment; original corridor reassessed.'}
        fastest=next((r for r in valid if r['id']=='fastest'),None)
        fuel_saved=(fastest['fuel_l']-recommended['fuel_l']) if fastest and recommended else None
        # Heuristic resilience is transparent and labelled, never a certified score.
        resilience=None
        if recommended:
            safety_component=1-recommended['risk']/100
            alternates=len(valid)/4
            reserve=max(0,1-recommended['fuel_l']/12000)
            uncertainty=max(0,1-env.params['ice']*.12)
            resilience=round(100*(.5*safety_component+.2*alternates+.2*reserve+.1*uncertainty))
        mission.update({'start':start,'goal':goal,'start_lonlat':lonlat(start),'goal_lonlat':lonlat(goal),
                        'vessel':'RV POLAR ONE','vessel_note':'Fictional research vessel, no real deployment',
                        'scenario_epoch':'2026-02-15T06:00:00Z','fuel_capacity_l':12000,
                        'status':'SIMULATED MISSION','coverage':'Prydz Bay / East Antarctic sector'})
        alerts=[]
        if opts['hazard'] and original_assessed:
            alerts.append({'id':'threat','severity':'critical','title':'Predicted corridor intersection',
                           'detail':f"SIM-X09 intersects the previous modeled exclusion envelope. First breach in {original_assessed['first_threat_h']:.1f} h." if original_assessed['first_threat_h'] is not None else 'Updated scenario requires corridor review.',
                           'hour':original_assessed['first_threat_h'],'xy':list(threat[0]),'berg_id':'SIM-X09'})
            alerts.append({'id':'reroute','severity':'success' if recommended else 'critical',
                           'title':'Alternative corridor validated' if recommended else 'No admissible corridor found',
                           'detail':f"{recommended['distance_km']:.1f} km / {recommended['eta_h']:.1f} h, with positive modeled clearance." if recommended else 'Hold position in the demo and request operator review.',
                           'hour':0})
        else:
            alerts.append({'id':'forecast','severity':'watch','title':'Growth corridor ahead',
                           'detail':'Move the forecast horizon to compare present and future concentrations. All fields are synthetic.',
                           'hour':24,'xy':[-160,2470]})
        alerts.append({'id':'data','severity':'info','title':'Offline scenario data active','detail':'No live satellite, weather or vessel feed is connected.','hour':0})
        mp=env.map_payload()
        payload={'mission':mission,'options':opts,'routes':routes,'original_route':original_assessed,
                 'icebergs':env.bergs,'environment':mp,'delta':delta,'alerts':alerts,
                 'resilience':resilience,'fuel_saved_vs_fastest_l':None if fuel_saved is None else round(fuel_saved,1),
                 'forecast_model':'Random forest delta forecaster (40 trees)',
                 'trajectory_model':'Kalman filter + vector forcing',
                 'data_mode':'SIMULATED','compute_ms':round((perf_counter()-began)*1000,1),
                 'policy':{'max_ice_pct':MAX_ICE*100,'minimum_berg_margin_km':8,'max_wave_m':MAX_WAVE,
                           'coast_buffer_km':5,'astar_heuristic_weight':3.2,'time_label_bin_h':.75},
                 'computed_at':datetime.now(timezone.utc).isoformat(),
                 'disclaimer':'Research demonstration only. Not for navigation. No bathymetry, vessel ice-class constraints, marine charts or real-world forecast validation.'}
        return {'payload':payload,'environment':env}
    def metrics(self):
        sea=json.loads((ROOT/'models/metrics.json').read_text())
        ice=json.loads((ROOT/'models/iceberg_metrics.json').read_text())
        return {'sea_ice':sea,'icebergs':ice}

ENGINE=Engine()
