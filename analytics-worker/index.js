// EX1.1 owner analytics. Free Cloudflare Worker + D1. Stores anonymous counts only:
// no IP addresses, no cookies, no question text, no personal data.
const TYPES = new Set(['view','heart','learn','lesson','ask','buy_ex','buy_v3','quiz_view','scroll_pricing']);
const STAGES = new Set(['view','heart','learn','lesson','ask','buy_ex','buy_v3']);
const SRC = ['direct','facebook','instagram','tiktok','youtube','x','reddit','google','other'];

function srcOf(ref){
  if(!ref) return 'direct';
  let h=''; try{ h=new URL(ref).hostname.toLowerCase() }catch(e){ return 'other' }
  if(h.endsWith('github.io')) return 'direct';
  if(/facebook|fb\.com|fb\.me/.test(h)) return 'facebook';
  if(/instagram/.test(h)) return 'instagram';
  if(/tiktok/.test(h)) return 'tiktok';
  if(/youtube|youtu\.be/.test(h)) return 'youtube';
  if(/(^|\.)x\.com$|twitter|t\.co$/.test(h)) return 'x';
  if(/reddit/.test(h)) return 'reddit';
  if(/google|bing|duckduckgo/.test(h)) return 'google';
  return 'other';
}
function cors(env,req){
  return {'access-control-allow-origin':env.ALLOW_ORIGIN,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'86400','vary':'origin'};
}
function json(env,req,o,s=200){return new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','cache-control':'no-store',...cors(env,req)}})}
const dayStr=d=>d.toISOString().slice(0,10);

export default {
  async fetch(req, env){
    const url=new URL(req.url);
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors(env,req)});

    if(req.method==='POST' && url.pathname==='/e'){
      // Only accept events sent from the real site.
      if(req.headers.get('origin')!==env.ALLOW_ORIGIN) return json(env,req,{ok:false},403);
      let raw=''; try{ raw=(await req.text()).slice(0,600) }catch(e){}
      let b={}; try{ b=JSON.parse(raw) }catch(e){ return json(env,req,{ok:false},400) }
      const t=String(b.t||''); if(!TYPES.has(t)) return json(env,req,{ok:false},400);
      const sid=String(b.s||'').replace(/[^a-z0-9]/gi,'').slice(0,24); if(sid.length<8) return json(env,req,{ok:false},400);
      const ua=req.headers.get('user-agent')||''; if(/bot|crawl|spider|headless|lighthouse|preview/i.test(ua)) return json(env,req,{ok:true,skipped:1});
      const dev=/Mobi|Android|iPhone|iPad/i.test(ua)?'mobile':'desktop';
      const src=SRC.includes(b.r)?b.r:srcOf(String(b.ref||'')); // client sends a pre-classified source or raw referrer
      const now=new Date(), day=dayStr(now), hr=now.getUTCHours();
      const st=[
        env.DB.prepare('INSERT INTO ev(day,hr,t,src,dev,n) VALUES(?,?,?,?,?,1) ON CONFLICT(day,hr,t,src,dev) DO UPDATE SET n=n+1').bind(day,hr,t,src,dev),
        env.DB.prepare('INSERT INTO log(ts,t,src,dev) VALUES(?,?,?,?)').bind(Date.now(),t,src,dev),
        env.DB.prepare('DELETE FROM log WHERE id < (SELECT MAX(id)-200 FROM log)')
      ];
      if(STAGES.has(t)) st.push(env.DB.prepare('INSERT OR IGNORE INTO stage(day,sid,t) VALUES(?,?,?)').bind(day,sid,t));
      if(t==='view') st.push(env.DB.prepare('INSERT OR IGNORE INTO vis(day,sid) VALUES(?,?)').bind(day,sid));
      await env.DB.batch(st);
      return json(env,req,{ok:true});
    }

    if(req.method==='GET' && url.pathname==='/stats'){
      const days=Math.min(Math.max(parseInt(url.searchParams.get('days'))||7,1),90);
      const end=new Date(), start=new Date(end.getTime()-(days-1)*864e5), prevStart=new Date(start.getTime()-days*864e5);
      const s=dayStr(start), ps=dayStr(prevStart);
      const q=(sql,...a)=>env.DB.prepare(sql).bind(...a).all().then(r=>r.results);
      const [byDay,byT,bySrc,byDev,byHr,uniq,prevT,prevU,stg,recent,uTot]=await Promise.all([
        q('SELECT day,t,SUM(n) n FROM ev WHERE day>=? GROUP BY day,t',s),
        q('SELECT t,SUM(n) n FROM ev WHERE day>=? GROUP BY t',s),
        q("SELECT src,SUM(n) n FROM ev WHERE day>=? AND t='view' GROUP BY src ORDER BY n DESC",s),
        q("SELECT dev,SUM(n) n FROM ev WHERE day>=? AND t='view' GROUP BY dev",s),
        q("SELECT hr,SUM(n) n FROM ev WHERE day>=? AND t='view' GROUP BY hr",s),
        q('SELECT day,COUNT(*) n FROM vis WHERE day>=? GROUP BY day',s),
        q('SELECT t,SUM(n) n FROM ev WHERE day>=? AND day<? GROUP BY t',ps,s),
        q('SELECT COUNT(DISTINCT sid) n FROM vis WHERE day>=? AND day<?',ps,s),
        q('SELECT t,COUNT(DISTINCT sid) n FROM stage WHERE day>=? GROUP BY t',s),
        q('SELECT ts,t,src,dev FROM log ORDER BY id DESC LIMIT 25'),
        q('SELECT COUNT(DISTINCT sid) n FROM vis WHERE day>=?',s)
      ]);
      return json(env,req,{days,from:s,series:byDay,totals:byT,sources:bySrc,devices:byDev,hourly:byHr,uniques:uniq,visitors:uTot[0]?uTot[0].n:0,previous:{totals:prevT,visitors:prevU[0]?prevU[0].n:0},funnel:stg,recent});
    }
    return new Response('ok',{status:200,headers:cors(env,req)});
  }
}
