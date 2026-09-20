"""Create a source-plus-built-assets ZIP; never include environments or font files."""
from pathlib import Path
import zipfile,hashlib,json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'POLAR_PULSE_FULL_PROTOTYPE.zip'
skip={'.venv','node_modules','__pycache__','.pytest_cache','.git'}
font_ext={'.ttf','.otf','.woff','.woff2','.eot'}
paths=[p for p in ROOT.rglob('*') if p.is_file() and not (set(p.relative_to(ROOT).parts)&skip) and p.suffix.lower() not in font_ext and p.name not in ['release-manifest.json'] and p.suffix not in ['.pyc','.pyo']]
manifest={'product':'POLAR PULSE','version':'1.0.0','archive_layout':'Project files at archive root; extract into a folder before running','files':[{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(paths)]}
manifest_path=ROOT/'release-manifest.json';manifest_path.write_text(json.dumps(manifest,indent=2));paths.append(manifest_path)
with zipfile.ZipFile(OUT,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=8) as z:
    for p in sorted(paths):z.write(p,p.relative_to(ROOT).as_posix())
with zipfile.ZipFile(OUT) as z:
    assert z.testzip() is None
    assert 'START_WINDOWS.bat' in z.namelist() and 'frontend/dist/assets/app.js' in z.namelist()
    assert not any(Path(n).suffix.lower() in font_ext for n in z.namelist())
digest=hashlib.sha256(OUT.read_bytes()).hexdigest()
(OUT.parent/'POLAR_PULSE_SHA256.txt').write_text(f'{digest}  {OUT.name}\n')
print(f'{OUT}\n{len(paths)} files | {OUT.stat().st_size:,} bytes\nSHA256 {digest}')
