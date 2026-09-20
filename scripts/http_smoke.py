"""Launch the actual HTTP server and verify it over a loopback socket."""
from pathlib import Path
import sys,subprocess,time,socket,json
import httpx
ROOT=Path(__file__).resolve().parents[1]
with socket.socket() as s:
    s.bind(('127.0.0.1',0));port=s.getsockname()[1]
base=f'http://127.0.0.1:{port}'
log=(ROOT/'evidence/http-server-log.txt').open('w')
p=subprocess.Popen([sys.executable,str(ROOT/'start.py'),'--no-browser','--port',str(port)],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
checks=[];t0=time.perf_counter()
try:
    with httpx.Client(base_url=base,timeout=25,trust_env=False) as client:
        for _ in range(120):
            if p.poll() is not None:raise RuntimeError('Server exited; see http-server-log.txt')
            try:
                if client.get('/api/health').status_code==200:break
            except httpx.HTTPError:pass
            time.sleep(.25)
        else:raise RuntimeError('Server did not become ready')
        startup=round(time.perf_counter()-t0,3)
        for path in ['/','/assets/app.js','/assets/styles.css','/favicon.svg','/api/health','/api/bootstrap','/openapi.json','/docs']:
            r=client.get(path);assert r.status_code==200,(path,r.text)
            checks.append({'method':'GET','path':path,'status':r.status_code,'bytes':len(r.content)})
        r=client.post('/api/scenario/simulate',json={'hazard':True});assert r.status_code==200
        data=r.json();assert data['delta']['new_clearance_km']>0
        checks.append({'method':'POST','path':'/api/scenario/simulate','status':r.status_code,'bytes':len(r.content)})
        (ROOT/'evidence/default-hazard-scenario.json').write_text(json.dumps(data,indent=2))
        report={'result':'PASS','transport':'Actual HTTP over loopback into uvicorn, not TestClient','startup_seconds':startup,'checks':checks,'python':sys.version.split()[0],'platform':sys.platform,'note':'This execution environment is Linux. Windows launcher and normal Windows browser require a local user check.'}
        (ROOT/'evidence/http-smoke.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
finally:
    p.terminate()
    try:p.wait(timeout=5)
    except subprocess.TimeoutExpired:p.kill();p.wait()
    log.close()
