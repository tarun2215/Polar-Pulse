"""Browser test helpers, including an offline bridge for managed test browsers.
The bridge is test-only: it serves the SAME compiled UI modules and routes calls
into the actual FastAPI TestClient. It does not alter application source files.
Normal user browsers navigate directly to the local HTTP server.
"""
from pathlib import Path
import re,base64,json
from fastapi.testclient import TestClient
from backend.app.main import app
ROOT=Path(__file__).resolve().parents[1]

def load_bridged(page):
    client=TestClient(app)
    def request_bridge(source,url,options=None):
        options=options or {}
        from urllib.parse import urlsplit
        split=urlsplit(str(url));path=split.path+(('?'+split.query) if split.query else '')
        if not path.startswith('/api/'):
            return {'status':404,'body':'Not a test API path','headers':{'content-type':'text/plain'}}
        response=client.request(options.get('method','GET'),path,
                                content=options.get('body'),headers=options.get('headers',{}))
        return {'status':response.status_code,'body':response.text,
                'headers':{'content-type':response.headers.get('content-type','application/json')}}
    page.expose_binding('polarTestBridge',request_bridge)
    page.evaluate('''() => {window.fetch = async (url, options={}) => {
        const r = await window.polarTestBridge(String(url), options);
        return new Response(r.body, {status:r.status, headers:r.headers});
    };}''')
    cache={}
    def module(name):
        if name in cache:return cache[name]
        src=(ROOT/'frontend/dist/assets'/name).read_text()
        src=re.sub(r"(['\"])\./([a-zA-Z0-9_-]+\.js)\1",lambda m:json.dumps(module(m.group(2))),src)
        src=re.sub(r'//# sourceMappingURL=.*','',src)
        url='data:text/javascript;base64,'+base64.b64encode(src.encode()).decode();cache[name]=url;return url
    css=(ROOT/'frontend/dist/assets/styles.css').read_text()
    html=f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>POLAR PULSE | Antarctic Navigation Intelligence</title><style>{css}</style></head><body><div id="app"></div><script type="module" src="{module('app.js')}"></script></body></html>'''
    page.set_content(html,wait_until='load')
    page.wait_for_selector('#polar-map',timeout=30000)
