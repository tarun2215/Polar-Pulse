from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scripts.browser_support import load_bridged
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1600,'height':1100},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda e:errors.append('console: '+e.text) if e.type=='error' else None)
 load_bridged(page)
 page.wait_for_selector('#polar-map',timeout=30000)
 page.screenshot(path=str(ROOT/'evidence/01-mission-control.png'),full_page=True)
 print('TITLE',page.title(),'MAP',page.locator('#polar-map').count(),'ERRORS',errors)
 print('DIMENSIONS',page.evaluate('({width:innerWidth,body:document.body.scrollWidth,height:document.body.scrollHeight})'))
 print('MAP RECT',page.locator('#polar-map').bounding_box())
 print('TEXT',page.locator('h1').inner_text())
 print('ROUTE CARDS',page.locator('.route-card').count())
 page.locator('[data-action="hazard"]').first.click()
 page.wait_for_function("document.querySelector('[data-action=\"clear-hazard\"]') && !document.querySelector('.map-busy')",timeout=30000)
 page.screenshot(path=str(ROOT/'evidence/02-predictive-reroute.png'),full_page=True)
 page.locator('[data-action="explain"]').first.click()
 page.wait_for_selector('.modal')
 page.screenshot(path=str(ROOT/'evidence/03-explainable-decision.png'),full_page=True)
 print('FINAL ERRORS',errors)
 (ROOT/'evidence/browser-smoke.json').write_text(json.dumps({'errors':errors,'desktop':'1600x1100','browser_transport':'Test-only offline bridge to actual FastAPI endpoints; managed Chromium blocks loopback navigation','result':'pass' if not errors else 'fail'},indent=2))
 browser.close()
