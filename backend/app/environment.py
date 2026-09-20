"""Seeded, explicitly simulated polar environment; no live-data claims."""
import numpy as np
from .geography import XX,YY,XS,YS,LAND_MASK,LON,LAT,STEP
from .forecast import FORECASTER,HORIZONS
from .icebergs import make_icebergs


def gauss(x,y,cx,cy,sx,sy):return np.exp(-.5*((x-cx)/sx)**2-.5*((y-cy)/sy)**2)

class Environment:
    def __init__(self,wind=1.,current=1.,ice=1.,drift=1.,threat=None):
        self.params={'wind':wind,'current':current,'ice':ice,'drift':drift}
        x,y=XX,YY
        self.c0=np.clip((.055+.17/(1+np.exp((y-2450)/32))+
                   .42*gauss(x,y,-185,2470,72,62)+.44*gauss(x,y,120,2540,90,74)+
                   .045*(1+np.sin(x/35)*np.cos((y-2200)/48)))*ice,0,1)
        self.trend=.0018+.0015*gauss(x,y,-140,2470,100,90)+.0003*np.cos(x/100)
        self.air=-8-5*gauss(x,y,-110,2450,180,140)+.8*np.sin(y/120)
        self.sst=-1.65-.35*gauss(x,y,-150,2420,100,100)+.1*np.cos(x/140)
        self.we=(6+3*np.cos(y/85))*wind; self.wn=(-4+3*np.sin(x/100))*wind
        self.ce=(.14+.07*np.sin(y/120))*current; self.cn=(-.07+.06*np.cos(x/110))*current
        self.wave=1.2+.12*np.hypot(self.we,self.wn)
        fs=[]
        for h in HORIZONS:
            if h==0:fs.append(self.c0);continue
            X=np.column_stack([self.c0.ravel(),self.trend.ravel(),self.air.ravel(),self.sst.ravel(),
                               self.wn.ravel(),self.cn.ravel(),np.full(x.size,h)])
            fs.append(FORECASTER.predict(X).reshape(x.shape))
        self.forecasts=np.array(fs)
        self.bergs=make_icebergs(wind,current,drift,threat)
        self._bpos=np.array([b['positions'] for b in self.bergs])
        self._bsig=np.array([b['uncertainty_km'] for b in self.bergs])
        self._brad=np.array([b['radius_km'] for b in self.bergs])

    def grid_at(self,h):
        if h<=0:return self.forecasts[0]
        k=min(len(HORIZONS)-2,max(0,int(np.searchsorted(HORIZONS,h)-1)))
        f=float(np.clip((h-HORIZONS[k])/(HORIZONS[k+1]-HORIZONS[k]),0,1))
        return self.forecasts[k]*(1-f)+self.forecasts[k+1]*f

    def sample(self,x,y,t):
        """Bilinear spatial and linear temporal interpolation, including vectors."""
        x,y,t=np.broadcast_arrays(np.asarray(x,float),np.asarray(y,float),np.asarray(t,float))
        gx=np.clip((x-XS[0])/STEP,0,len(XS)-1.000001); gy=np.clip((y-YS[0])/STEP,0,len(YS)-1.000001)
        i,j=gx.astype(int),gy.astype(int); fx,fy=gx-i,gy-j
        def sp(a):return a[j,i]*(1-fx)*(1-fy)+a[j,i+1]*fx*(1-fy)+a[j+1,i]*(1-fx)*fy+a[j+1,i+1]*fx*fy
        k=np.clip(np.searchsorted(HORIZONS,t,side='right')-1,0,len(HORIZONS)-2)
        f=np.clip((t-HORIZONS[k])/(HORIZONS[k+1]-HORIZONS[k]),0,1)
        def sf():
            def at(kk):return (self.forecasts[kk,j,i]*(1-fx)*(1-fy)+self.forecasts[kk,j,i+1]*fx*(1-fy)+
                               self.forecasts[kk,j+1,i]*(1-fx)*fy+self.forecasts[kk,j+1,i+1]*fx*fy)
            return at(k)*(1-f)+at(k+1)*f
        c=sf(); bk=np.clip((t*2).astype(int),0,143); bf=np.clip(t*2-bk,0,1)
        # Leading axis indexes icebergs; supports scalar or vector sample arrays.
        p=self._bpos[:,bk,:]*(1-bf)[...,None]+self._bpos[:,bk+1,:]*bf[...,None]
        sig=self._bsig[:,bk]*(1-bf)+self._bsig[:,bk+1]*bf
        dist=np.sqrt((p[...,0]-x)**2+(p[...,1]-y)**2)
        rad=self._brad.reshape((-1,)+(1,)*x.ndim)
        clearance=dist-(8+rad+sig)
        proximity=np.max(np.exp(-.5*(dist/np.maximum(8+rad+sig,1))**2),axis=0)
        waves=sp(self.wave); ce,cn=sp(self.ce),sp(self.cn)
        unc=np.interp(t,HORIZONS,[FORECASTER.interval(h) for h in HORIZONS])/.15
        ice_r=np.clip(c/.85,0,1); weather=np.clip((waves-1)/4,0,1)
        ocean=np.clip(np.hypot(ce,cn)/.5,0,1); unc=np.clip(unc,0,1)
        risk=100*(.38*ice_r+.32*proximity+.14*weather+.08*ocean+.08*unc)
        return {'ice':c,'risk':risk,'berg':proximity,'clearance':np.min(clearance,axis=0),
                'nearest':np.min(dist,axis=0),'wave':waves,'ce':ce,'cn':cn,
                'contributions':np.array([.38*ice_r,.32*proximity,.14*weather,.08*ocean,.08*unc])*100}

    def map_payload(self):
        ocean=~LAND_MASK
        currents=[]
        for j in range(2,len(YS),5):
            for i in range(2,len(XS),5):
                if ocean[j,i]:currents.append([float(XX[j,i]),float(YY[j,i]),round(float(self.ce[j,i]),3),round(float(self.cn[j,i]),3)])
        return {'x':XS.tolist(),'y':YS.tolist(),'land_mask':LAND_MASK.astype(int).ravel().tolist(),
                'forecast':[np.round(a*100,2).ravel().tolist() for a in self.forecasts],
                'horizons':HORIZONS.tolist(),'currents':currents,
                'average':[round(float(a[ocean].mean())*100,2) for a in self.forecasts],
                'interval_pp':[round(FORECASTER.interval(h)*100,2) for h in HORIZONS],
                'wind_m_s':round(float(np.mean(np.hypot(self.we[ocean],self.wn[ocean]))),1),
                'wave_m':round(float(np.mean(self.wave[ocean])),1),
                'risk':[np.round(self.sample(XX,YY,np.full(XX.shape,h))['risk'],1).ravel().tolist() for h in HORIZONS]}
