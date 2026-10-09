const SOURCE='https://gamerch.com/ensemble-star-music/156260';
const clean=s=>String(s||'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
const dateOf=s=>{const m=String(s).match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:null};
export async function onRequestGet(){
  const r=await fetch(SOURCE,{headers:{'User-Agent':'Mozilla/5.0 IbaraArchive/1.0'}});if(!r.ok)return new Response('source fetch failed',{status:502});
  const html=await r.text(), items=[];
  // Gamerch voice tables are rendered as table rows. Keep only rows whose first cell is a voice name.
  const rows=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
  for(const row of rows){const cells=[...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>clean(m[1])).filter(Boolean);if(cells.length<2)continue;const name=cells[0];if(/ボイス名|入手方法|セリフ|開催期間/.test(name))continue;let text=cells[cells.length-1];if(!text||text===name||/情報募集中/.test(text))continue;const mid=cells.slice(1,-1).join(' / '),all=cells.join(' ');if(!/[ぁ-んァ-ヶ一-龠]/.test(text))continue;items.push({voice_name:name,voice_text:text,release_date:dateOf(all),unlock_condition:mid||null});}
  // De-duplicate exact names, preferring the richer row.
  const map=new Map();for(const x of items){const p=map.get(x.voice_name);if(!p||x.voice_text.length>p.voice_text.length)map.set(x.voice_name,x)}
  return Response.json({source:SOURCE,items:[...map.values()]},{headers:{'Cache-Control':'no-store'}});
}
