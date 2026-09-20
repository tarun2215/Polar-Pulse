"""Confirm the shipped numerical RF artifact reproduces measured holdout MAE."""
import numpy as np
import pytest
from ml.train import generate
from backend.app.forecast import FORECASTER
from backend.app.engine import ENGINE
@pytest.fixture(scope='module')
def heldout():
    x,y,g=generate()
    keep=g>=75;x=x[keep];truth=np.clip(x[:,0]+y[keep],0,1)
    return x,truth,FORECASTER.predict(x)
@pytest.mark.parametrize('h',[6,12,24,48,72])
def test_portable_rf_holdout_mae_reproduces_published_value(h,heldout):
    x,truth,pred=heldout;idx=x[:,6]==h
    measured=np.mean(np.abs(truth[idx]-pred[idx]))*100
    published=next(v for v in ENGINE.metrics()['sea_ice']['horizons'] if v['horizon_h']==h)['mae_pp']
    assert measured==pytest.approx(published,abs=.001)
