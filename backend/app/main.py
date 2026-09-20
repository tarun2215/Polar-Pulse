"""Run locally using python start.py. Open /docs for the complete API schema."""
from pathlib import Path
from datetime import datetime
import json,csv,io
from typing import Literal
import numpy as np
from fastapi import FastAPI,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse,Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel,Field,ConfigDict,field_validator
from .engine import ENGINE,SOURCES
from .geography import lonlat,TO_XY,BOUNDS,LAND_BUFFER
from shapely.geometry import Point
import math
ROOT=Path(__file__).resolve().parents[2]
app=FastAPI(title='POLAR PULSE',version='1.0.0',docs_url=None,redoc_url=None,description='Offline Antarctic navigation research demo. NOT for real navigation.')
app.add_middleware(CORSMiddleware,allow_origins=['http://127.0.0.1:8000','http://localhost:8000','http://127.0.0.1:5173'],allow_methods=['GET','POST'],allow_headers=['Content-Type'])

# Malformed JSON can contain NaN in Python's permissive parser. Sanitize the
# validation response too, so rejected nonfinite values never become a 500.
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
@app.exception_handler(RequestValidationError)
async def validation_error(request,exc):
    def clean(value):
        if isinstance(value,float) and not math.isfinite(value):return str(value)
        if isinstance(value,dict):return {k:clean(v) for k,v in value.items()}
        if isinstance(value,(list,tuple)):return [clean(v) for v in value]
        if isinstance(value,Exception):return str(value)
        return value
    return JSONResponse(status_code=422,content={'detail':clean(exc.errors())})


class Options(BaseModel):
    model_config=ConfigDict(extra='forbid')
    mission:Literal['supply','survey']='supply'
    wind:float=Field(default=1,ge=.5,le=2)
    current:float=Field(default=1,ge=.5,le=2)
    ice:float=Field(default=1,ge=.5,le=1.6)
    drift:float=Field(default=1,ge=.5,le=2)
    safety:float=Field(default=75,ge=0,le=100)
    fuel:float=Field(default=45,ge=0,le=100)
    time:float=Field(default=45,ge=0,le=100)
    hazard:bool=False
    start:tuple[float,float]|None=None
    goal:tuple[float,float]|None=None
    departure_hour:float=Field(default=0,ge=0,le=24)
    @field_validator('start','goal')
    @classmethod
    def valid_point(cls,v):
        if v is not None and (not all(math.isfinite(x) for x in v) or not(BOUNDS[0]<=v[0]<=BOUNDS[2] and BOUNDS[1]<=v[1]<=BOUNDS[3])):
            raise ValueError('Waypoints must be finite and within modeled map coverage.')
        return v

class ForecastRequest(BaseModel):
    options:Options=Field(default_factory=Options)
    horizon:float=Field(default=24,ge=0,le=72)

class InspectRequest(ForecastRequest):
    x:float=Field(ge=BOUNDS[0],le=BOUNDS[2])
    y:float=Field(ge=BOUNDS[1],le=BOUNDS[3])

class CopilotRequest(BaseModel):
    options:Options=Field(default_factory=Options)
    question:str=Field(max_length=1000)
    route_id:str='recommended'

class ImportedObservation(BaseModel):
    latitude:float=Field(ge=-90,le=-50)
    longitude:float=Field(ge=-180,le=180)
    concentration:float=Field(ge=0,le=1)
    observed_at:datetime
    source:str=Field(default='User-provided observation',max_length=180)

class ImportRequest(BaseModel):
    rows:list[ImportedObservation]=Field(min_length=1,max_length=5000)


def payload(o:Options):return ENGINE.get(o.model_dump())['payload']

@app.get('/docs',include_in_schema=False)
def local_api_docs():
    from .local_docs import page
    return page(app.openapi())

@app.get('/api/health')
def health():return {'status':'ok','product':'POLAR PULSE','version':'1.0.0','data_mode':'SIMULATED','live_feeds':False}

@app.get('/api/bootstrap')
def bootstrap():return {'geography':ENGINE.geography,'scenario':ENGINE.get()['payload'],'metrics':ENGINE.metrics(),'sources':SOURCES}

@app.get('/api/mission')
def mission():return ENGINE.get()['payload']['mission']

@app.get('/api/environment/current')
@app.get('/api/sea-ice/current')
def environment():return ENGINE.get()['payload']['environment']

@app.post('/api/sea-ice/forecast')
def forecast(req:ForecastRequest):
    e=ENGINE.get(req.options.model_dump())['environment']
    return {'horizon_h':req.horizon,'concentration_pct':np.round(e.grid_at(req.horizon)*100,2).ravel().tolist(),
            'source':'Synthetic scenes / trained RF; interpolated between model horizons'}

@app.get('/api/icebergs')
def icebergs():return ENGINE.get()['payload']['icebergs']

@app.post('/api/icebergs/predict')
def predict(req:Options):return payload(req)['icebergs']

@app.post('/api/routes/calculate')
@app.post('/api/routes/recalculate')
@app.post('/api/scenario/simulate')
@app.post('/api/what-if')
def scenario(req:Options):return payload(req)

@app.get('/api/alerts')
def alerts():return ENGINE.get()['payload']['alerts']

@app.get('/api/metrics')
def metrics():return ENGINE.metrics()

@app.get('/api/data/sources')
def sources():return SOURCES

@app.post('/api/risk/inspect')
def inspect(req:InspectRequest):
    e=ENGINE.get(req.options.model_dump())['environment'];v=e.sample(req.x,req.y,req.horizon)
    if LAND_BUFFER.contains(Point(req.x,req.y)):
        raise HTTPException(status_code=422,detail='This point is on land or within the reference coastline buffer. Select an ocean cell to inspect navigation exposure.')
    ll=lonlat([req.x,req.y])
    return {'lon':ll[0],'lat':ll[1],'hour':req.horizon,'ice_pct':round(float(v['ice'])*100,2),
            'risk':round(float(v['risk']),2),'clearance_km':round(float(v['clearance']),2),
            'nearest_berg_km':round(float(v['nearest']),2),
            'contributions':dict(zip(['Sea ice','Iceberg proximity','Waves','Current magnitude','Forecast uncertainty'],np.round(v['contributions'],2).tolist())),
            'note':'Policy exposure index, not a probability.'}

@app.post('/api/copilot')
def copilot(req:CopilotRequest):
    s=payload(req.options);q=req.question.lower();r=next((r for r in s['routes'] if r['id']==req.route_id and r['status']=='ok'),None)
    if r is None:return {'answer':'No admissible route is available in the current modeled scenario. Review the waypoints and constraints; do not override safety constraints to force a route.','basis':'Deterministic state-grounded explanation, not an external LLM.'}
    if any(x in q for x in ['change','rerout','deviat']):
        d=s['delta']
        a=(f"The injected SIM-X09 observation places the previous corridor inside its modeled exclusion envelope. Clearance changes from {d['previous_clearance_km']:.1f} km to {d['new_clearance_km']:.1f} km after replanning. The detour adds {d['distance_km']:+.1f} km and {d['delay_minutes']:+.0f} minutes; fuel changes by {d['fuel_l']:+.0f} L. These are same-scenario comparisons, not guaranteed savings." if d else 'No hazard reroute is currently active. Inject the demo observation to compare a previously planned corridor with the updated environment.')
    elif 'fuel' in q:
        eco=next((v for v in s['routes'] if v['id']=='eco' and v['status']=='ok'),None)
        a=(f"Fuel saver estimates {eco['fuel_l']:,.0f} L over {eco['eta_h']:.1f} h versus {r['fuel_l']:,.0f} L and {r['eta_h']:.1f} h for the selected corridor. Its policy risk is {eco['risk']:.1f}/100. Fuel is derived from an illustrative hotel-load, cubic-speed and ice-drag model; it is not vessel-calibrated." if eco else 'No admissible fuel-priority corridor was found. The safety exclusions remain mandatory.')
    elif any(x in q for x in ['24','ice','forecast']):
        e=s['environment'];a=f"At +24 h, average simulated sea-ice concentration changes from {e['average'][0]:.1f}% to {e['average'][3]:.1f}%. The RF model uses concentration, recent trend, temperature, wind, currents and horizon. Nominal interval half-width is {e['interval_pp'][3]:.1f} percentage points on synthetic calibration data only. This is an association-based forecast, not proof of physical causality."
    elif any(x in q for x in ['hazard','danger','berg']):
        c=r['closest_approach'];a=f"The closest predicted encounter on this corridor is {c['berg_id']}: CPA {c['cpa_km']:.1f} km at +{c['tcpa_h']:.1f} h. At that encounter the modeled clearance requirement is {c['required_clearance_km']:.1f} km. Uncertainty and all future positions are model-derived from synthetic observations."
    else:
        a=f"The selected {r['name']} corridor is {r['distance_km']:.1f} km, with {r['eta_h']:.1f} h ETA, {r['fuel_l']:,.0f} L modeled fuel and {r['risk']:.1f}/100 policy exposure. It passes the demo land, ice, wave and time-dependent iceberg exclusions. Selection weights are safety {s['options']['safety']:.0f}, fuel {s['options']['fuel']:.0f}, time {s['options']['time']:.0f}. Weighted A* is approximate; this is not a certified globally optimal route."
    return {'answer':a,'basis':'Deterministic state-grounded explanation, not an external LLM.','route_id':r['id']}

@app.post('/api/data/import')
def import_data(req:ImportRequest):
    rows=[]
    for r in req.rows:
        x,y=TO_XY.transform(r.longitude,r.latitude)
        if BOUNDS[0]<=x<=BOUNDS[2] and BOUNDS[1]<=y<=BOUNDS[3]:
            rows.append(r.model_dump(mode='json')|{'x':round(x,3),'y':round(y,3)})
    return {'accepted':len(rows),'outside_coverage':len(req.rows)-len(rows),'rows':rows,
            'use':'Observation overlay only. Demo-trained forecasts and routing remain explicitly simulated.'}

@app.get('/api/data/template.csv')
def template():
    rows=[['latitude','longitude','concentration','observed_at','source']]
    for x,y,c in [(-140,2530,.24),(-80,2490,.31),(0,2420,.43),(40,2350,.30)]:
        lon,lat=lonlat([x,y]);rows.append([lat,lon,c,'2026-02-15T06:00:00Z','SYNTHETIC TEMPLATE'])
    out=io.StringIO();csv.writer(out).writerows(rows)
    return Response(out.getvalue(),media_type='text/csv',headers={'Content-Disposition':'attachment; filename=polar-observation-template.csv'})

@app.post('/api/reports/mission')
def report(req:Options):
    s=payload(req)
    return {'title':'POLAR PULSE mission briefing','scenario':s,'methodology':ENGINE.metrics(),
            'disclaimer':s['disclaimer'],'sources':SOURCES}

# Same-origin, precompiled, completely local frontend. No Node server required.
DIST=ROOT/'frontend/dist'
if DIST.exists():app.mount('/',StaticFiles(directory=DIST,html=True),name='interface')
