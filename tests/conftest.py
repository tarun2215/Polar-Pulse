from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.engine import ENGINE

@pytest.fixture(scope='session')
def client():
    return TestClient(app)

@pytest.fixture(scope='session')
def baseline():
    return ENGINE.get()

@pytest.fixture(scope='session')
def hazard():
    return ENGINE.get({'hazard':True})
