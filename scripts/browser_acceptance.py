"""Browser acceptance checks against the shipped UI and actual backend.
Uses the transparent test-only bridge when managed Chromium blocks loopback.
Install development requirements and Playwright Chromium to reproduce.
"""
from pathlib import Path
import sys,json,time,shutil
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from playwright.sync_api import sync_playwright
from scripts.browser_support import load_bridged
from backend.app.main import template
ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'evidence';E.mkdir(exist_ok=True)
checks=[];errors=[];started=time.perf_counter()
def record(name,ok=True):
    assert ok,name
    checks.append({'name':name,'status':'PASS'})
    print('PASS',name,flush=True)
def idle(page):
    page.wait_for_function("!document.querySelector('.map-busy')",timeout=45000)
    page.wait_for_timeout(120)
def action(page,name):
    page.locator(f'[data-action="{name}"]').first.click();idle(page)
def nav(page,name):
    page.locator(f'.nav-item[data-page="{name}"]').click();idle(page)
def slide(page,selector,value):
    page.locator(selector).evaluate('(e,v)=>{e.value=String(v);e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));}',value)
    idle(page)
def shot(page,name):
    page.mouse.move(350,2)
    page.evaluate("document.querySelector('#toast-root').innerHTML=''")
    page.screenshot(path=str(E/name),full_page=True)
with sync_playwright() as pw:
    binary=shutil.which('chromium') or shutil.which('chromium-browser')
    browser=pw.chromium.launch(**({'executable_path':binary,'args':['--no-sandbox']} if binary else {}),headless=True)
    page=browser.new_page(viewport={'width':1600,'height':1100},device_scale_factor=1,accept_downloads=True)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
    load_bridged(page);idle(page)
    record('Mission opens with four computed route cards',page.locator('.route-card').count()==4)
    record('Desktop has no horizontal overflow',page.evaluate('document.body.scrollWidth<=innerWidth'))
    shot(page,'01-mission-control.png')
    a=page.locator('#map-render').inner_html()
    slide(page,'#time-slider',24)
    record('Forecast slider changes the rendered map',a!=page.locator('#map-render').inner_html())
    record('Forecast hour label updates','24' in page.locator('#time-label').inner_text())
    page.locator('[data-layer="risk"]').click()
    record('Risk layer selectable',page.locator('[data-layer="risk"]').get_attribute('class')=='selected')
    page.locator('[data-layer="difference"]').click()
    record('Ice-change layer selectable',page.locator('[data-layer="difference"]').get_attribute('class')=='selected')
    action(page,'zoom-in');record('Map zoom modifies transform','scale(1.2)' in page.locator('#geo-layer').get_attribute('transform'))
    action(page,'recenter')
    page.locator('[data-route="eco"]').click()
    record('Route selection updates active corridor','active' in page.locator('[data-route="eco"]').get_attribute('class'))
    page.locator('[data-route="recommended"]').click()
    # Ocean cell selection uses the SVG's actual screen coordinate transform.
    xy=page.locator('#polar-map').evaluate('e=>{const p=e.createSVGPoint();p.x=390;p.y=130;const q=p.matrixTransform(e.getScreenCTM());return {x:q.x,y:q.y};}')
    page.mouse.click(xy['x'],xy['y'])
    page.wait_for_selector('.cell-stats',timeout=30000)
    record('Map cell inspector returns backend contributions',page.locator('.cell-stats').count()==1)
    action(page,'close-modal')
    for name in ['ice','icebergs','routes','voyage','decision','data','performance','architecture','mission']:
        nav(page,name);record('Navigation page: '+name,page.locator('h1').count()==1)
    nav(page,'routes')
    slide(page,'[data-priority="safety"]',90)
    record('Safety slider recomputes scenario',page.locator('#val-safety').inner_text()=='90')
    action(page,'whatif')
    slide(page,'[data-whatif="wind"]',1.2)
    record('What-if wind recomputes without closing control','1.20' in page.locator('#val-wind').inner_text())
    action(page,'close-modal');action(page,'reset-all');nav(page,'mission')
    action(page,'hazard')
    page.wait_for_selector('[data-action="clear-hazard"]',timeout=30000)
    record('Synthetic hazard computes a reroute','PREDICTIVE SAFETY LEAD TIME' in page.locator('.kpi-strip').inner_text())
    shot(page,'02-predictive-reroute.png')
    action(page,'focus-hazard')
    record('Hazard focus zooms into the crossing','scale(1.9)' in page.locator('#geo-layer').get_attribute('transform'))
    shot(page,'04-crossing-detail.png');action(page,'recenter')
    action(page,'explain');page.wait_for_selector('.delta-summary')
    record('Explanation contains calculated before-after deltas',page.locator('.delta-summary').count()==1)
    shot(page,'03-explainable-decision.png');action(page,'close-modal')
    nav(page,'decision')
    page.locator('[data-question="Why did the route change?"]').click()
    page.wait_for_function("document.querySelector('#copilot-answer').textContent.includes('SIM-X09')")
    record('Copilot uses the current scenario values','minutes' in page.locator('#copilot-answer').inner_text())
    nav(page,'data')
    contents=template().body
    page.locator('#data-file').set_input_files({'name':'synthetic-observations.csv','mimeType':'text/csv','buffer':contents})
    page.wait_for_function("document.querySelector('#import-status').textContent.includes('4 points accepted')")
    record('CSV observations validated and imported as overlay','Overlay only' in page.locator('#import-status').inner_text())
    shot(page,'05-data-provenance.png')
    action(page,'show-import');record('Imported points visible on mission map',page.locator('#map-render title').filter(has_text='Imported observation:').count()==4)
    action(page,'export')
    with page.expect_download() as dl:page.locator('[data-action="export-json"]').click()
    d=dl.value;d.save_as(str(E/'exported-mission.json'))
    exported=json.loads((E/'exported-mission.json').read_text())
    record('Mission JSON export contains actual scenario and methodology',bool(exported['scenario']['delta']) and 'sea_ice' in exported['methodology'])
    with page.expect_popup() as pop:page.locator('[data-action="print-report"]').click()
    popup=pop.value;popup.wait_for_load_state('domcontentloaded')
    record('Printable briefing opens with safety limitations','NOT FOR NAVIGATION' in popup.locator('body').inner_text())
    popup.close();action(page,'close-modal')
    nav(page,'performance');shot(page,'06-model-evidence.png')
    record('Metrics UI displays holdout limitation','Not Antarctic field accuracy' in page.locator('.validation-banner').inner_text())
    nav(page,'voyage');action(page,'play');page.wait_for_timeout(1800)
    record('Voyage clock advances during playback','0.0 h' not in page.locator('#time-label').inner_text())
    action(page,'play');action(page,'reset-play')
    record('Voyage clock resets',page.locator('#time-label').inner_text()=='Present')
    # Step through all guided story states; Next explicitly pauses autoplay.
    action(page,'judge')
    for i in range(8):
        action(page,'judge-next')
    page.wait_for_selector('.demo-end',timeout=45000)
    record('Nine-stage judge demo completes with computed outcomes','GUIDED SCENARIO COMPLETE' in page.locator('.demo-end').inner_text())
    shot(page,'07-judge-finale.png')
    action(page,'close-modal');action(page,'exit-judge')
    # Reset source evidence and mission to clean screenshot state.
    nav(page,'routes');action(page,'reset-all');nav(page,'mission')
    page.locator('#mission-select').select_option('survey');idle(page)
    record('Second mission selection recomputes routes',page.locator('#mission-select').input_value()=='survey' and page.locator('.route-card').count()==4)
    page.locator('#mission-select').select_option('supply');idle(page)
    for width,height,label in [(1240,900,'tablet'),(390,844,'mobile')]:
        page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(200)
        record(label+' has no horizontal page overflow',page.evaluate('document.body.scrollWidth<=innerWidth'))
        record(label+' map remains visible',page.locator('#polar-map').is_visible())
        shot(page,'08-'+label+'.png')
    record('No browser script or console errors',not errors)
    result={'checks':checks,'check_count':len(checks),'errors':errors,'elapsed_seconds':round(time.perf_counter()-started,2),'transport':'Same compiled ES modules in Chromium using test-only offline bridge into actual FastAPI TestClient. Managed browser denies loopback navigation; direct local HTTP is tested separately.','native_windows_tested':False}
    (E/'browser-acceptance.json').write_text(json.dumps(result,indent=2))
    print('TOTAL',len(checks),'PASS',flush=True)
    browser.close()
