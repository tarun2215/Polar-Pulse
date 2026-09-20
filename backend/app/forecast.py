"""Portable inference for the trained scikit-learn random forest.
Only ordinary numerical JSON is loaded. No untrusted pickle files are accepted.
"""
from pathlib import Path
import json
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
HORIZONS=np.array([0,6,12,24,48,72],dtype=float)

class IceForecaster:
    def __init__(self):
        self.artifact=json.loads((ROOT/'models/sea_ice_rf.json').read_text())
        self.trees=[{k:np.array(v) for k,v in t.items()} for t in self.artifact['trees']]
    def predict(self,features):
        X=np.asarray(features,dtype=float)
        total=np.zeros(len(X))
        for t in self.trees:
            idx=np.zeros(len(X),dtype=int)
            while True:
                active=t['left'][idx]!=-1
                if not active.any():break
                r=np.flatnonzero(active); n=idx[r]; f=t['feature'][n]
                idx[r]=np.where(X[r,f]<=t['threshold'][n],t['left'][n],t['right'][n])
            total+=t['value'][idx]
        return np.clip(X[:,0]+total/len(self.trees),0,1)
    def interval(self,h):
        qs=self.artifact['calibration_quantiles']
        return float(np.interp(h,HORIZONS,[0]+[qs[str(int(t))] for t in HORIZONS[1:]]))

FORECASTER=IceForecaster()
