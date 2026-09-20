import math
import pytest
from backend.app.geography import TO_LL,XX,YY,LAND_MASK
import numpy as np

@pytest.mark.parametrize('path',['/api/health','/api/bootstrap','/api/mission','/api/environment/current','/api/sea-ice/current','/api/icebergs','/api/alerts','/api/metrics','/api/data/sources','/api/data/template.csv','/openapi.json','/docs','/','/assets/app.js','/assets/styles.css','/favicon.svg'])
def test_read_endpoints_and_assets(client,path):
    assert client.get(path).status_code==200

def test_health_does_not_pretend_live(client):
    j=client.get('/api/health').json()
    assert j['data_mode']=='SIMULATED' and j['live_feeds'] is False

@pytest.mark.parametrize('path',['/api/routes/calculate','/api/routes/recalculate','/api/scenario/simulate','/api/what-if'])
def test_scenario_apis(client,path):
    j=client.post(path,json={}).json()
    assert len(j['routes'])==4 and j['data_mode']=='SIMULATED'

def test_forecast_api(client):
    a=client.post('/api/sea-ice/forecast',json={'horizon':24}).json()
    assert len(a['concentration_pct'])==XX.size
    assert all(0<=v<=100 for v in a['concentration_pct'])

def test_iceberg_prediction_api(client):
    r=client.post('/api/icebergs/predict',json={'drift':1.2})
    assert r.status_code==200 and len(r.json())==4

@pytest.mark.parametrize('body',[{'wind':2.1},{'ice':0},{'safety':101},{'mission':'unknown'},{'start':[9999,2500]},{'departure_hour':30},{'fake_live_mode':True}])
def test_invalid_parameters_rejected(client,body):
    assert client.post('/api/scenario/simulate',json=body).status_code==422

def test_nonfinite_coordinate_rejected(client):
    r=client.post('/api/scenario/simulate',content='{"start":[NaN,2500]}',headers={'content-type':'application/json'})
    assert r.status_code==422

def test_inspection_contributions_match(client):
    r=client.post('/api/risk/inspect',json={'x':-270,'y':2640,'horizon':24})
    assert r.status_code==200
    j=r.json();assert abs(sum(j['contributions'].values())-j['risk'])<.04
    assert 'not a probability' in j['note']

def test_land_inspection_is_rejected(client):
    y,x=np.argwhere(LAND_MASK)[0]
    assert client.post('/api/risk/inspect',json={'x':float(XX[y,x]),'y':float(YY[y,x])}).status_code==422

def observation():
    lon,lat=TO_LL.transform(-140,2530)
    return {'latitude':lat,'longitude':lon,'concentration':.24,'observed_at':'2026-02-15T06:00:00Z','source':'Test-only synthetic sample'}

def test_import_valid_overlay_and_outside(client):
    row=observation();outside=row|{'latitude':-60,'longitude':-90}
    j=client.post('/api/data/import',json={'rows':[row,outside]}).json()
    assert j['accepted']==1 and j['outside_coverage']==1
    assert 'overlay only' in j['use'].lower()

@pytest.mark.parametrize('mod',[{'concentration':25},{'latitude':50},{'observed_at':'not-a-date'},{'concentration':None}])
def test_import_invalid_observations_rejected(client,mod):
    assert client.post('/api/data/import',json={'rows':[observation()|mod]}).status_code==422

def test_copilot_grounded_in_current_route(client,hazard):
    j=client.post('/api/copilot',json={'options':{'hazard':True},'question':'Why did the route change?'}).json()
    assert 'SIM-X09' in j['answer']
    assert f"{hazard['payload']['delta']['delay_minutes']:+.0f}" in j['answer']
    assert 'not an external LLM' in j['basis']

def test_report_contains_scenario_models_and_sources(client):
    j=client.post('/api/reports/mission',json={'hazard':True}).json()
    assert j['scenario']['delta'] and j['methodology']['sea_ice']['test_samples']==5250
    assert j['sources'] and 'not for navigation' in j['disclaimer'].lower()


def test_api_explorer_is_local_without_cdn(client):
    text=client.get('/docs').text
    assert 'Send local request' in text
    assert '<script src=' not in text and '<link href="http' not in text
