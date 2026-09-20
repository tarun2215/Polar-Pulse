"""Time-labelled, multi-objective A* with hard land/ice/iceberg constraints.
Labels use 0.75 h buckets; weighted heuristic accelerates the approximate search.
Every returned route is independently validated against the continuous model.
"""
from dataclasses import dataclass
from heapq import heappush,heappop
from itertools import count
from time import perf_counter
import math
import numpy as np
from shapely.geometry import Point,LineString
from .geography import XS,YS,XX,YY,LAND_MASK,LAND_BUFFER,STEP,GEOD,TO_LL,BOUNDS,distance,lonlat
from .icebergs import closest_approach

MAX_ICE=.78
MAX_WAVE=5.0
MAX_HOURS=48.

@dataclass(frozen=True)
class Profile:
    id:str
    name:str
    speed:float
    safety:float
    fuel:float
    time:float


def profiles(safety=75.,fuel=45.,time=45.):
    return [Profile('fastest','Fastest',21.,.25,.1,4.),
            Profile('safest','Safety priority',17.,8.,.25,.3),
            Profile('eco','Fuel saver',14.,1.5,4.,.3),
            Profile('recommended','AI balanced',17.+3*time/100,1.+safety/14,.2+fuel/35,.2+time/40)]


def fuel_rate(speed_kmh,ice,wave):
    # Explicit illustrative vessel model. Hotel load + cubic propulsive demand,
    # ice drag multiplier and a small wave penalty. No calibration to a real ship.
    return 30.+150.*(max(speed_kmh,0)/20.)**3*(1+4*ice**2)+10.*max(wave-1,0)


class NavigationGraph:
    def __init__(self):
        self.points=np.column_stack([XX.ravel(),YY.ravel()]); self.width=len(XS)
        self.adj=[[] for _ in self.points]
        for j in range(len(YS)):
            for i in range(len(XS)):
                a=j*self.width+i
                if LAND_MASK[j,i]:continue
                for di,dj in [(1,0),(0,1),(1,1),(-1,1)]:
                    ni,nj=i+di,j+dj
                    if ni<0 or ni>=len(XS) or nj>=len(YS) or LAND_MASK[nj,ni]:continue
                    b=nj*self.width+ni
                    # Disallow diagonal corner cutting, plus segment/land intersections.
                    if di and dj and (LAND_MASK[j,ni] or LAND_MASK[nj,i]):continue
                    if LAND_BUFFER.intersects(LineString([self.points[a],self.points[b]])):continue
                    d=distance(self.points[a],self.points[b])
                    self.adj[a].append((b,d));self.adj[b].append((a,d))

GRAPH=NavigationGraph()


class Planner:
    def __init__(self,environment):
        self.env=environment
        self.fields=[]
        # One-hour tables speed label expansion; final validation uses the actual
        # environment with half-km spatial checks, not only this lookup table.
        for h in range(73):
            v=environment.sample(XX,YY,np.full(XX.shape,h))
            self.fields.append(np.stack([v['ice'],v['risk'],v['clearance'],v['wave'],v['ce'],v['cn']]))
        self.fields=np.asarray(self.fields)

    def lookup(self,x,y,t):
        gx=min(len(XS)-1.000001,max(0.,(x-XS[0])/STEP)); gy=min(len(YS)-1.000001,max(0.,(y-YS[0])/STEP))
        i,j=int(gx),int(gy);fx,fy=gx-i,gy-j
        k=min(71,max(0,int(t))); ft=min(1.,max(0.,t-k))
        a=(self.fields[k,:,j,i]*(1-fx)*(1-fy)+self.fields[k,:,j,i+1]*fx*(1-fy)+
           self.fields[k,:,j+1,i]*(1-fx)*fy+self.fields[k,:,j+1,i+1]*fx*fy)
        b=(self.fields[k+1,:,j,i]*(1-fx)*(1-fy)+self.fields[k+1,:,j,i+1]*fx*(1-fy)+
           self.fields[k+1,:,j+1,i]*(1-fx)*fy+self.fields[k+1,:,j+1,i+1]*fx*fy)
        return a*(1-ft)+b*ft

    def transition(self,a,b,t,d,profile):
        dx,dy=b[0]-a[0],b[1]-a[1]; norm=max(math.hypot(dx,dy),1e-9)
        mx,my=(a[0]+b[0])/2,(a[1]+b[1])/2
        c,r,cl,w,ce,cn=self.lookup(mx,my,t)
        through=profile.speed*max(.35,1-.55*c)*max(.5,1-.04*max(w-2,0))
        ground=max(3.,through+3.6*(ce*dx+cn*dy)/norm)
        dt=d/ground
        c,r,cl,w,ce,cn=self.lookup(mx,my,t+dt/2)
        through=profile.speed*max(.35,1-.55*c)*max(.5,1-.04*max(w-2,0))
        ground=max(3.,through+3.6*(ce*dx+cn*dy)/norm);dt=d/ground
        if t+dt>72:return None
        # Samples every <= 2.5 km, and an extra clearance buffer for interpolation.
        n=max(2,int(math.ceil(norm/2.5)))
        for k in range(n+1):
            u=k/n; cc,rr,clear,ww,_,_=self.lookup(a[0]+u*dx,a[1]+u*dy,t+dt*u)
            if cc>MAX_ICE or clear<1.0 or ww>MAX_WAVE:return None
        liters=dt*fuel_rate(through,c,w)
        cost=d/10+profile.safety*8*(r/100)*dt+profile.time*1.5*dt+profile.fuel*liters/150
        return dt,float(cost),float(liters)

    def plan(self,start,goal,profile,departure=0.,max_expansions=6000,max_seconds=3.0):
        started=perf_counter();start=np.asarray(start,float);goal=np.asarray(goal,float)
        for p in (start,goal):
            if not (BOUNDS[0]<=p[0]<=BOUNDS[2] and BOUNDS[1]<=p[1]<=BOUNDS[3]):
                return {'id':profile.id,'name':profile.name,'status':'no_route','reason':'Waypoint outside modeled coverage.'}
            if LAND_BUFFER.contains(Point(p)):
                return {'id':profile.id,'name':profile.name,'status':'no_route','reason':'Waypoint on land or within the toy shoreline buffer.'}
        if np.linalg.norm(goal-start)<1:
            return {'id':profile.id,'name':profile.name,'status':'no_route','reason':'Choose distinct offshore waypoints.'}
        pts=GRAPH.points;nx=len(pts)
        start_ids=np.argsort(np.linalg.norm(pts-start,axis=1))[:9]
        goal_ids=set(int(v) for v in np.argsort(np.linalg.norm(pts-goal,axis=1))[:9])
        points={-1:start,-2:goal}
        def xy(idx):return points[idx] if idx<0 else pts[idx]
        def adjacency(idx):
            if idx==-1:
                for n in start_ids:
                    p=pts[n]
                    if LAND_BUFFER.intersects(LineString([start,p])):continue
                    yield int(n),distance(start,p)
                return
            yield from GRAPH.adj[idx]
            if idx in goal_ids and not LAND_BUFFER.intersects(LineString([pts[idx],goal])):
                yield -2,distance(pts[idx],goal)
        glon,glat=lonlat(goal);llon,llat=TO_LL.transform(pts[:,0],pts[:,1])
        _,_,hd=GEOD.inv(llon,llat,np.full(nx,glon),np.full(nx,glat))
        vmax=profile.speed+3.6*float(np.max(np.hypot(self.env.ce,self.env.cn)))
        minrisk=float(np.min(self.fields[:,1]))/100
        minfuel=30.+150.*(profile.speed*(1-.55*MAX_ICE)*.88/20.)**3
        lower_per_km=.1+(profile.time*1.5+profile.safety*8*minrisk+profile.fuel*minfuel/150)/vmax
        # Weighted A*: trades global optimality for bounded demo latency.
        heuristic=np.abs(hd)/1000*lower_per_km*3.2
        def hh(idx):return 0. if idx==-2 else (distance(start,goal)*lower_per_km*3.2 if idx==-1 else float(heuristic[idx]))
        seq=count(); key=(-1,0); costs={key:0.}
        records=[{'key':key,'arrival':departure,'parent':None,'cost':0.}]
        heap=[(hh(-1),next(seq),0,0.)]; expansions=0;final=None
        while heap and expansions<max_expansions and perf_counter()-started<max_seconds:
            _,_,record_id,paid=heappop(heap)
            rec=records[record_id];key=rec['key']
            if paid>costs.get(key,float('inf'))+1e-9:continue
            idx,bucket=key;t=rec['arrival'];expansions+=1
            if idx==-2:final=record_id;break
            for n,d in adjacency(idx):
                # Zero connector edge is legal; the next graph edge advances time.
                tr=self.transition(xy(idx),xy(n),t,d,profile)
                if tr is None:continue
                dt,dc,liters=tr;arrival=t+dt
                if arrival-departure>MAX_HOURS:continue
                nk=(n,int((arrival-departure)/.75));ng=paid+dc
                if ng+1e-9<costs.get(nk,float('inf')):
                    costs[nk]=ng
                    new_id=len(records);records.append({'key':nk,'arrival':arrival,'parent':record_id,'cost':ng})
                    heappush(heap,(ng+hh(n),next(seq),new_id,ng))
        elapsed=(perf_counter()-started)*1000
        if final is None:
            return {'id':profile.id,'name':profile.name,'status':'no_route',
                    'reason':'No admissible route found within the model horizon/search budget. Hold and request operator review.',
                    'compute_ms':round(elapsed,1),'expanded_states':expansions}
        ancestry=[];k=final
        while k is not None:
            ancestry.append(records[k]);k=records[k]['parent']
        ancestry.reverse()
        route_points=[]
        for rec in ancestry:
            p=xy(rec['key'][0]); entry=[round(float(p[0]),3),round(float(p[1]),3),round(float(rec['arrival']),5)]
            if route_points and abs(entry[2]-route_points[-1][2])<1e-7:route_points[-1]=entry
            else:route_points.append(entry)
        route={'id':profile.id,'name':profile.name,'status':'ok','points':route_points,
               'speed_km_h':profile.speed,'compute_ms':round(elapsed,1),
               'expanded_states':expansions,'objective':round(records[final]['cost'],3)}
        route.update(assess_route(route,self.env,profile.speed))
        if not route['admissible']:
            # Never display an unvalidated path as admissible.
            route['status']='no_route';route['reason']='Continuous post-validation rejected the approximate path.'
        return route


def assess_route(route,env,speed=None):
    p=np.asarray(route['points'],float);speed=float(speed or route.get('speed_km_h',18.))
    total_distance=0.;fuel=0.;risk_integral=0.;ice_integral=0.;wave_integral=0.;contrib=np.zeros(5)
    min_clear=float('inf');maxice=0.;maxwave=0.;first_threat=None;land_hit=False
    profile=[]
    for a,b in zip(p[:-1],p[1:]):
        d=distance(a,b);dt=b[2]-a[2]
        if dt<=0:continue
        total_distance+=d
        n=max(3,int(np.ceil(np.linalg.norm(b[:2]-a[:2])/.5)))
        f=np.linspace(0,1,n);xs=a[0]+f*(b[0]-a[0]);ys=a[1]+f*(b[1]-a[1]);ts=a[2]+f*dt
        vals=env.sample(xs,ys,ts)
        min_clear=min(min_clear,float(vals['clearance'].min()));maxice=max(maxice,float(vals['ice'].max()));maxwave=max(maxwave,float(vals['wave'].max()))
        bad=np.where((vals['clearance']<0)|(vals['ice']>MAX_ICE)|(vals['wave']>MAX_WAVE))[0]
        if len(bad) and first_threat is None:first_threat=float(ts[bad[0]]-p[0,2])
        c=float(np.mean(vals['ice']));w=float(np.mean(vals['wave']))
        through=speed*max(.35,1-.55*c)*max(.5,1-.04*max(w-2,0))
        fuel+=dt*fuel_rate(through,c,w)
        risk_integral+=float(np.mean(vals['risk']))*dt;ice_integral+=c*d;wave_integral+=w*dt
        contrib+=np.mean(vals['contributions'],axis=1)*dt
        if LAND_BUFFER.intersects(LineString([a[:2],b[:2]])):land_hit=True
        profile.append({'hour':round(float((a[2]+b[2])/2),2),'ice':round(c*100,1),'risk':round(float(np.mean(vals['risk'])),1)})
    duration=float(p[-1,2]-p[0,2]);cpa=[closest_approach(route,b) for b in env.bergs]
    nearest=min(cpa,key=lambda v:v['cpa_km'])
    risk=risk_integral/max(duration,1e-9)
    return {'distance_km':round(total_distance,2),'eta_h':round(duration,3),
            'fuel_l':round(fuel,1),'co2_kg':round(fuel*2.68,1),
            'emission_factor_kg_l':2.68,'emissions_note':'Illustrative combustion-only factor, not lifecycle emissions.',
            'risk':round(risk,2),'ice_exposure_pct':round(100*ice_integral/max(total_distance,1e-9),2),
            'max_ice_pct':round(maxice*100,2),'wave_m':round(wave_integral/max(duration,1e-9),2),
            'min_clearance_km':round(min_clear,3),'closest_approach':nearest,'all_cpa':cpa,
            'first_threat_h':None if first_threat is None else round(first_threat,3),
            'admissible':bool(min_clear>=0 and maxice<=MAX_ICE and maxwave<=MAX_WAVE and not land_hit),
            'risk_contributions':dict(zip(['Sea ice','Iceberg proximity','Waves','Current magnitude','Forecast uncertainty'],np.round(contrib/max(duration,1e-9),2).tolist())),
            'profile':profile,'policy_note':'Index and clearances are demo policy settings, not a calibrated collision probability.'}


def point_on_route(route,hour):
    p=np.asarray(route['points'],float)
    return np.array([np.interp(hour,p[:,2],p[:,i]) for i in (0,1)])
