"""Reproducible synthetic-scene forecasting experiment. Never production accuracy.
Export RF trees as ordinary JSON, avoiding executable pickle/model-version coupling.
Run: python -m ml.train
"""
from pathlib import Path
import json
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
ROOT = Path(__file__).resolve().parents[1]
HORIZONS = [6, 12, 24, 48, 72]
FEATURES = ['concentration_now', 'trend_per_hour', 'air_temperature_c', 'sst_c',
            'wind_north_m_s', 'current_north_m_s', 'horizon_hours']

def generate(seed=26059):
    rng = np.random.default_rng(seed)
    xs, ys, groups = [], [], []
    for scene in range(90):
        regime = rng.normal(0, .0007)
        for _ in range(70):
            c = rng.uniform(.02, .86)
            trend = rng.uniform(-.0035, .0055)
            air, sst = rng.uniform(-15, 1), rng.uniform(-2.5, .5)
            wn, cn = rng.uniform(-12, 12), rng.uniform(-.25, .25)
            rate = .56*trend + .0008*(-1.6-sst) + .00010*(-5-air) - .00006*wn - .0007*cn
            for h in HORIZONS:
                change = rate * (h / (1 + h/200)) + .022*np.sin(h/24)*np.tanh((-1.6-sst)*2)
                target = np.clip(c + change + regime*h + rng.normal(0, .006+ h*.00018), 0, 1)
                xs.append([c,trend,air,sst,wn,cn,h]); ys.append(target-c); groups.append(scene)
    return np.array(xs), np.array(ys), np.array(groups)

def export_tree(t):
    tr = t.tree_
    return {'left':tr.children_left.tolist(), 'right':tr.children_right.tolist(),
            'feature':tr.feature.tolist(), 'threshold':np.round(tr.threshold,9).tolist(),
            'value':np.round(tr.value[:,0,0],9).tolist()}

def main():
    X,y,g = generate()
    # Entire scenes are disjoint: 0..59 train, 60..74 calibration, 75..89 test.
    train,cal,test = g<60,(g>=60)&(g<75),g>=75
    model = RandomForestRegressor(n_estimators=40,max_depth=10,min_samples_leaf=8,
                                 max_features=.9,random_state=26059,n_jobs=2)
    model.fit(X[train],y[train])
    q={}; rows=[]
    pred=model.predict(X[test]); truth=np.clip(X[test,0]+y[test],0,1)
    predc=np.clip(X[test,0]+pred,0,1)
    cal_res=np.abs(y[cal]-model.predict(X[cal]))
    for h in HORIZONS:
        cm=X[cal,6]==h; tm=X[test,6]==h
        # Split conformal finite-sample rank (capped at sample count).
        vals=np.sort(cal_res[cm]); rank=min(len(vals),int(np.ceil((len(vals)+1)*.90)))
        q[str(h)]=float(vals[rank-1])
        rows.append({'horizon_h':h,'mae_pp':round(mean_absolute_error(truth[tm],predc[tm])*100,3),
                     'rmse_pp':round(np.sqrt(mean_squared_error(truth[tm],predc[tm]))*100,3),
                     'r2':round(r2_score(truth[tm],predc[tm]),4),
                     'persistence_mae_pp':round(mean_absolute_error(truth[tm],X[test,0][tm])*100,3),
                     'interval_half_width_pp':round(q[str(h)]*100,3),
                     'test_coverage':round(float(np.mean(np.abs(predc[tm]-truth[tm])<=q[str(h)])),4),
                     'test_samples':int(tm.sum())})
    out={'schema':1,'name':'Random forest delta forecaster','features':FEATURES,
         'n_trees':len(model.estimators_),'calibration_quantiles':q,
         'feature_importance':dict(zip(FEATURES,np.round(model.feature_importances_,5).tolist())),
         'trees':[export_tree(t) for t in model.estimators_]}
    metrics={'data_type':'Synthetic independent scenes; not Antarctic validation',
             'seed':26059,'train_scenes':60,'calibration_scenes':15,'test_scenes':15,
             'train_samples':int(train.sum()),'calibration_samples':int(cal.sum()),
             'test_samples':int(test.sum()),'split':'Held-out scenes; no cell from a test scene enters training or calibration.',
             'model':out['name'],'horizons':rows,'feature_importance':out['feature_importance'],
             'interval_note':'90% split-conformal nominal intervals calibrated on synthetic scenes only. Correlated cells violate iid assumptions; empirical scene-held-out coverage is reported, not a real-world guarantee.'}
    (ROOT/'models/sea_ice_rf.json').write_text(json.dumps(out,separators=(',',':')))
    (ROOT/'models/metrics.json').write_text(json.dumps(metrics,indent=2))
    sample=np.column_stack([X[test][:150],np.clip(X[test,0][:150]+y[test][:150],0,1)])
    np.savetxt(ROOT/'data/demo/heldout_samples.csv',sample,delimiter=',',header=','.join(FEATURES+['target_concentration']),comments='')
    print(json.dumps(metrics,indent=2))
if __name__=='__main__':main()
