"""Optional developer utility: repack a downloaded Natural Earth shapefile.
Normal users already have data/geography/antarctica.geojson and do not run this.
Usage: python scripts/build_geography.py path/to/naturalearth_lowres.shp
Optional dependency: pyogrio. Do not use reference geography for navigation.
"""
from pathlib import Path
import argparse,json
ROOT=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('shapefile',type=Path)
    args=parser.parse_args()
    try:import pyogrio
    except ImportError:raise SystemExit('Optional build dependency required: python -m pip install pyogrio')
    from shapely.geometry import mapping
    g=pyogrio.read_dataframe(args.shapefile)
    col=next((c for c in ['name','NAME','ADMIN','SOVEREIGNT'] if c in g.columns),None)
    if col is None:raise SystemExit('Cannot identify the country name column.')
    selection=g[g[col]=='Antarctica']
    if len(selection)==0:raise SystemExit('The input contains no Antarctica feature.')
    geometry=selection.geometry.union_all()
    out={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'name':'Antarctica','source':'Natural Earth 1:110m, public domain','use':'Reference only; not a navigation chart'},'geometry':mapping(geometry)}]}
    path=ROOT/'data/geography/antarctica.geojson'
    path.write_text(json.dumps(out,separators=(',',':')))
    print('Wrote',path)
if __name__=='__main__':main()
