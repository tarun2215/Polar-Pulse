import json
from pathlib import Path
import numpy as np
import pytest
from shapely.geometry import LineString
from backend.app.forecast import FORECASTER,HORIZONS
from backend.app.environment import Environment
from backend.app.geography import TO_LL,TO_XY,LAND_BUFFER,distance,XX,YY,LAND_MASK
from backend.app.icebergs import kalman,closest_approach,make_icebergs
from backend.app.routing import GRAPH,fuel_rate,assess_route,Planner,profiles,point_on_route
from backend.app.engine import ENGINE
ROOT=Path(__file__).resolve().parents[1]

def test_projection_roundtrip():
    lon,lat=TO_LL.transform(-100,2500)
    assert np.allclose(TO_XY.transform(lon,lat),[-100,2500],atol=1e-7)

def test_distance_is_geodesic_symmetric_positive():
    a,b=[-200,2600],[100,2500]
    assert distance(a,b)>0
    assert distance(a,b)==pytest.approx(distance(b,a))
    assert distance(a,a)==pytest.approx(0)

def test_graph_edges_do_not_cross_land():
    checked=0
    for i,edges in enumerate(GRAPH.adj):
        for j,d in edges:
            assert d>0
            assert not LAND_BUFFER.intersects(LineString([GRAPH.points[i],GRAPH.points[j]]))
            checked+=1
    assert checked>1000

def test_rf_is_trained_40_tree_artifact():
    assert len(FORECASTER.trees)==40
    assert all(len(t['left'])>10 for t in FORECASTER.trees)

def test_forecasts_are_bounded_and_respond_to_horizon():
    X=np.array([[.3,.002,-12,-1.8,-6,-.06,h] for h in [6,12,24,48,72]])
    pred=FORECASTER.predict(X)
    assert np.all((pred>=0)&(pred<=1))
    assert abs(pred[-1]-pred[0])>.01
    assert np.allclose(pred,FORECASTER.predict(X))

def test_prediction_interval_grows_with_horizon():
    v=np.array([FORECASTER.interval(h) for h in HORIZONS])
    assert v[0]==0 and np.all(np.diff(v)>0)

def test_evaluation_is_scene_held_out_and_not_claimed_accuracy():
    m=ENGINE.metrics()['sea_ice']
    assert m['train_scenes']==60 and m['calibration_scenes']==15 and m['test_scenes']==15
    assert m['test_samples']==5250
    assert 'Synthetic' in m['data_type']
    assert all(v['mae_pp']<v['persistence_mae_pp'] for v in m['horizons'])
    assert m['horizons'][-1]['test_coverage']<.9

def test_kalman_recovers_constant_velocity():
    times=np.arange(-24,1,6)
    obs=np.column_stack([10+.7*times,20-.3*times])
    x,p=kalman(obs)
    assert np.allclose(x,[10,20,.7,-.3],atol=.001)
    assert np.linalg.eigvalsh(p).min()>0

def test_kalman_rejects_too_few_observations():
    with pytest.raises(ValueError):kalman([[0,0]])

def test_analytic_cpa_detects_between_waypoint_crossing():
    route={'points':[[0,0,0],[10,0,10]]}
    berg={'id':'TEST','times':[0,10],'positions':[[5,-5],[5,5]],'uncertainty_km':[0,0],'radius_km':1}
    c=closest_approach(route,berg)
    assert c['cpa_km']==pytest.approx(0,abs=.001)
    assert c['tcpa_h']==pytest.approx(5,abs=.001)

def test_iceberg_forcing_changes_trajectory():
    a,b=make_icebergs(),make_icebergs(wind=1.5,current=1.3,drift=1.2)
    assert all(x['id'].startswith('SIM-') for x in a)
    assert a[0]['positions'][0]==b[0]['positions'][0]
    assert not np.allclose(a[0]['positions'][-1],b[0]['positions'][-1])
    assert a[0]['uncertainty_km'][-1]>a[0]['uncertainty_km'][0]

def test_environment_scalar_vector_agreement(baseline):
    e=baseline['environment'];xs=np.array([-100,100]);ys=np.array([2580,2480]);ts=np.array([12,24])
    v=e.sample(xs,ys,ts)
    for i in range(2):
        a=e.sample(xs[i],ys[i],ts[i])
        for key in ['ice','risk','clearance','wave','nearest']:
            assert a[key]==pytest.approx(v[key][i])

def test_risk_contributions_sum_and_limits(baseline):
    v=baseline['environment'].sample(XX,YY,np.full(XX.shape,24.))
    assert np.allclose(v['risk'],v['contributions'].sum(axis=0))
    assert np.all((v['risk']>=0)&(v['risk']<=100))

def test_fuel_model_has_positive_hotel_load_and_cubic_speed_penalty():
    assert fuel_rate(0,0,1)==30
    assert fuel_rate(20,.3,2)>fuel_rate(15,.3,2)>30
    assert fuel_rate(20,.5,3)>fuel_rate(20,0,1)

@pytest.mark.parametrize('route_id',['fastest','safest','eco','recommended'])
def test_default_routes_independently_validate(route_id,baseline):
    r=next(r for r in baseline['payload']['routes'] if r['id']==route_id)
    assert r['status']=='ok' and r['admissible']
    assert np.all(np.diff(np.asarray(r['points'])[:,2])>0)
    independent=assess_route(r,baseline['environment'])
    assert independent['admissible']
    assert independent['fuel_l']==pytest.approx(r['fuel_l'],abs=.1)
    assert r['fuel_l']>0 and r['distance_km']>0 and r['eta_h']>0
    assert r['min_clearance_km']>=0
    assert r['co2_kg']==pytest.approx(r['fuel_l']*2.68,abs=.2)

def test_hazard_old_corridor_fails_and_new_corridor_passes(hazard):
    p=hazard['payload'];r=next(r for r in p['routes'] if r['id']=='recommended')
    assert not p['original_route']['admissible']
    assert p['original_route']['min_clearance_km']<0
    assert r['status']=='ok' and r['admissible'] and r['min_clearance_km']>0
    assert 0<p['delta']['lead_time_h']<r['eta_h']
    assert p['original_route']['points']!=r['points']

def test_reroute_delta_arithmetic_is_same_scenario(hazard):
    p=hazard['payload'];d=p['delta'];old=p['original_route'];new=next(r for r in p['routes'] if r['id']=='recommended')
    assert d['distance_km']==pytest.approx(new['distance_km']-old['distance_km'],abs=.02)
    assert d['delay_minutes']==pytest.approx((new['eta_h']-old['eta_h'])*60,abs=.1)
    assert d['fuel_l']==pytest.approx(new['fuel_l']-old['fuel_l'],abs=.1)
    assert d['fuel_l']>0  # The demo honestly shows the additional fuel cost.

def test_whatif_changes_forecasts_and_drift(baseline):
    changed=ENGINE.get({'wind':1.2,'current':1.15,'ice':1.25,'drift':1.5})
    assert not np.allclose(changed['environment'].forecasts,baseline['environment'].forecasts)
    assert changed['payload']['icebergs'][0]['positions'][-1]!=baseline['payload']['icebergs'][0]['positions'][-1]
    assert all(r['status']=='ok' and r['admissible'] for r in changed['payload']['routes'])

def test_second_mission_computes():
    s=ENGINE.get({'mission':'survey'})['payload']
    assert s['mission']['id']=='POLAR-26059-02'
    assert all(r['status']=='ok' for r in s['routes'])

def test_no_route_on_land_or_same_point(baseline):
    planner=Planner(baseline['environment']);p=profiles()[-1]
    land_index=np.argwhere(LAND_MASK)[0];y,x=land_index
    a=planner.plan([float(XX[y,x]),float(YY[y,x])],[20,2320],p)
    assert a['status']=='no_route' and 'land' in a['reason']
    b=planner.plan([-270,2640],[-270,2640],p)
    assert b['status']=='no_route' and 'distinct' in b['reason']

def test_search_budget_does_not_fabricate_route(baseline):
    planner=Planner(baseline['environment'])
    r=planner.plan([-270,2640],[20,2320],profiles()[-1],max_expansions=0)
    assert r['status']=='no_route' and 'budget' in r['reason']

def test_interpolated_vessel_position_follows_route(baseline):
    r=baseline['payload']['routes'][-1];p=r['points']
    assert np.allclose(point_on_route(r,0),p[0][:2])
    assert np.allclose(point_on_route(r,100),p[-1][:2])
