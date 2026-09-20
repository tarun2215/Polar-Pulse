"""Compile TypeScript and copy local assets. Compiled files ship with releases.
Requires TypeScript (npm install in frontend), unless a tsc executable is provided.
"""
from pathlib import Path
import shutil,subprocess,os,sys
ROOT=Path(__file__).resolve().parents[1];FE=ROOT/'frontend'
local=FE/'node_modules/.bin'/('tsc.cmd' if os.name=='nt' else 'tsc')
tsc=os.environ.get('TSC') or (str(local) if local.exists() else shutil.which('tsc'))
if not tsc:raise SystemExit('TypeScript missing. For development: cd frontend && npm install. End users do not need to rebuild.')
subprocess.run([tsc,'-p',str(FE/'tsconfig.json')],check=True,cwd=ROOT,shell=os.name=='nt')
(FE/'dist/assets').mkdir(parents=True,exist_ok=True)
shutil.copy2(FE/'index.html',FE/'dist/index.html')
shutil.copy2(FE/'src/styles.css',FE/'dist/assets/styles.css')
for p in (FE/'public').iterdir():
 if p.is_file():shutil.copy2(p,FE/'dist'/p.name)
print('Built local frontend:',FE/'dist')
