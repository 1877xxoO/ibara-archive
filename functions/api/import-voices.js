const SOURCE='https://gamerch.com/ensemble-star-music/156260';

const decode=s=>String(s||'')
  .replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));

const clean=s=>decode(String(s||'')
  .replace(/<br\s*\/?>/gi,'\n')
  .replace(/<\/p>|<\/div>|<\/li>/gi,'\n')
  .replace(/<[^>]+>/g,''))
  .replace(/\u00a0/g,' ')
  .replace(/[ \t　]+/g,' ')
  .replace(/ *\n */g,'\n')
  .replace(/\n{2,}/g,'\n')
  .trim();

const oneLine=s=>clean(s).replace(/\n+/g,' ').replace(/\s+/g,' ').trim();

const dateOf=s=>{
  const m=String(s||'').match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
  return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:null;
};

const stripDates=s=>oneLine(s)
  .replace(/20\d{2}年\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2}\s*[～〜~\-]?\s*(?:\d{1,2}月\d{1,2}日\s*)?\d{0,2}:?\d{0,2}/g,' ')
  .replace(/20\d{2}年\d{1,2}月\d{1,2}日/g,' ')
  .replace(/\s+/g,' ').trim();

function classify(name){
  const n=oneLine(name),tags=[];
  const add=t=>{if(!tags.includes(t))tags.push(t)};
  let category='その他';
  if(/ハロウィン/.test(n)){category='ハロウィン';add('ハロウィン')}
  else if(/ホワイトデー/.test(n)){category='ホワイトデー';add('ホワイトデー')}
  else if(/バレンタイン/.test(n)){category='バレンタイン';add('バレンタイン')}
  else if(/クリスマス/.test(n)){category='クリスマス';add('クリスマス')}
  else if(/お正月|正月/.test(n)){category='お正月';add('お正月')}
  else if(/^(春|夏|秋|冬)-/.test(n)){category='季節';add(n.match(/^(春|夏|秋|冬)-/)[1])}
  else if(/^(朝|昼|夕|夜)-/.test(n)){category='時間';add(n.match(/^(朝|昼|夕|夜)-/)[1])}
  else if(/周年|誕生日/.test(n)){category='記念日';if(/周年/.test(n))add('周年');if(/誕生日/.test(n))add('誕生日')}
  else if(/仕事/.test(n)){category='仕事'}
  else if(/キャンペーン|ログイン/.test(n)){category='キャンペーン';add('キャンペーン')}
  return {category,tags};
}

function cellsOf(row){
  return [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>clean(m[1])).filter(Boolean);
}

function validName(s){
  const n=oneLine(s);
  if(!n||n.length>100)return false;
  if(/^(ボイス名|入手方法|セリフ|開催期間|イベント|スカウト|カード一覧|楽曲一覧|属性別|レアリティ別)$/.test(n))return false;
  if(/最新カード|所持率|キャラクター一覧|リンク集/.test(n))return false;
  return /[ぁ-んァ-ヶ一-龠A-Za-z0-9]/.test(n);
}

export async function onRequestGet(){
  const r=await fetch(SOURCE,{headers:{'User-Agent':'Mozilla/5.0 (compatible; IbaraArchive/1.1)'}});
  if(!r.ok)return new Response('source fetch failed: '+r.status,{status:502});
  const html=await r.text();

  // Gamerch tables use one row for "voice name | acquisition information"
  // and the following one-cell row for the actual spoken line.
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>cellsOf(m[1]));
  const items=[];
  let pending=null;

  for(const cells of rows){
    if(cells.length>=2){
      const name=oneLine(cells[0]);
      const acquisition=cells.slice(1).join(' / ');
      if(!validName(name)){pending=null;continue}
      pending={
        voice_name:name,
        release_date:dateOf(acquisition),
        unlock_condition:stripDates(acquisition)||null
      };
      continue;
    }

    if(cells.length===1 && pending){
      const text=clean(cells[0]);
      if(text && !/※?情報募集中/.test(text) && text!==pending.voice_name){
        const kind=classify(pending.voice_name);
        items.push({...pending,voice_text:text,...kind});
      }
      pending=null;
    }
  }

  // Fallback for occasional rows where Gamerch puts the line in a third cell.
  for(const row of [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]){
    const cells=cellsOf(row[1]);
    if(cells.length<3)continue;
    const name=oneLine(cells[0]), text=clean(cells[cells.length-1]);
    if(!validName(name)||!text||/※?情報募集中/.test(text))continue;
    const acquisition=cells.slice(1,-1).join(' / ');
    const kind=classify(name);
    items.push({
      voice_name:name, voice_text:text,
      release_date:dateOf(acquisition),
      unlock_condition:stripDates(acquisition)||null,
      ...kind
    });
  }

  const map=new Map();
  for(const x of items){
    const key=`${x.voice_name}__${x.release_date||''}`;
    const p=map.get(key);
    if(!p || x.voice_text.length>p.voice_text.length)map.set(key,x);
  }

  return Response.json(
    {source:SOURCE,items:[...map.values()]},
    {headers:{'Cache-Control':'no-store'}}
  );
}
