import { useState, useCallback, useRef, useEffect } from "react";

const SK = "kdp_v3";
const MONTHS = {ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12,jan:1,apr:4,aug:8,dec:12};

function parseDate(s) {
  if (!s) return "";
  const m = s.trim().match(/^(\d{1,2})\s+([a-záéíóú]+)\s+(\d{4})$/i);
  if (!m) return s;
  const mo = MONTHS[m[2].toLowerCase().substring(0,3)] || 1;
  return `${m[3]}-${String(mo).padStart(2,"0")}-${m[1].padStart(2,"0")}`;
}
function cleanN(v) {
  if (v===undefined||v===null||v===""||v==="-") return 0;
  return parseFloat(String(v).replace(/%/g,"").replace(",",".")) || 0;
}
function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(l=>l.trim());
  if (!lines.length) return [];
  const parseRow = line => {
    const cells=[]; let cur="",inQ=false;
    for (const c of line) {
      if (c==='"') inQ=!inQ;
      else if (c===","&&!inQ){cells.push(cur.trim());cur="";}
      else cur+=c;
    }
    cells.push(cur.trim());
    return cells.map(c=>c.replace(/^=?["']|["']$/g,"").trim());
  };
  const headers = parseRow(lines[0]).map(h=>h.replace(/[""]/g,"").trim());
  return lines.slice(1).map(line=>{
    const obj={}; const row=parseRow(line);
    headers.forEach((h,i)=>{obj[h]=(row[i]||"").replace(/[""]/g,"").trim();});
    return obj;
  }).filter(r=>Object.values(r).some(v=>v));
}
function ingestRows(rows, db) {
  let added=0, dupes=0;
  rows.forEach(r=>{
    const rec={
      fecha: parseDate(r["Fecha"]||r["Date"]||""),
      cartera: r["Nombre de la cartera"]||r["Portfolio name"]||"",
      campana: r["Nombre de la campaña"]||r["Campaign name"]||"",
      termino: r["Término de búsqueda"]||r["Search term"]||"",
      keyword: r["Valor objetivo"]||r["Targeting value"]||"",
      match: r["Tipo de coincidencia objetivo"]||r["Match type"]||"",
      placement: r["Nombre del emplazamiento"]||r["Placement name"]||"",
      impresiones: cleanN(r["Impresiones"]||r["Impressions"]),
      clics: cleanN(r["Clics"]||r["Clicks"]),
      ctr: cleanN(r["CTR"]),
      cpc: cleanN(r["CPC"]),
      compras: cleanN(r["Compras"]||r["Purchases"]||r["Orders"]),
      ventas: cleanN(r["Ventas"]||r["Sales"]),
      gasto: cleanN(r["Coste total"]||r["Cost"]||r["Spend"]),
      roas: cleanN(r["ROAS"]),
      kenp: cleanN(r["KENP leídas"]||r["KENP read"]),
    };
    const key=`${rec.fecha}|${rec.cartera}|${rec.campana}|${rec.termino}|${rec.keyword}|${rec.placement}`;
    if (!db.rows.some(x=>`${x.fecha}|${x.cartera}|${x.campana}|${x.termino}|${x.keyword}|${x.placement}`===key)){
      db.rows.push(rec); added++;
    } else dupes++;
  });
  return {added,dupes};
}

const sum=(arr,k)=>arr.reduce((s,r)=>s+(r[k]||0),0);
const calcACoS=(g,v)=>v>0?g/v:null;
const fmtPct=v=>v!==null&&v!==undefined?(v*100).toFixed(1)+"%":"–";
const fmtMoney=v=>"$"+(v||0).toFixed(2);
const groupBy=(arr,k)=>arr.reduce((a,r)=>{const key=r[k];if(!a[key])a[key]=[];a[key].push(r);return a;},{});
const filterRows=(arr,f)=>arr.filter(r=>{
  if(f.cartera&&r.cartera!==f.cartera)return false;
  if(f.from&&r.fecha&&r.fecha<f.from)return false;
  if(f.to&&r.fecha&&r.fecha>f.to)return false;
  return true;
});

const C={bg:"#0f0f12",bg2:"#16161a",bg3:"#1e1e24",bg4:"#26262e",border:"rgba(255,255,255,0.07)",border2:"rgba(255,255,255,0.12)",text:"#f0eff4",text2:"#9b9aaa",text3:"#5e5d6e",accent:"#7c6af7",green:"#34d399",red:"#f87171",amber:"#fbbf24",blue:"#60a5fa"};

const acosStyle=(g,v)=>{const ac=calcACoS(g,v);if(ac===null)return{bg:"rgba(255,255,255,0.06)",color:C.text2,label:"sin conv."};if(ac<0.25)return{bg:"rgba(52,211,153,0.15)",color:C.green,label:fmtPct(ac)};if(ac<0.45)return{bg:"rgba(251,191,36,0.15)",color:C.amber,label:fmtPct(ac)};return{bg:"rgba(248,113,113,0.15)",color:C.red,label:fmtPct(ac)};};
const ACoSBadge=({g,v})=>{const s=acosStyle(g,v);return<span style={{background:s.bg,color:s.color,fontSize:11,padding:"2px 8px",borderRadius:20,fontWeight:600}}>{s.label}</span>;};
const Badge=({children,color,bg})=><span style={{background:bg||"rgba(255,255,255,0.06)",color:color||C.text2,fontSize:10,padding:"2px 8px",borderRadius:20,fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>;
const KPI=({label,value,sub,color})=>(<div style={{background:C.bg3,borderRadius:10,padding:16,border:`1px solid ${C.border}`}}><div style={{fontSize:10,color:C.text3,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>{label}</div><div style={{fontSize:22,fontWeight:600,color:color||C.text,lineHeight:1,marginBottom:4}}>{value}</div>{sub&&<div style={{fontSize:11,color:C.text3}}>{sub}</div>}</div>);
const Card=({children,style})=><div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:20,marginBottom:14,...style}}>{children}</div>;
const TH=({children})=><th style={{textAlign:"left",padding:"8px 10px",color:C.text3,fontWeight:400,borderBottom:`1px solid ${C.border}`,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap"}}>{children}</th>;
const TD=({children,main,style})=><td style={{padding:"9px 10px",borderBottom:`1px solid ${C.border}`,color:main?C.text:C.text2,fontWeight:main?500:400,...style}}>{children}</td>;

const LineChart=({data,color="#7c6af7",height=100})=>{
  if(!data||data.length<2)return null;
  const vals=data.map(d=>d.y).filter(v=>v!==null&&v!==undefined&&!isNaN(v));
  if(!vals.length)return null;
  const min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
  const w=600,h=height;
  const pts=data.map((d,i)=>{const x=(i/(data.length-1))*w;const y=h-(((d.y||0)-min)/range)*(h-10)-5;return`${x},${y}`;}).join(" ");
  return(<svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height}} preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round"/><polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity="0.1" stroke="none"/></svg>);
};

const BarChart=({data,height=140})=>{
  if(!data||!data.length)return null;
  const max=Math.max(...data.map(d=>Math.max(d.gasto||0,d.ventas||0)),1);
  const bw=Math.floor(560/data.length)-2;
  return(<svg viewBox={`0 0 600 ${height}`} style={{width:"100%",height}} preserveAspectRatio="none">{data.map((d,i)=>{const x=i*(560/data.length)+20;const gh=((d.gasto||0)/max)*(height-20);const vh=((d.ventas||0)/max)*(height-20);return(<g key={i}><rect x={x} y={height-gh-10} width={bw*0.45} height={gh} fill="rgba(248,113,113,0.7)" rx="2"/><rect x={x+bw*0.5} y={height-vh-10} width={bw*0.45} height={vh} fill="rgba(52,211,153,0.7)" rx="2"/></g>);})}</svg>);
};

export default function App() {
  const [db,setDb]=useState(()=>{try{const r=localStorage.getItem(SK);return r?JSON.parse(r):{rows:[],meta:{lastUpdate:null}};}catch{return{rows:[],meta:{lastUpdate:null}};}});
  const [page,setPage]=useState("upload");
  const [filters,setFilters]=useState({cartera:"",from:"",to:""});
  const [uploadLog,setUploadLog]=useState([]);
  const [stTab,setStTab]=useState("all");
  const [aiQuestion,setAiQuestion]=useState("");
  const [aiOutput,setAiOutput]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [strategies,setStrategies]=useState([]);
  const [stratLoading,setStratLoading]=useState(false);
  const [dragging,setDragging]=useState(false);
  const [apiKey,setApiKey]=useState(()=>localStorage.getItem("kdp_apikey")||"");
  const [showApiKey,setShowApiKey]=useState(false);
  const fileRef=useRef();

  const persist=useCallback((newDb)=>{try{localStorage.setItem(SK,JSON.stringify(newDb));}catch{}setDb({...newDb});},[]);
  const allDates=[...new Set(db.rows.map(r=>r.fecha).filter(Boolean))].sort();
  const carteras=[...new Set(db.rows.map(r=>r.cartera).filter(Boolean))].sort();
  useEffect(()=>{if(allDates.length&&!filters.from)setFilters(f=>({...f,from:allDates[0],to:allDates[allDates.length-1]}));},[db]);
  const fd=filterRows(db.rows,filters);
  const hasData=db.rows.length>0;
  const saveApiKey=(key)=>{setApiKey(key);localStorage.setItem("kdp_apikey",key);};
  const selectStyle={fontSize:12,padding:"6px 10px",background:C.bg3,border:`1px solid ${C.border2}`,color:C.text,borderRadius:8,fontFamily:"inherit"};

  const handleFiles=useCallback((files)=>{
    const arr=Array.from(files);let pending=arr.length;const results=[];
    const newDb={...db,rows:[...db.rows],meta:{...db.meta}};
    arr.forEach(file=>{
      const reader=new FileReader();
      reader.onload=e=>{
        const rows=parseCSV(e.target.result);
        const r=ingestRows(rows,newDb);
        results.push({name:file.name,added:r.added,dupes:r.dupes});
        if(--pending===0){
          newDb.meta.lastUpdate=new Date().toLocaleDateString("es-ES");
          persist(newDb);setUploadLog(results);
          const dates=[...new Set(newDb.rows.map(r=>r.fecha).filter(Boolean))].sort();
          if(dates.length)setFilters(f=>({...f,from:dates[0],to:dates[dates.length-1]}));
        }
      };
      reader.readAsText(file,"UTF-8");
    });
  },[db,persist]);

  const callAI=async(prompt)=>{
    if(!apiKey){alert("Introduce tu API key en Configuración.");return"";}
    const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
    const data=await res.json();
    if(data.error)throw new Error(data.error.message);
    return data.content?.map(b=>b.text||"").join("")||"";
  };

  const buildPrompt=()=>{
    const g=sum(fd,"gasto"),v=sum(fd,"ventas"),c=sum(fd,"compras"),imp=sum(fd,"impresiones"),cl=sum(fd,"clics"),kenp=sum(fd,"kenp");
    const dates=[...new Set(fd.map(r=>r.fecha).filter(Boolean))].sort();
    const aggKw={};fd.forEach(r=>{if(!r.keyword)return;if(!aggKw[r.keyword])aggKw[r.keyword]={kw:r.keyword,g:0,v:0,c:0};aggKw[r.keyword].g+=r.gasto;aggKw[r.keyword].v+=r.ventas;aggKw[r.keyword].c+=r.compras;});
    const topKw=Object.values(aggKw).sort((a,b)=>b.g-a.g).slice(0,10);
    const aggST={};fd.forEach(r=>{if(!r.termino)return;if(!aggST[r.termino])aggST[r.termino]={t:r.termino,g:0,v:0};aggST[r.termino].g+=r.gasto;aggST[r.termino].v+=r.ventas;});
    const wasted=Object.values(aggST).filter(s=>s.v===0&&s.g>1).sort((a,b)=>b.g-a.g).slice(0,8);
    return `Eres un experto en Amazon KDP Ads. Analiza en profundidad y responde en español.\n\nCARTERAS: ${[...new Set(fd.map(r=>r.cartera))].join(", ")}\nPERIODO: ${dates[0]||"–"} → ${dates[dates.length-1]||"–"} (${dates.length} días)\n\nMÉTRICAS:\n- Impresiones: ${imp.toLocaleString()} | Clics: ${cl.toLocaleString()} | CTR: ${imp>0?((cl/imp)*100).toFixed(2):0}%\n- Gasto: ${fmtMoney(g)} | Ventas: ${fmtMoney(v)} | Compras: ${c}\n- ACoS: ${fmtPct(calcACoS(g,v))} | ROAS: ${g>0?(v/g).toFixed(2)+"x":"N/A"} | KENP: ${kenp.toLocaleString()}\n\nKEYWORDS top:\n${topKw.map(k=>`- "${k.kw}": ${fmtMoney(k.g)} gasto, ${fmtMoney(k.v)} ventas, ACoS ${k.v>0?fmtPct(k.g/k.v):"sin conv."}`).join("\n")}\n\nTÉRMINOS SIN CONVERSIÓN:\n${wasted.length?wasted.map(s=>`- "${s.t}": ${fmtMoney(s.g)} gastado, 0 ventas`).join("\n"):"Ninguno"}${aiQuestion?`\n\nPREGUNTA: ${aiQuestion}`:""}\n\nResponde con: 1.DIAGNÓSTICO EJECUTIVO 2.PUNTOS FUERTES 3.PROBLEMAS CRÍTICOS 4.OPORTUNIDADES 5.ALERTAS URGENTES`;
  };

  const runAnalysis=async()=>{setAiLoading(true);setAiOutput("");try{const result=await callAI(buildPrompt());setAiOutput(result);if(result)runStrategies(result);}catch(e){setAiOutput("Error: "+e.message);}setAiLoading(false);};
  const runStrategies=async(analysis)=>{
    setStratLoading(true);setStrategies([]);
    const g=sum(fd,"gasto"),v=sum(fd,"ventas");
    const prompt=`Basándote en:\n\n${analysis}\n\nACoS: ${fmtPct(calcACoS(g,v))}, gasto: ${fmtMoney(g)}, ventas: ${fmtMoney(v)}.\n\nGenera EXACTAMENTE 6 estrategias. Solo JSON array sin markdown:\n[{"prioridad":"alta|media|baja","categoria":"Pujas|Keywords|Presupuesto|Negativos|Emplazamientos|Estructura","titulo":"máx 8 palabras","accion":"qué hacer. 2-3 frases con números.","impacto":"resultado esperado","plazo":"hoy|esta semana|próximos 14 días|próximo mes"}]`;
    try{const text=await callAI(prompt);if(text)setStrategies(JSON.parse(text.replace(/```json|```/g,"").trim()));}catch{}
    setStratLoading(false);
  };

  const titles={upload:"Importar datos",dashboard:"Dashboard",carteras:"Carteras",keywords:"Keywords",searchterms:"Términos de búsqueda",placements:"Emplazamientos",ai:"Análisis IA",strategies:"Estrategias",config:"Configuración"};
  const plNames={PLACEMENT_TOP:"Top de búsqueda",PLACEMENT_REST_OF_SEARCH:"Resto de búsqueda",PLACEMENT_PRODUCT_PAGE:"Página de producto"};
  const navItem=(id,label,icon)=>(<div onClick={()=>setPage(id)} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 16px",cursor:"pointer",fontSize:12,color:page===id?C.accent:C.text2,borderLeft:`2px solid ${page===id?C.accent:"transparent"}`,background:page===id?"rgba(124,106,247,0.08)":"transparent"}}><span style={{fontSize:13,width:14,textAlign:"center"}}>{icon}</span>{label}</div>);

  const PageUpload=()=>{
    const total=db.rows.length;
    return(<div>
      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);handleFiles(e.dataTransfer.files);}} onClick={()=>fileRef.current.click()} style={{border:`2px dashed ${dragging?C.accent:C.border2}`,borderRadius:12,padding:"40px 24px",textAlign:"center",cursor:"pointer",background:dragging?"rgba(124,106,247,0.05)":C.bg2}}>
        <div style={{fontSize:32,marginBottom:12}}>📂</div>
        <div style={{fontSize:15,fontWeight:500,color:C.text,marginBottom:8}}>Arrastra tu CSV de Amazon Ads aquí</div>
        <div style={{fontSize:12,color:C.text2,lineHeight:1.7}}>Formato con columna Fecha — un fichero incluye todo<br/>Puedes soltar varios a la vez para acumular histórico</div>
      </div>
      <input ref={fileRef} type="file" multiple accept=".csv" style={{display:"none"}} onChange={e=>handleFiles(e.target.files)}/>
      {uploadLog.length>0&&(<Card style={{marginTop:14}}><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em",color:C.text3,marginBottom:10}}>Última importación</div>{uploadLog.map((r,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<uploadLog.length-1?`1px solid ${C.border}`:"none",fontSize:11}}><span style={{color:C.green}}>✓</span><span style={{flex:1,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</span><Badge color={C.green} bg="rgba(52,211,153,0.15)">+{r.added} nuevos</Badge><span style={{color:C.text3}}>{r.dupes} duplicados</span></div>))}</Card>)}
      {total>0&&(<Card style={{marginTop:uploadLog.length?0:14}}><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em",color:C.text3,marginBottom:12}}>Base de datos acumulada</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(130px, 1fr))",gap:10}}><KPI label="Registros" value={total.toLocaleString()}/><KPI label="Carteras" value={carteras.length} sub={carteras.join(", ")}/><KPI label="Desde" value={allDates[0]||"–"}/><KPI label="Hasta" value={allDates[allDates.length-1]||"–"}/><KPI label="Días con datos" value={allDates.length}/></div><button onClick={()=>{if(window.confirm("¿Borrar toda la base de datos?"))persist({rows:[],meta:{lastUpdate:null}});}} style={{marginTop:12,fontSize:11,padding:"5px 10px",border:`1px solid rgba(248,113,113,0.4)`,background:"transparent",color:C.red,borderRadius:6,cursor:"pointer"}}>Borrar base de datos</button></Card>)}
    </div>);
  };

  const PageDashboard=()=>{
    if(!fd.length)return<div style={{textAlign:"center",padding:60,color:C.text3}}>Sin datos — importa tu CSV primero</div>;
    const g=sum(fd,"gasto"),v=sum(fd,"ventas"),c=sum(fd,"compras"),imp=sum(fd,"impresiones"),cl=sum(fd,"clics"),kenp=sum(fd,"kenp");
    const ac=calcACoS(g,v);const byCartera=groupBy(fd,"cartera");const byDate=groupBy(fd,"fecha");
    const dates=Object.keys(byDate).sort();const last30=dates.slice(-30);
    const trendData=last30.map(d=>{const rows=byDate[d];return{d,gasto:sum(rows,"gasto"),ventas:sum(rows,"ventas")};});
    const acosPts=last30.map(d=>{const rows=byDate[d];const ag=sum(rows,"gasto"),av=sum(rows,"ventas");return{y:av>0?ag/av*100:null};});
    return(<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))",gap:12,marginBottom:20}}>
        <KPI label="Impresiones" value={imp.toLocaleString()} sub={imp>0?`CTR: ${((cl/imp)*100).toFixed(2)}%`:"–"}/>
        <KPI label="Gasto total" value={fmtMoney(g)} sub={cl>0?`CPC: ${fmtMoney(g/cl)}`:"–"}/>
        <KPI label="Ventas ads" value={fmtMoney(v)} sub={`${c} compras`}/>
        <KPI label="ACoS" value={fmtPct(ac)} sub={g>0?`ROAS: ${(v/g).toFixed(2)}x`:"–"} color={ac!==null?(ac<0.3?C.green:ac<0.5?C.amber:C.red):C.text}/>
        <KPI label="KENP" value={kenp.toLocaleString()} sub="Kindle Unlimited"/>
        <KPI label="Días con datos" value={dates.length}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <Card style={{marginBottom:0}}><div style={{fontSize:11,color:C.text3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Gasto diario</div><div style={{fontSize:18,fontWeight:600,color:C.red,marginBottom:8}}>{fmtMoney(g)}</div><LineChart data={trendData.map(d=>({y:d.gasto}))} color={C.red} height={80}/></Card>
        <Card style={{marginBottom:0}}><div style={{fontSize:11,color:C.text3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Ventas diarias</div><div style={{fontSize:18,fontWeight:600,color:C.green,marginBottom:8}}>{fmtMoney(v)}</div><LineChart data={trendData.map(d=>({y:d.ventas}))} color={C.green} height={80}/></Card>
      </div>
      <Card style={{marginBottom:14}}>
        <div style={{fontSize:11,color:C.text3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Evolución ACoS %</div>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:8}}><span style={{fontSize:18,fontWeight:600,color:ac!==null?(ac<0.3?C.green:ac<0.5?C.amber:C.red):C.text}}>{fmtPct(ac)}</span><div style={{display:"flex",gap:10,fontSize:10}}><span style={{color:C.green}}>■ &lt;25% óptimo</span><span style={{color:C.amber}}>■ 25-45% aceptable</span><span style={{color:C.red}}>■ &gt;45% alto</span></div></div>
        <LineChart data={acosPts} color={C.amber} height={80}/>
      </Card>
      <Card style={{marginBottom:14}}>
        <div style={{fontSize:11,color:C.text3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Gasto vs Ventas por día (últimos 30)</div>
        <div style={{display:"flex",gap:12,fontSize:10,marginBottom:6}}><span style={{color:"rgba(248,113,113,0.9)"}}>■ Gasto</span><span style={{color:"rgba(52,211,153,0.9)"}}>■ Ventas</span></div>
        <BarChart data={trendData} height={120}/>
      </Card>
      <Card><div style={{fontSize:11,color:C.text3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:14}}>Por cartera</div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Cartera","Gasto","Ventas","Compras","ACoS","ROAS","KENP"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{Object.entries(byCartera).sort((a,b)=>sum(b[1],"ventas")-sum(a[1],"ventas")).map(([car,rows])=>{const rg=sum(rows,"gasto"),rv=sum(rows,"ventas"),rc=sum(rows,"compras"),rk=sum(rows,"kenp");return<tr key={car}><TD main>{car}</TD><TD>{fmtMoney(rg)}</TD><TD>{fmtMoney(rv)}</TD><TD>{rc}</TD><TD><ACoSBadge g={rg} v={rv}/></TD><TD>{rg>0?(rv/rg).toFixed(2)+"x":"–"}</TD><TD>{rk.toLocaleString()}</TD></tr>;})}</tbody></table></div></Card>
    </div>);
  };

  const PageCarteras=()=>{
    if(!fd.length)return<div style={{textAlign:"center",padding:60,color:C.text3}}>Sin datos</div>;
    return<div>{Object.entries(groupBy(fd,"cartera")).map(([car,rows])=>{const g=sum(rows,"gasto"),v=sum(rows,"ventas");return<Card key={car}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}><div style={{fontSize:14,fontWeight:500,color:C.text}}>{car}</div><div style={{display:"flex",gap:8,alignItems:"center"}}><ACoSBadge g={g} v={v}/><span style={{fontSize:11,color:C.text2}}>{fmtMoney(g)} gastado · {fmtMoney(v)} ventas</span></div></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Campaña","Gasto","Ventas","Compras","ACoS","ROAS"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{Object.entries(groupBy(rows,"campana")).sort((a,b)=>sum(b[1],"ventas")-sum(a[1],"ventas")).map(([camp,cr])=>{const cg=sum(cr,"gasto"),cv=sum(cr,"ventas"),cc=sum(cr,"compras");return<tr key={camp}><TD main style={{maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{camp}</TD><TD>{fmtMoney(cg)}</TD><TD>{fmtMoney(cv)}</TD><TD>{cc}</TD><TD><ACoSBadge g={cg} v={cv}/></TD><TD>{cg>0?(cv/cg).toFixed(2)+"x":"–"}</TD></tr>;})}</tbody></table></div></Card>;})}</div>;
  };

  const PageKeywords=()=>{
    if(!fd.length)return<div style={{textAlign:"center",padding:60,color:C.text3}}>Sin datos</div>;
    const agg={};fd.forEach(r=>{if(!r.keyword)return;const k=`${r.keyword}|${r.match}|${r.cartera}`;if(!agg[k])agg[k]={kw:r.keyword,match:r.match,cartera:r.cartera,g:0,v:0,c:0,imp:0,cpc:r.cpc};agg[k].g+=r.gasto;agg[k].v+=r.ventas;agg[k].c+=r.compras;agg[k].imp+=r.impresiones;agg[k].cpc=r.cpc;});
    const rows=Object.values(agg).sort((a,b)=>b.g-a.g);const sinConv=rows.filter(r=>r.v===0&&r.g>0);const maxG=Math.max(...rows.map(r=>r.g),1);
    return<div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))",gap:12,marginBottom:20}}><KPI label="Keywords únicas" value={rows.length}/><KPI label="Gasto total" value={fmtMoney(rows.reduce((s,r)=>s+r.g,0))}/><KPI label="Sin conversión" value={sinConv.length} sub={fmtMoney(sinConv.reduce((s,r)=>s+r.g,0))+" gastado"} color={C.red}/></div><Card><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Keyword","Tipo","Cartera","Imp.","Gasto","Ventas","ACoS","CPC"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{rows.slice(0,200).map((r,i)=>{const bw=Math.round((r.g/maxG)*60);return<tr key={i}><TD main>{r.kw}</TD><TD><Badge color={C.accent} bg="rgba(124,106,247,0.12)">{r.match||"–"}</Badge></TD><TD style={{fontSize:10,color:C.text3}}>{r.cartera}</TD><TD>{r.imp.toLocaleString()}</TD><TD><div>{fmtMoney(r.g)}</div><div style={{height:3,width:bw,background:C.accent,borderRadius:2,marginTop:3}}/></TD><TD>{fmtMoney(r.v)}</TD><TD><ACoSBadge g={r.g} v={r.v}/></TD><TD>${r.cpc.toFixed(2)}</TD></tr>;})}</tbody></table></div></Card></div>;
  };

  const PageSearchTerms=()=>{
    if(!fd.length)return<div style={{textAlign:"center",padding:60,color:C.text3}}>Sin datos</div>;
    const agg={};fd.forEach(r=>{if(!r.termino)return;const k=`${r.termino}|${r.cartera}`;if(!agg[k])agg[k]={t:r.termino,kw:r.keyword,cartera:r.cartera,g:0,v:0,c:0};agg[k].g+=r.gasto;agg[k].v+=r.ventas;agg[k].c+=r.compras;});
    let rows=Object.values(agg);
    if(stTab==="converting")rows=rows.filter(r=>r.v>0||r.c>0);
    else if(stTab==="wasted")rows=rows.filter(r=>r.v===0&&r.g>0);
    else if(stTab==="new")rows=rows.filter(r=>r.c>=2&&r.t!==r.kw);
    rows.sort((a,b)=>b.g-a.g);
    const all=Object.values(agg);const sinConv=all.filter(r=>r.v===0&&r.g>0);
    const tabs=[["all","Todos"],["converting","Con conversión"],["wasted","Sin conversión"],["new","Candidatos a añadir"]];
    return<div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))",gap:12,marginBottom:20}}><KPI label="Términos únicos" value={all.length}/><KPI label="Gasto" value={fmtMoney(all.reduce((s,r)=>s+r.g,0))}/><KPI label="Sin conversión" value={sinConv.length} sub={fmtMoney(sinConv.reduce((s,r)=>s+r.g,0))+" gastado"} color={C.red}/></div><div style={{display:"flex",gap:2,borderBottom:`1px solid ${C.border}`,marginBottom:16}}>{tabs.map(([id,label])=><div key={id} onClick={()=>setStTab(id)} style={{padding:"8px 16px",fontSize:11,cursor:"pointer",color:stTab===id?C.blue:C.text3,borderBottom:`2px solid ${stTab===id?C.blue:"transparent"}`,marginBottom:-1}}>{label}</div>)}</div><Card><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Término","Keyword","Gasto","Ventas","ACoS","Compras","Estado"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{rows.slice(0,200).map((r,i)=><tr key={i}><TD main>{r.t}</TD><TD style={{fontSize:10,color:C.text3}}>{r.kw||"–"}</TD><TD>{fmtMoney(r.g)}</TD><TD>{fmtMoney(r.v)}</TD><TD><ACoSBadge g={r.g} v={r.v}/></TD><TD>{r.c}</TD><TD>{r.v>0?<Badge color={C.green} bg="rgba(52,211,153,0.15)">Convierte</Badge>:<Badge color={C.red} bg="rgba(248,113,113,0.15)">Sin conv.</Badge>}</TD></tr>)}</tbody></table></div></Card></div>;
  };

  const PagePlacements=()=>{
    if(!fd.length)return<div style={{textAlign:"center",padding:60,color:C.text3}}>Sin datos</div>;
    const agg={};fd.forEach(r=>{const pl=r.placement||"";if(!pl||pl==="UNKNOWN"||pl==="Unknown")return;if(!agg[pl])agg[pl]={name:pl,g:0,v:0,c:0,imp:0,cl:0};agg[pl].g+=r.gasto;agg[pl].v+=r.ventas;agg[pl].c+=r.compras;agg[pl].imp+=r.impresiones;agg[pl].cl+=r.clics;});
    const rows=Object.values(agg).sort((a,b)=>b.v-a.v);const totalV=rows.reduce((s,r)=>s+r.v,0);
    if(!rows.length)return<Card><div style={{color:C.text2,fontSize:13,lineHeight:1.8}}><div style={{fontSize:15,fontWeight:500,color:C.text,marginBottom:10}}>Sin datos de emplazamientos</div><p>El reporte actual no incluye datos de placement. Para verlos, descarga el CSV con <strong style={{color:C.accent}}>Nombre del emplazamiento</strong> como dimensión en Amazon Ads → Informes → Crear informe.</p></div></Card>;
    return<Card><div style={{fontSize:11,color:C.text3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:14}}>Rendimiento por emplazamiento</div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Emplazamiento","Imp.","Clics","Gasto","Ventas","ACoS","Compras","Share"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{rows.map((r,i)=>{const share=totalV>0?(r.v/totalV*100):0;return<tr key={i}><TD main>{plNames[r.name]||r.name}</TD><TD>{r.imp.toLocaleString()}</TD><TD>{r.cl.toLocaleString()}</TD><TD>{fmtMoney(r.g)}</TD><TD>{fmtMoney(r.v)}</TD><TD><ACoSBadge g={r.g} v={r.v}/></TD><TD>{r.c}</TD><TD><div style={{display:"flex",alignItems:"center",gap:5}}><div style={{height:4,width:Math.round(share),maxWidth:80,background:C.accent,borderRadius:2}}/><span style={{fontSize:10}}>{share.toFixed(1)}%</span></div></TD></tr>;})}</tbody></table></div></Card>;
  };

  const PageAI=()=>{
    if(!hasData)return<div style={{textAlign:"center",padding:60,color:C.text3}}>Importa datos primero</div>;
    if(!apiKey)return<div style={{textAlign:"center",padding:60,color:C.text3}}>Ve a <strong style={{color:C.accent,cursor:"pointer"}} onClick={()=>setPage("config")}>Configuración</strong> e introduce tu API key</div>;
    return<Card>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}><div style={{width:7,height:7,borderRadius:"50%",background:C.accent}}/><span style={{fontSize:13,fontWeight:500,color:C.text}}>Análisis inteligente con IA</span><span style={{fontSize:10,color:C.text3,marginLeft:"auto"}}>claude-sonnet-4</span></div>
      <div style={{marginBottom:12}}>
        <textarea
          value={aiQuestion}
          onChange={e=>setAiQuestion(e.target.value)}
          placeholder="Pregunta específica (opcional): ¿Qué keywords debo pausar? ¿Por qué el ACoS es alto?..."
          style={{display:"block",width:"100%",minHeight:80,fontSize:13,background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:8,padding:"10px 12px",color:C.text,resize:"vertical",fontFamily:"inherit",boxSizing:"border-box",lineHeight:1.6,outline:"none"}}
        />
      </div>
      <button onClick={runAnalysis} disabled={aiLoading} style={{padding:"9px 20px",borderRadius:8,border:"none",background:C.accent,color:"#fff",fontSize:13,cursor:aiLoading?"not-allowed":"pointer",opacity:aiLoading?0.7:1,fontFamily:"inherit"}}>{aiLoading?"Analizando...":"✦ Analizar con IA"}</button>
      {aiOutput&&<div style={{marginTop:16,fontSize:13,color:C.text2,lineHeight:1.9,whiteSpace:"pre-wrap",borderTop:`1px solid ${C.border}`,paddingTop:16}}>{aiOutput}</div>}
    </Card>;
  };

  const PageStrategies=()=>{
    if(!aiOutput&&!stratLoading)return<div style={{textAlign:"center",padding:60,color:C.text3}}>Ejecuta primero el análisis IA</div>;
    if(stratLoading)return<div style={{textAlign:"center",padding:40,color:C.text2,fontSize:13}}>Generando estrategias...</div>;
    const priorColor={alta:{bg:"rgba(248,113,113,0.15)",color:C.red},media:{bg:"rgba(251,191,36,0.15)",color:C.amber},baja:{bg:"rgba(96,165,250,0.15)",color:C.blue}};
    const catColor={Pujas:{bg:"rgba(96,165,250,0.15)",color:C.blue},Keywords:{bg:"rgba(52,211,153,0.15)",color:C.green},Presupuesto:{bg:"rgba(251,191,36,0.15)",color:C.amber},Negativos:{bg:"rgba(248,113,113,0.15)",color:C.red},Emplazamientos:{bg:"rgba(96,165,250,0.15)",color:C.blue},Estructura:{bg:"rgba(255,255,255,0.06)",color:C.text2}};
    const plazoColor={hoy:{bg:"rgba(248,113,113,0.15)",color:C.red},"esta semana":{bg:"rgba(251,191,36,0.15)",color:C.amber},"próximos 14 días":{bg:"rgba(96,165,250,0.15)",color:C.blue},"próximo mes":{bg:"rgba(255,255,255,0.06)",color:C.text2}};
    return<div>{strategies.map((s,i)=>{const pc=priorColor[s.prioridad]||{bg:"rgba(255,255,255,0.06)",color:C.text2};const cc=catColor[s.categoria]||{bg:"rgba(255,255,255,0.06)",color:C.text2};const plc=plazoColor[s.plazo]||{bg:"rgba(255,255,255,0.06)",color:C.text2};return<Card key={i} style={{marginBottom:10}}><div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:10}}><div style={{width:24,height:24,borderRadius:"50%",background:"rgba(96,165,250,0.15)",color:C.blue,fontSize:11,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div><div><div style={{fontSize:13,fontWeight:500,color:C.text,marginBottom:6}}>{s.titulo}</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Badge color={pc.color} bg={pc.bg}>Prioridad {s.prioridad}</Badge><Badge color={cc.color} bg={cc.bg}>{s.categoria}</Badge><Badge color={plc.color} bg={plc.bg}>{s.plazo}</Badge></div></div></div><div style={{fontSize:12,color:C.text2,lineHeight:1.7,paddingLeft:36}}><p style={{marginBottom:5}}>{s.accion}</p><p style={{color:C.green,fontSize:11}}>Impacto esperado: {s.impacto}</p></div></Card>;})}
    {strategies.length>0&&<button onClick={()=>runStrategies(aiOutput)} style={{fontSize:11,padding:"5px 12px",border:`1px solid ${C.border2}`,background:"transparent",color:C.text2,borderRadius:6,cursor:"pointer"}}>↺ Regenerar estrategias</button>}
    </div>;
  };

  const PageConfig=()=>(<Card><div style={{fontSize:14,fontWeight:500,color:C.text,marginBottom:16}}>Configuración</div><div style={{marginBottom:20}}><div style={{fontSize:11,color:C.text3,marginBottom:8}}>API KEY DE ANTHROPIC</div><div style={{fontSize:12,color:C.text2,marginBottom:10,lineHeight:1.6}}>Consíguela en <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{color:C.accent}}>console.anthropic.com</a> → API Keys → Create Key</div><div style={{display:"flex",gap:8}}><input type={showApiKey?"text":"password"} value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk-ant-api03-..." style={{flex:1,padding:"9px 12px",background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"monospace"}}/><button onClick={()=>setShowApiKey(s=>!s)} style={{padding:"9px 12px",background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:8,color:C.text2,cursor:"pointer",fontSize:12}}>{showApiKey?"Ocultar":"Ver"}</button><button onClick={()=>saveApiKey(apiKey)} style={{padding:"9px 16px",background:C.accent,border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Guardar</button></div>{apiKey&&<div style={{marginTop:8,fontSize:11,color:C.green}}>✓ API key guardada</div>}</div><div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}><div style={{fontSize:11,color:C.text3,marginBottom:8}}>BASE DE DATOS</div><div style={{fontSize:12,color:C.text2,marginBottom:10}}>{db.rows.length.toLocaleString()} registros · {allDates.length} días · {carteras.length} carteras</div><button onClick={()=>{if(window.confirm("¿Borrar toda la base de datos?"))persist({rows:[],meta:{lastUpdate:null}});}} style={{fontSize:11,padding:"5px 10px",border:`1px solid rgba(248,113,113,0.4)`,background:"transparent",color:C.red,borderRadius:6,cursor:"pointer"}}>Borrar base de datos</button></div></Card>);

  const pages={upload:<PageUpload/>,dashboard:<PageDashboard/>,carteras:<PageCarteras/>,keywords:<PageKeywords/>,searchterms:<PageSearchTerms/>,placements:<PagePlacements/>,ai:<PageAI/>,strategies:<PageStrategies/>,config:<PageConfig/>};
  const total=db.rows.length;

  return(<div style={{display:"flex",minHeight:"100vh",fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",fontSize:14,background:C.bg,color:C.text}}>
    <div style={{width:210,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,background:C.bg2}}>
      <div style={{padding:"16px 16px 14px",borderBottom:`1px solid ${C.border}`}}><div style={{fontSize:14,fontWeight:600,color:C.text}}>KDP Ads Analytics</div><div style={{fontSize:10,color:C.text3,marginTop:2}}>Panel de campañas</div></div>
      <div style={{padding:"8px 0",flex:1}}>
        <div style={{padding:"6px 16px",fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em",color:C.text3}}>Principal</div>
        {navItem("upload","Importar datos","↓")}{navItem("dashboard","Dashboard","▦")}
        <div style={{padding:"6px 16px",fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em",color:C.text3,marginTop:6}}>Análisis</div>
        {navItem("carteras","Carteras","◉")}{navItem("keywords","Keywords","◎")}{navItem("searchterms","Términos búsqueda","◈")}{navItem("placements","Emplazamientos","↗")}
        <div style={{padding:"6px 16px",fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em",color:C.text3,marginTop:6}}>IA</div>
        {navItem("ai","Análisis IA","✦")}{navItem("strategies","Estrategias","→")}
        <div style={{padding:"6px 16px",fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em",color:C.text3,marginTop:6}}>Sistema</div>
        {navItem("config","Configuración","⚙")}
      </div>
      <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`}}><div style={{fontSize:10,color:C.text3,lineHeight:1.8}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:6,height:6,borderRadius:"50%",background:total>0?C.green:C.text3}}/>{total>0?"Base de datos activa":"Sin datos"}</div>{total>0&&<><div>{total.toLocaleString()} registros</div><div>{db.meta.lastUpdate&&"Act: "+db.meta.lastUpdate}</div></>}</div></div>
    </div>
    <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"12px 24px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",background:C.bg2}}>
        <div style={{fontSize:15,fontWeight:500,color:C.text,marginRight:8}}>{titles[page]}</div>
        {hasData&&<>
          <select value={filters.cartera} onChange={e=>setFilters(f=>({...f,cartera:e.target.value}))} style={selectStyle}><option value="">Todas las carteras</option>{carteras.map(c=><option key={c}>{c}</option>)}</select>
          <input type="date" value={filters.from} onChange={e=>setFilters(f=>({...f,from:e.target.value}))} style={selectStyle}/>
          <span style={{fontSize:10,color:C.text3}}>→</span>
          <input type="date" value={filters.to} onChange={e=>setFilters(f=>({...f,to:e.target.value}))} style={selectStyle}/>
          <button onClick={()=>setFilters({cartera:"",from:allDates[0]||"",to:allDates[allDates.length-1]||""})} style={{fontSize:11,padding:"6px 12px",border:`1px solid ${C.border2}`,background:"transparent",color:C.text2,borderRadius:8,cursor:"pointer"}}>Limpiar</button>
        </>}
      </div>
      <div style={{flex:1,padding:24,overflowY:"auto"}}>{pages[page]}</div>
    </div>
  </div>);
}
