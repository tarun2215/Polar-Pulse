"""Held-out synthetic tracks; evaluates actual Kalman extrapolation, not screenshots."""
from pathlib import Path
import json
import numpy as np
from backend.app.icebergs import kalman
ROOT=Path(__file__).resolve().parents[1]

def main():
    values={h:[] for h in [6,12,24,48]};stationary={h:[] for h in values}
    for scene in range(100):
        rng=np.random.default_rng(90000+scene)
        p=rng.uniform([-200,2400],[200,2600]);v=rng.uniform([-.65,-.5],[.8,.5])
        obs=np.array([p+t*v+rng.normal(0,.3,2) for t in [-24,-18,-12,-6,0]])
        state,_=kalman(obs);true=p.copy();vel=v.copy();pred_errors=[];fixed_errors=[]
        for h in range(1,49):
            vel+=rng.normal(0,.012,2);true+=vel
            pred=state[:2]+h*state[2:]
            pred_errors.append(float(np.linalg.norm(pred-true)))
            fixed_errors.append(float(np.linalg.norm(state[:2]-true)))
            if h in values:
                values[h].append([np.mean(pred_errors),pred_errors[-1]])
                stationary[h].append(fixed_errors[-1])
    rows=[{'horizon_h':h,'ade_km':round(float(np.mean(np.array(v)[:,0])),3),
           'fde_km':round(float(np.mean(np.array(v)[:,1])),3),
           'stationary_fde_km':round(float(np.mean(stationary[h])),3)} for h,v in values.items()]
    out={'name':'Linear Kalman + constant forcing','test_tracks':100,'seed_range':'90000..90099',
         'dataset':'Independent synthetic tracks with noisy observations and stochastic future acceleration',
         'horizons':rows,'limitation':'No satellite-identified iceberg tracks used; real-world skill unknown.'}
    (ROOT/'models/iceberg_metrics.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
if __name__=='__main__':main()
