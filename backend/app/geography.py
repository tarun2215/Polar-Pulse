"""Local south-polar stereographic coordinates in km; WGS84 geodesic distances.
Natural Earth is a coarse reference basemap, not a hydrographic navigation chart.
"""
from pathlib import Path
import json
import numpy as np
from pyproj import Transformer, Geod
from shapely.geometry import shape, Point, LineString, box, mapping
from shapely.ops import transform

ROOT=Path(__file__).resolve().parents[2]
CRS='+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=76 +datum=WGS84 +units=km +no_defs'
TO_XY=Transformer.from_crs('EPSG:4326',CRS,always_xy=True)
TO_LL=Transformer.from_crs(CRS,'EPSG:4326',always_xy=True)
GEOD=Geod(ellps='WGS84')
BOUNDS=(-530.0,2180.0,530.0,2690.0) # min x, min y, max x, max y
STEP=10.0
XS=np.arange(BOUNDS[0],BOUNDS[2]+STEP/2,STEP)
YS=np.arange(BOUNDS[1],BOUNDS[3]+STEP/2,STEP)
XX,YY=np.meshgrid(XS,YS)
LON,LAT=TO_LL.transform(XX,YY)
_geo=json.loads((ROOT/'data/geography/antarctica.geojson').read_text())
LAND=transform(TO_XY.transform,shape(_geo['features'][0]['geometry']))
# Deliberately conservative in the toy geometry, but NOT an operational clearance.
LAND_BUFFER=LAND.buffer(5)
LAND_MASK=np.array([LAND_BUFFER.contains(Point(x,y)) for x,y in zip(XX.ravel(),YY.ravel())]).reshape(XX.shape)


def lonlat(p):
    lon,lat=TO_LL.transform(float(p[0]),float(p[1]))
    return [round(lon,6),round(lat,6)]


def distance(a,b):
    la,lb=lonlat(a),lonlat(b)
    return abs(GEOD.inv(*la,*lb)[2])/1000


def geometry_payload():
    clipped=LAND.intersection(box(*BOUNDS))
    lines=[]
    # Graticules: one-degree latitude; two-degree longitude.
    for lat in np.arange(-70,-64,.5):
        lons=np.linspace(62,90,120); x,y=TO_XY.transform(lons,np.full(len(lons),lat))
        lines.append({'kind':'latitude','label':f'{abs(lat):.1f} S','points':np.round(np.column_stack([x,y]),2).tolist()})
    for lon in range(62,91,2):
        lats=np.linspace(-72,-63,120); x,y=TO_XY.transform(np.full(len(lats),lon),lats)
        lines.append({'kind':'longitude','label':f'{lon} E','points':np.round(np.column_stack([x,y]),2).tolist()})
    return {'bounds':BOUNDS,'step_km':STEP,'shape':XX.shape,'land':mapping(clipped),
            'antarctica':mapping(LAND.simplify(5)),'graticules':lines,
            'station':{'name':'Bharati','lon':76+11.72/60,'lat':-(69+24.41/60),
                       'xy':list(TO_XY.transform(76+11.72/60,-(69+24.41/60)))},
            'source':'Natural Earth 1:110m, public domain; reference geometry only.',
            'projection':'South polar stereographic, central meridian 76 E; coordinates in km.'}
