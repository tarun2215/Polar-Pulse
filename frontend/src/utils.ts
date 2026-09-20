export const esc=(s:any)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=(n:any,d=0)=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d}):'--';
export const duration=(h:number)=>h==null?'--':`${Math.floor(Math.round(h*60)/60)}h ${(Math.round(h*60)%60).toString().padStart(2,'0')}m`;
export const sign=(n:number,d=1)=>`${n>0?'+':''}${fmt(n,d)}`;
export const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
export function lerpArray(times:number[],values:any[],t:number):any {
  if(t<=times[0])return values[0];if(t>=times[times.length-1])return values[values.length-1];
  let i=1;while(times[i]<t)i++;
  const u=(t-times[i-1])/(times[i]-times[i-1]);
  return Array.isArray(values[i])?values[i].map((x:number,j:number)=>values[i-1][j]*(1-u)+x*u):values[i-1]*(1-u)+values[i]*u;
}
export const pointAt=(route:any,h:number)=>route?.points?.length?lerpArray(route.points.map((p:number[])=>p[2]),route.points.map((p:number[])=>p.slice(0,2)),h):[0,0];
export function download(name:string,text:string,mime='application/json') {
  const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function api(path:string,body?:any) {
  const r=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok){let msg=await r.text();try{const j=JSON.parse(msg);msg=Array.isArray(j.detail)?j.detail.map((x:any)=>`${x.loc.join('.')}: ${x.msg}`).join('; '):j.detail||msg;}catch{}throw new Error(`${r.status}: ${msg.slice(0,600)}`);}
  return r.json();
}
export function parseCSV(text:string):Record<string,string>[] {
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw new Error('Unclosed CSV quote.');if(field||row.length){row.push(field);rows.push(row);}
  if(rows.length<2)throw new Error('The CSV must contain a header and at least one observation.');
  const heads=rows.shift()!.map(x=>x.replace(/^\uFEFF/,'').trim());
  const needed=['latitude','longitude','concentration','observed_at'];
  if(needed.some(k=>!heads.includes(k)))throw new Error('Required columns: '+needed.join(', '));
  return rows.map(r=>Object.fromEntries(heads.map((h,i)=>[h,r[i]?.trim()??''])));
}
