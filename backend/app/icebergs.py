"""Actual linear Kalman state estimation + wind/current drift forecast.
Uncertainty is model covariance, not validated Antarctic confidence.
"""
import numpy as np
from .geography import lonlat


def kalman(observations,dt=6.):
    obs=np.asarray(observations,float)
    if obs.ndim!=2 or obs.shape[1]!=2 or len(obs)<2:raise ValueError('At least two xy observations required')
    v=(obs[1]-obs[0])/dt
    state=np.r_[obs[0],v]; P=np.diag([1.,1.,.2,.2])
    F=np.array([[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]],float)
    H=np.array([[1,0,0,0],[0,1,0,0]],float)
    Q=np.diag([.1,.1,.004,.004]); R=np.eye(2)*.36
    for z in obs[1:]:
        state=F@state; P=F@P@F.T+Q
        innovation=z-H@state; S=H@P@H.T+R
        K=np.linalg.solve(S,(P@H.T).T).T
        state+=K@innovation
        # Joseph update preserves covariance positive semidefiniteness.
        A=np.eye(4)-K@H; P=A@P@A.T+K@R@K.T
    return state,P


def make_icebergs(wind=1.,current=1.,drift=1.,threat=None):
    specs=[('SIM-B17',[-175,2540],[.65,-.18],1.2),
           ('SIM-C04',[105,2480],[-.32,.50],2.3),
           ('SIM-A23',[-250,2355],[.47,.23],3.0),
           ('SIM-D12',[215,2630],[-.38,-.33],1.5)]
    if threat is not None:
        target,t=threat; v=np.array([.72,-.26]); start=np.asarray(target)-v*t
        specs.append(('SIM-X09',start.tolist(),v.tolist(),1.8))
    out=[]
    for k,(name,origin,velocity,radius) in enumerate(specs):
        rng=np.random.default_rng(26059+k)
        origin=np.array(origin,float); velocity=np.array(velocity,float)
        observations=np.array([origin+velocity*t+rng.normal(0,.30,2) for t in [-24,-18,-12,-6,0]])
        state,P=kalman(observations)
        # Current dominates the toy forcing; wind leeway is an assumed small residual.
        v=state[2:]*(.8*current+.2*wind)*drift
        times=np.arange(0,73,.5)
        positions=state[:2]+times[:,None]*v
        # Covariance propagates with velocity uncertainty + process drift noise.
        sigma=np.sqrt(np.maximum(.1,(P[0,0]+P[1,1])/2)+times**2*.0025+times*.08)
        r90=2.146*sigma # radial 90% factor for isotropic Gaussian only.
        out.append({'id':name,'origin':state[:2].tolist(),'velocity':v.tolist(),
                    'size_km':radius*2,'radius_km':radius,'history':observations.round(3).tolist(),
                    'times':times.tolist(),'positions':positions.round(3).tolist(),
                    'uncertainty_km':np.round(r90,3).tolist(),
                    'source':'Synthetic observations; linear Kalman + forcing model',
                    'uncertainty_label':'Nominal 90% Gaussian radius; not field-calibrated',
                    'speed_km_h':round(float(np.linalg.norm(v)),3),
                    'heading_deg':round(float(np.degrees(np.arctan2(v[0],v[1]))%360),1),
                    'lonlat':lonlat(state[:2])})
    return out


def position_at(berg,t):
    t=float(np.clip(t,0,72))
    return np.array([np.interp(t,berg['times'],np.array(berg['positions'])[:,i]) for i in (0,1)])


def uncertainty_at(berg,t):return float(np.interp(t,berg['times'],berg['uncertainty_km']))


def closest_approach(route,berg):
    """Piecewise linear analytic CPA across all route and forecast breakpoints."""
    pts=np.array(route['points']); times=pts[:,2]
    if len(pts)<2:return {'cpa_km':float('inf'),'tcpa_h':0.,'berg_id':berg['id']}
    cuts=np.unique(np.r_[times,np.array(berg['times'])[(np.array(berg['times'])>times[0])&(np.array(berg['times'])<times[-1])]])
    best=(float('inf'),float(times[0]))
    for a,b in zip(cuts[:-1],cuts[1:]):
        va=np.array([np.interp(a,times,pts[:,i]) for i in (0,1)])
        vb=np.array([np.interp(b,times,pts[:,i]) for i in (0,1)])
        ra=va-position_at(berg,a); rb=vb-position_at(berg,b); delta=rb-ra
        u=float(np.clip(-np.dot(ra,delta)/max(float(np.dot(delta,delta)),1e-12),0,1))
        d=float(np.linalg.norm(ra+u*delta)); t=a+u*(b-a)
        if d<best[0]:best=(d,t)
    return {'cpa_km':round(best[0],3),'tcpa_h':round(best[1]-times[0],3),
            'absolute_hour':round(best[1],3),'berg_id':berg['id'],
            'required_clearance_km':round(8+berg['radius_km']+uncertainty_at(berg,best[1]),3)}
