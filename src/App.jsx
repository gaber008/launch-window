import React, { useState, useEffect, useCallback } from "react";

const LOCATIONS = [
  { id:0, name:"Titlow Beach",         region:"Tacoma",        lat:47.2489, lon:-122.5525, tideStation:"9446484", currentStation:"TAC0101" },
  { id:1, name:"Owen Beach",           region:"Pt Defiance",   lat:47.2985, lon:-122.5409, tideStation:"9446484", currentStation:"TAC0101" },
  { id:2, name:"Dash Point",           region:"Federal Way",   lat:47.3087, lon:-122.4078, tideStation:"9446484", currentStation:"TAC0101" },
  { id:3, name:"Saltwater State Park", region:"Des Moines",    lat:47.3654, lon:-122.3237, tideStation:"9447130", currentStation:"SEA0101" },
  { id:4, name:"Shilshole Bay",        region:"Seattle",       lat:47.6877, lon:-122.4014, tideStation:"9447130", currentStation:"SEA0101" },
  { id:5, name:"Edmonds Marina",       region:"Edmonds",       lat:47.8127, lon:-122.3891, tideStation:"9447130", currentStation:"PUG1515" },
  { id:6, name:"Gig Harbor Ramp",      region:"Gig Harbor",    lat:47.3327, lon:-122.5797, tideStation:"9446484", currentStation:"TAC0101" },
  { id:7, name:"Joemma Beach",         region:"Key Peninsula", lat:47.2480, lon:-122.7580, tideStation:"9446484", currentStation:"TAC0101" },
  { id:8, name:"Anderson Island",      region:"Anderson Is.",  lat:47.1560, lon:-122.6860, tideStation:"9446484", currentStation:"TAC0101" },
];

const MPH_TO_KT = 0.868976;
const todayStr  = new Date().toISOString().split("T")[0];

const MOCK = {
  windKt:7.2, gustKt:11.4, windDir:"SW", fc:"Partly Cloudy", temp:58, tempU:"F",
  waveHt:1.5, wavePd:7, scaAlerts:[],
  tides:[
    {t:"2026-05-04 04:12",v:"-0.4",type:"L"},
    {t:"2026-05-04 10:33",v:"13.8",type:"H"},
    {t:"2026-05-04 16:51",v:"5.2", type:"L"},
    {t:"2026-05-04 22:17",v:"11.1",type:"H"},
  ],
  currKt:0.6,
  ws:"green", gs:"yellow", wvs:"yellow", cs:"green", adv:"green", vis:"green",
  verdict:"yellow", isMock:true,
};

function parseMph(str) {
  if (!str) return null;
  const m = str.match(/(\d+)(?:\s+to\s+(\d+))?\s*mph/i);
  if (!m) return null;
  const v = m[2] ? (parseInt(m[1]) + parseInt(m[2])) / 2 : parseInt(m[1]);
  return Math.round(v * MPH_TO_KT * 10) / 10;
}
function wStatus(kt)    { return kt==null?"unknown":kt<=8?"green":kt<=12?"yellow":kt<=15?"orange":"red"; }
function gStatus(kt)    { return kt==null?"green":kt<=12?"green":kt<=15?"yellow":"red"; }
function wvStatus(ft,p) { if(ft==null)return"unknown";if(ft<=1)return"green";if(ft<=2&&(!p||p>=6))return"yellow";if(ft>=3||(ft>=2&&p<5))return"red";return"yellow"; }
function cStatus(kt)    { return kt==null?"unknown":kt<1?"green":kt<2?"yellow":"red"; }
function visStatus(d)   {
  if(!d)return"unknown";const s=d.toLowerCase();
  if(s.includes("dense fog")||(s.includes("fog")&&!s.includes("patchy")))return"red";
  if(s.includes("fog")||s.includes("mist")||s.includes("haze"))return"yellow";
  return"green";
}
function overallVerdict(arr) {
  for(const p of["red","orange","yellow","green"])if(arr.includes(p))return p;
  return"unknown";
}

const NAVY  = "#1a2b4a";
const NAVY2 = "#243558";
const WHITE = "#ffffff";
const OFF   = "#f7f8fa";
const BORDER= "#e2e7ee";
const MUTED = "#7a8ca0";
const SC = { green:"#00875a", yellow:"#c48a00", orange:"#c45a00", red:"#c8322a", unknown:"#b0bac6" };
const SL = { green:"Go", yellow:"Caution", orange:"Marginal", red:"No Go", unknown:"—" };

function KayakLogo({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="58" rx="30" ry="7" fill={color} opacity="0.15"/>
      <path d="M10 56 Q25 48 40 48 Q55 48 70 56 Q55 62 40 62 Q25 62 10 56Z" fill={color}/>
      <rect x="33" y="40" width="14" height="12" rx="3" fill={color}/>
      <circle cx="40" cy="34" r="6" fill={color}/>
      <ellipse cx="40" cy="29" rx="11" ry="3" fill={color}/>
      <rect x="35" y="22" width="10" height="8" rx="2" fill={color}/>
      <line x1="12" y1="50" x2="68" y2="50" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="12" cy="50" rx="4" ry="7" fill={color} transform="rotate(-15 12 50)"/>
      <ellipse cx="68" cy="50" rx="4" ry="7" fill={color} transform="rotate(15 68 50)"/>
      <path d="M18 64 Q28 61 40 64 Q52 67 62 64" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
    </svg>
  );
}

export default function LaunchWindow() {
  const [dark,    setDark]    = useState(false);
  const [locId,   setLocId]   = useState(0);
  const [date,    setDate]    = useState(todayStr);
  const [hour,    setHour]    = useState(new Date().getHours());
  const [cond,    setCond]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState([]);

  // Manual confirms: 3 personal checks + 6 auto-row verifications
  const [manual,  setManual]  = useState({ gear:true, floatPlan:false, shore:false });
  const [verified, setVerified] = useState({ wind:false, gusts:false, waves:false, current:false, advisories:false, visibility:false });

  const loc = LOCATIONS[locId];
  const bg      = dark ? NAVY    : WHITE;
  const bgCard  = dark ? NAVY2   : OFF;
  const border  = dark ? "#2e4268" : BORDER;
  const text    = dark ? "#e8edf4" : NAVY;
  const textMid = dark ? "#8faabb" : MUTED;

  // Reset verifications when new data is fetched
  function resetVerified() {
    setVerified({ wind:false, gusts:false, waves:false, current:false, advisories:false, visibility:false });
  }

  useEffect(function() {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = [
      "*{box-sizing:border-box;margin:0;padding:0}",
      "body{overflow-x:hidden;-webkit-font-smoothing:antialiased}",
      "@keyframes spin{to{transform:rotate(360deg)}}",
      "@keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}",
      ".a0{animation:up .5s ease both}",
      ".a1{animation:up .5s .08s ease both}",
      ".a2{animation:up .5s .16s ease both}",
      ".a3{animation:up .5s .24s ease both}",
    ].join("");
    document.head.appendChild(style);
    return function() {
      try{document.head.removeChild(link);}catch(e){}
      try{document.head.removeChild(style);}catch(e){}
    };
  }, []);

  const check = useCallback(async function() {
    setLoading(true); setCond(null); setSources([]); resetVerified();
    const src = [];
    try {
      const ptRes = await fetch(
        "https://api.weather.gov/points/" + loc.lat + "," + loc.lon,
        { headers:{"User-Agent":"LaunchWindow/3.0"} }
      );
      if (!ptRes.ok) throw new Error("NWS " + ptRes.status);
      const pt = await ptRes.json();
      const fhUrl = pt.properties.forecastHourly;
      src.push({ label:"NWS Hourly", url:fhUrl });

      const fRes = await fetch(fhUrl, { headers:{"User-Agent":"LaunchWindow/3.0"} });
      if (!fRes.ok) throw new Error("Forecast unavailable");
      const fData = await fRes.json();
      const periods = fData.properties.periods;
      const target  = new Date(date + "T" + String(hour).padStart(2,"0") + ":00:00");
      const period  = periods.find(function(p){ return new Date(p.startTime)<=target&&new Date(p.endTime)>target; }) || periods[0];

      const windKt  = parseMph(period.windSpeed);
      const gustKt  = period.windGust ? parseMph(period.windGust) : null;
      const windDir = period.windDirection || "—";
      const fc      = period.shortForecast || "";
      const detail  = period.detailedForecast || "";
      const temp    = period.temperature;
      const tempU   = period.temperatureUnit;

      let waveHt=null, wavePd=null;
      const wm = detail.match(/waves?\s+(\d+(?:\.\d+)?)\s*(?:to\s+(\d+(?:\.\d+)?)\s*)?(?:ft|feet)/i);
      if(wm) waveHt = wm[2]?(parseFloat(wm[1])+parseFloat(wm[2]))/2:parseFloat(wm[1]);
      const pm = detail.match(/(\d+)\s*(?:second|sec)\s*period/i);
      if(pm) wavePd = parseInt(pm[1]);

      let scaAlerts = [];
      try {
        const alRes = await fetch(
          "https://api.weather.gov/alerts/active?point="+loc.lat+","+loc.lon,
          { headers:{"User-Agent":"LaunchWindow/3.0"} }
        );
        if(alRes.ok) {
          const al = await alRes.json();
          scaAlerts = (al.features||[]).filter(function(f){
            const ev=((f.properties&&f.properties.event)||"").toLowerCase();
            return ev.includes("small craft")||ev.includes("gale")||ev.includes("storm warning")||ev.includes("marine");
          }).map(function(f){ return f.properties.event; });
          src.push({ label:"NWS Alerts", url:"https://alerts.weather.gov" });
        }
      } catch(e) {}

      const td = date.replace(/-/g,"");
      let tides = [];
      try {
        const tRes = await fetch(
          "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW&station="+
          loc.tideStation+"&begin_date="+td+"&end_date="+td+
          "&time_zone=lst_lnt&interval=hilo&units=english&application=LaunchWindow&format=json"
        );
        const tData = await tRes.json();
        tides = tData.predictions || [];
        src.push({ label:"NOAA Tides", url:"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id="+loc.tideStation });
      } catch(e) {}

      let currKt = null;
      try {
        const cRes = await fetch(
          "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=currents_predictions&station="+
          loc.currentStation+"&begin_date="+td+"&end_date="+td+
          "&interval=h&units=english&time_zone=lst_lnt&application=LaunchWindow&format=json"
        );
        const cData = await cRes.json();
        const preds = (cData.current_predictions&&cData.current_predictions.cp)||[];
        const cT    = date+" "+String(hour).padStart(2,"0")+":00";
        const cl    = preds.find(function(p){ return p.Time&&p.Time.startsWith(cT.slice(0,13)); })||preds[0];
        if(cl&&cl.Velocity_Major) currKt = Math.abs(parseFloat(cl.Velocity_Major));
        src.push({ label:"NOAA Currents", url:"https://tidesandcurrents.noaa.gov/currents/overview/"+loc.currentStation });
      } catch(e) {}

      const _ws=wStatus(windKt),_gs=gStatus(gustKt),_wvs=wvStatus(waveHt,wavePd),_cs=cStatus(currKt);
      const adv=scaAlerts.length>0?"red":"green", _vis=visStatus(fc);
      setCond({ windKt,gustKt,windDir,fc,temp,tempU,waveHt,wavePd,scaAlerts,tides,currKt,
        ws:_ws,gs:_gs,wvs:_wvs,cs:_cs,adv,vis:_vis,
        verdict:overallVerdict([_ws,_gs,_wvs,adv,_vis,_cs]) });
      setSources(src);
    } catch(err) {
      setCond(MOCK);
      setSources([
        {label:"NWS Forecast",  url:"https://forecast.weather.gov"},
        {label:"NOAA Tides",    url:"https://tidesandcurrents.noaa.gov"},
        {label:"NOAA Currents", url:"https://tidesandcurrents.noaa.gov/currents.html"},
        {label:"NWS Alerts",    url:"https://alerts.weather.gov"},
      ]);
    }
    setLoading(false);
  }, [loc, date, hour]);

  useEffect(function(){ check(); }, []);

  const c  = cond;
  const v  = (c&&c.verdict)||"unknown";
  const vc = SC[v];
  const allManual   = manual.gear && manual.floatPlan && manual.shore;
  const allVerified = verified.wind && verified.gusts && verified.waves && verified.current && verified.advisories && verified.visibility;
  const allGo       = v==="green" && allManual && allVerified;

  function toggleVerified(key) {
    setVerified(function(p){ return Object.assign({},p,{ [key]:!p[key] }); });
  }
  function toggleManual(key) {
    setManual(function(p){ return Object.assign({},p,{ [key]:!p[key] }); });
  }

  const selStyle = {
    background:"transparent", border:"1px solid "+border, borderRadius:"6px",
    color:text, padding:"9px 12px", fontFamily:"'DM Sans',sans-serif",
    fontSize:"14px", cursor:"pointer", outline:"none", width:"100%", height:"42px", appearance:"none",
  };

  // How many items verified / total
  const autoCount     = Object.values(verified).filter(Boolean).length;
  const manualCount   = Object.values(manual).filter(Boolean).length;
  const totalChecked  = autoCount + manualCount;
  const totalItems    = 9;

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:bg, minHeight:"100vh", color:text }}>

      {/* NAV */}
      <div style={{ background:NAVY, padding:"0 28px" }}>
        <div style={{ maxWidth:"860px", margin:"0 auto", height:"60px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <KayakLogo size={36} color={WHITE} />
            <div>
              <div style={{ fontWeight:600, fontSize:"15px", color:WHITE, letterSpacing:".02em" }}>Launch Window</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:"#7a9cc0", letterSpacing:".08em", marginTop:"-1px" }}>
                PUGET SOUND · HOBIE OUTBACK
              </div>
            </div>
          </div>
          <button onClick={function(){ setDark(function(d){ return !d; }); }}
            style={{ background:"none", border:"1px solid #2e4268", borderRadius:"20px",
              padding:"5px 14px", color:"#7a9cc0", fontSize:"12px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
            {dark?"Light":"Dark"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth:"860px", margin:"0 auto", padding:"32px 24px 64px" }}>

        {/* CONTROLS */}
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr auto", gap:"10px", marginBottom:"32px", alignItems:"end" }}>
          <div>
            <label style={{ display:"block", fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid, letterSpacing:".1em", marginBottom:"6px" }}>LAUNCH SITE</label>
            <div style={{ position:"relative" }}>
              <select value={locId} onChange={function(e){ setLocId(+e.target.value); }} style={selStyle}>
                {LOCATIONS.map(function(l){ return <option key={l.id} value={l.id}>{l.name} — {l.region}</option>; })}
              </select>
              <span style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", color:textMid, pointerEvents:"none", fontSize:"11px" }}>▾</span>
            </div>
          </div>
          <div>
            <label style={{ display:"block", fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid, letterSpacing:".1em", marginBottom:"6px" }}>DATE</label>
            <input type="date" value={date}
              onChange={function(e){ setDate(e.target.value); }}
              min={todayStr} max={new Date(Date.now()+7*864e5).toISOString().split("T")[0]}
              style={Object.assign({},selStyle,{colorScheme:dark?"dark":"light"})} />
          </div>
          <div>
            <label style={{ display:"block", fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid, letterSpacing:".1em", marginBottom:"6px" }}>TIME</label>
            <div style={{ position:"relative" }}>
              <select value={hour} onChange={function(e){ setHour(+e.target.value); }} style={selStyle}>
                {Array.from({length:16},function(_,i){ return i+5; }).map(function(h){
                  return <option key={h} value={h}>{h<12?h+":00 AM":h===12?"12:00 PM":(h-12)+":00 PM"}</option>;
                })}
              </select>
              <span style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", color:textMid, pointerEvents:"none", fontSize:"11px" }}>▾</span>
            </div>
          </div>
          <button onClick={check} disabled={loading} style={{
            background:loading?bgCard:NAVY, border:"1px solid "+(loading?border:NAVY),
            borderRadius:"6px", color:loading?textMid:WHITE,
            padding:"0 22px", fontFamily:"'DM Sans',sans-serif", fontWeight:500,
            fontSize:"14px", cursor:loading?"not-allowed":"pointer", height:"42px", whiteSpace:"nowrap",
          }}>
            {loading?"Checking…":"Check"}
          </button>
        </div>

        {/* MOCK NOTICE */}
        {c&&c.isMock&&(
          <div style={{ background:dark?"#1e3060":"#eef3f8", border:"1px solid "+border, borderRadius:"6px",
            padding:"10px 16px", marginBottom:"24px", fontFamily:"'DM Mono',monospace", fontSize:"11px", color:textMid }}>
            Demo data — live NOAA fetch unavailable in this preview. Deploy to see real conditions.
          </div>
        )}

        {/* VERDICT */}
        {(loading||c)&&(
          <div className="a0" style={{ marginBottom:"32px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"20px", padding:"24px 28px",
              background:bgCard, borderRadius:"12px", border:"1px solid "+border }}>
              <div style={{ width:"56px", height:"56px", borderRadius:"50%", flexShrink:0,
                background:loading?border:vc, display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:loading?"none":"0 0 0 8px "+vc+"22" }}>
                {loading
                  ? <div style={{ width:"20px",height:"20px",border:"2px solid "+textMid,borderTopColor:text,borderRadius:"50%",animation:"spin .8s linear infinite" }}/>
                  : <span style={{ fontFamily:"'DM Mono',monospace", fontWeight:500, fontSize:"10px", color:WHITE, letterSpacing:".04em" }}>
                      {v==="green"?"GO":v==="red"?"NO GO":v==="orange"?"MARG.":"WAIT"}
                    </span>
                }
              </div>
              <div style={{ flex:1 }}>
                {loading
                  ? <div style={{ fontSize:"22px", fontWeight:300, color:textMid }}>Fetching conditions…</div>
                  : <React.Fragment>
                      <div style={{ fontSize:"22px", fontWeight:300, color:text, marginBottom:"3px" }}>
                        {allGo?"Conditions look good. Fish on."
                          :v==="red"||v==="orange"?"Not recommended today."
                          :v==="yellow"?"Marginal — paddle with caution."
                          :"Check complete."}
                      </div>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"12px", color:textMid }}>
                        {loc.name} · {new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
                        {c&&c.temp?" · "+c.temp+"°"+c.tempU:""}
                        {c&&c.fc?" · "+c.fc:""}
                      </div>
                      {c&&c.scaAlerts&&c.scaAlerts.length>0&&(
                        <div style={{ marginTop:"8px", fontFamily:"'DM Mono',monospace", fontSize:"11px",
                          color:SC.red, background:dark?"#2a1010":"#fef2f2",
                          display:"inline-block", padding:"3px 10px", borderRadius:"4px" }}>
                          ⚠ {c.scaAlerts[0]}
                        </div>
                      )}
                    </React.Fragment>
                }
              </div>
              {/* Progress pill */}
              {c&&(
                <div style={{ textAlign:"center", padding:"10px 16px", background:dark?"#1a2b4a":WHITE,
                  borderRadius:"8px", border:"1px solid "+border, flexShrink:0, minWidth:"90px" }}>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:textMid, letterSpacing:".1em", marginBottom:"6px" }}>
                    CHECKLIST
                  </div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"22px", fontWeight:500, color:text, lineHeight:1 }}>
                    {totalChecked}<span style={{ fontSize:"13px", color:textMid, fontWeight:300 }}>/{totalItems}</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ marginTop:"6px", height:"3px", background:border, borderRadius:"2px", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:(totalChecked/totalItems*100)+"%",
                      background: totalChecked===totalItems?SC.green:totalChecked>5?SC.yellow:SC.orange,
                      borderRadius:"2px", transition:"width .3s" }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* METRICS */}
        {c&&(
          <div className="a1">
            <SectionLabel text="Conditions" textMid={textMid} />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"28px" }}>
              <Metric dark={dark} bg={bgCard} border={border} text={text} textMid={textMid}
                label="Wind" value={c.windKt!=null?c.windKt.toFixed(1):"—"} unit="kt"
                sub={c.windDir?"from "+c.windDir:null} status={c.ws}
                thresh="0–8: Ideal · 8–12: OK · 12–15: Marginal · 15+: No Go" />
              <Metric dark={dark} bg={bgCard} border={border} text={text} textMid={textMid}
                label="Gusts" value={c.gustKt!=null?c.gustKt.toFixed(1):"—"} unit="kt"
                sub={c.gustKt==null?"none reported":null} status={c.gs}
                thresh="≤12: OK · ≤15: Caution · 15+: No Go" />
              <Metric dark={dark} bg={bgCard} border={border} text={text} textMid={textMid}
                label="Waves" value={c.waveHt!=null?c.waveHt.toFixed(1):"—"} unit="ft"
                sub={c.wavePd?c.wavePd+"s period":c.waveHt==null?"check manually":null} status={c.wvs}
                thresh="≤1 ft: Easy · 1–2 ft @ 6s+: OK · 3 ft+: No Go" />
              <Metric dark={dark} bg={bgCard} border={border} text={text} textMid={textMid}
                label="Current" value={c.currKt!=null?c.currKt.toFixed(2):"—"} unit="kt"
                sub={c.currKt==null?"see NOAA Currents":null} status={c.cs}
                thresh="<1 kt: Fine · 1–2 kt: Plan carefully · 2+: No Go" />
              <Metric dark={dark} bg={bgCard} border={border} text={text} textMid={textMid}
                label="Advisories" value={c.scaAlerts&&c.scaAlerts.length?"Active":"Clear"} unit=""
                sub={(c.scaAlerts&&c.scaAlerts[0])||"No marine advisories"} status={c.adv}
                thresh="Any Small Craft / Gale / Storm Warning = No Go" />
              <Metric dark={dark} bg={bgCard} border={border} text={text} textMid={textMid}
                label="Visibility" value={c.vis==="green"?"Good":c.vis==="yellow"?"Limited":"Poor"} unit=""
                sub={c.fc||null} status={c.vis}
                thresh=">1 mile: OK · Dense fog + shipping: No Go" />
            </div>
          </div>
        )}

        {/* TIDES */}
        {c&&c.tides&&c.tides.length>0&&(
          <div className="a2" style={{ marginBottom:"28px" }}>
            <SectionLabel text={"Tides · "+new Date(date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} textMid={textMid} />
            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
              {c.tides.map(function(t,i){
                return (
                  <div key={i} style={{ background:bgCard, border:"1px solid "+border, borderRadius:"8px", padding:"14px 18px", minWidth:"110px" }}>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px",
                      color:t.type==="H"?SC.green:textMid, letterSpacing:".1em", marginBottom:"6px" }}>
                      {t.type==="H"?"HIGH":"LOW"}
                    </div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"24px", fontWeight:500, color:text, lineHeight:1 }}>
                      {parseFloat(t.v).toFixed(1)}<span style={{ fontSize:"12px", color:textMid, fontWeight:300 }}> ft</span>
                    </div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"11px", color:textMid, marginTop:"4px" }}>
                      {t.t&&t.t.split(" ")[1]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CHECKLIST */}
        {c&&(
          <div className="a2" style={{ marginBottom:"28px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
              <SectionLabel text="Pre-Launch Checklist" textMid={textMid} />
              {/* Reset verifications button */}
              {allVerified&&(
                <button onClick={resetVerified}
                  style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid,
                    background:"none", border:"none", cursor:"pointer", letterSpacing:".06em", marginTop:"-10px" }}>
                  Reset verifications
                </button>
              )}
            </div>

            <div style={{ background:bgCard, border:"1px solid "+border, borderRadius:"8px", overflow:"hidden" }}>

              {/* AUTO ROWS — each has a Verify button */}
              <CheckRow dark={dark} border={border} text={text} textMid={textMid}
                status={c.ws} verifyKey="wind" verified={verified.wind} onVerify={toggleVerified}
                label="Wind ≤ 12 kt"
                detail={c.windKt!=null?c.windKt.toFixed(1)+" kt from "+c.windDir:"data unavailable"}
                sourceUrl="https://forecast.weather.gov" />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid}
                status={c.gs} verifyKey="gusts" verified={verified.gusts} onVerify={toggleVerified}
                label="Gusts ≤ 15 kt"
                detail={c.gustKt!=null?c.gustKt.toFixed(1)+" kt":"none reported"}
                sourceUrl="https://forecast.weather.gov" />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid}
                status={c.wvs} verifyKey="waves" verified={verified.waves} onVerify={toggleVerified}
                label="Waves ≤ 2 ft, 6s+ period"
                detail={c.waveHt!=null?c.waveHt.toFixed(1)+" ft"+(c.wavePd?" @ "+c.wavePd+"s":""):"check manually"}
                sourceUrl={"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id="+loc.tideStation} />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid}
                status={c.cs} verifyKey="current" verified={verified.current} onVerify={toggleVerified}
                label="Current ≤ 1 kt"
                detail={c.currKt!=null?c.currKt.toFixed(2)+" kt":"check tidesandcurrents.noaa.gov"}
                sourceUrl={"https://tidesandcurrents.noaa.gov/currents/overview/"+loc.currentStation} />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid}
                status={c.adv} verifyKey="advisories" verified={verified.advisories} onVerify={toggleVerified}
                label="No small craft advisory"
                detail={c.scaAlerts&&c.scaAlerts.length?c.scaAlerts.join(", "):"None active"}
                sourceUrl="https://alerts.weather.gov" />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid}
                status={c.vis} verifyKey="visibility" verified={verified.visibility} onVerify={toggleVerified}
                label="Visibility good, no fog"
                detail={c.fc||"—"}
                sourceUrl="https://forecast.weather.gov" />

              {/* Divider between auto and manual */}
              <div style={{ padding:"8px 16px", background:dark?"#1a2b4a30":"#f0f4f8",
                borderTop:"1px solid "+border, borderBottom:"1px solid "+border }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:textMid, letterSpacing:".12em" }}>
                  MANUAL CHECKS
                </span>
              </div>

              <CheckRow dark={dark} border={border} text={text} textMid={textMid} manual
                status={manual.gear?"green":"unknown"}
                label="Dry suit on"
                detail="Cold shock < 1 min. Swimming failure < 10 min. Dress for immersion."
                checked={manual.gear} onToggle={function(){ toggleManual("gear"); }} />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid} manual
                status={manual.floatPlan?"green":"unknown"}
                label="Float plan shared"
                detail="Someone ashore knows where you're going and when you'll be back."
                checked={manual.floatPlan} onToggle={function(){ toggleManual("floatPlan"); }} />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid} manual last
                status={manual.shore?"green":"unknown"}
                label="Route stays close to shore"
                detail="Narrows can run 3+ kt at exchange — plan accordingly."
                checked={manual.shore} onToggle={function(){ toggleManual("shore"); }} />
            </div>

            {/* Summary */}
            <div style={{ marginTop:"10px", padding:"14px 18px",
              background:allGo?SC.green+"18":v==="red"?SC.red+"12":bgCard,
              border:"1px solid "+(allGo?SC.green+"44":v==="red"?SC.red+"44":border),
              borderRadius:"8px", display:"flex", alignItems:"center", gap:"12px" }}>
              <div style={{ width:"8px", height:"8px", borderRadius:"50%", flexShrink:0,
                background:allGo?SC.green:v==="red"||v==="orange"?SC.red:SC.yellow }} />
              <div style={{ fontSize:"14px", color:text }}>
                {allGo
                  ? "All checks clear. Conditions look good — paddle safe."
                  : v==="red"||v==="orange"
                  ? "Conditions outside safe limits. Strongly reconsider launching today."
                  : !allVerified
                  ? "Verify the NOAA data above before heading out."
                  : !allManual
                  ? "Complete the manual checks above before heading out."
                  : "Marginal conditions — short trip, stay close to shore."}
              </div>
            </div>
          </div>
        )}

        {/* SOURCES */}
        {sources.length>0&&(
          <div className="a3" style={{ borderTop:"1px solid "+border, paddingTop:"20px", marginBottom:"24px" }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid, letterSpacing:".1em", marginBottom:"10px" }}>
              DATA SOURCES
            </div>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
              {sources.concat([{label:"NDBC NW Buoys",url:"https://www.ndbc.noaa.gov/maps/northwest_hist.shtml"}]).map(function(s,i){
                return (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily:"'DM Mono',monospace", fontSize:"11px", color:dark?"#6a9cc0":NAVY,
                      textDecoration:"none", padding:"4px 12px", background:bgCard,
                      border:"1px solid "+border, borderRadius:"20px" }}>
                    {s.label} ↗
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* DISCLAIMER */}
        <div style={{ padding:"16px 0", borderTop:"1px solid "+border }}>
          <p style={{ fontSize:"12px", color:textMid, lineHeight:"1.7", fontWeight:300 }}>
            Informational use only. This tool aggregates public NOAA/NWS data and does not replace on-the-water judgment or local knowledge. Puget Sound water is 45–55°F year-round — cold shock in under 1 minute, swimming failure within ~10 minutes even on warm days. Always dress for immersion. Assume you will flip.
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ text, textMid }) {
  return (
    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid, letterSpacing:".12em", marginBottom:"12px" }}>
      {text.toUpperCase()}
    </div>
  );
}

function Metric({ dark, bg, border, text, textMid, label, value, unit, sub, status, thresh }) {
  const [open, setOpen] = useState(false);
  const sc = SC[status]||SC.unknown;
  return (
    <div onClick={function(){ setOpen(function(o){ return !o; }); }}
      style={{ background:bg, border:"1px solid "+border, borderRadius:"8px", padding:"16px", cursor:"pointer", position:"relative" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px" }}>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid, letterSpacing:".08em" }}>
          {label.toUpperCase()}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
          <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:sc, boxShadow:"0 0 0 3px "+sc+"30" }} />
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:sc }}>{SL[status]||"—"}</span>
        </div>
      </div>
      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"28px", fontWeight:500, color:text, lineHeight:1, marginBottom:"4px" }}>
        {value}<span style={{ fontSize:"13px", color:textMid, fontWeight:300, marginLeft:"3px" }}>{unit}</span>
      </div>
      {sub&&<div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid }}>{sub}</div>}
      {open&&thresh&&(
        <div style={{ marginTop:"10px", paddingTop:"10px", borderTop:"1px solid "+border,
          fontFamily:"'DM Sans',sans-serif", fontSize:"11px", color:textMid, lineHeight:"1.6" }}>
          {thresh}
        </div>
      )}
    </div>
  );
}

function CheckRow({ dark, border, text, textMid, status, label, detail, manual, checked, onToggle, last, verifyKey, verified, onVerify, sourceUrl }) {
  const sc = SC[status]||SC.unknown;
  // For auto rows: show verified state instead of raw status if verified
  const effectiveStatus = (!manual && verified) ? "green" : status;
  const esc = SC[effectiveStatus]||SC.unknown;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:"14px", padding:"12px 16px",
      borderBottom:last?"none":"1px solid "+border,
      background:(status==="red"||status==="orange")?(dark?"#1e1008":"#fffaf9"):"transparent" }}>

      {/* Status circle */}
      <div style={{ width:"20px", height:"20px", borderRadius:"50%", border:"1.5px solid "+esc,
        background:effectiveStatus==="unknown"?"transparent":esc+"20", flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:"11px", color:esc, fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>
        {effectiveStatus==="green"?"✓":effectiveStatus==="red"||effectiveStatus==="orange"?"✕":effectiveStatus==="yellow"?"!":"·"}
      </div>

      {/* Label + detail */}
      <div style={{ flex:1 }}>
        <div style={{ fontSize:"14px", fontWeight:500, color:text, display:"flex", alignItems:"center", gap:"8px" }}>
          {label}
          {manual&&(
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:textMid,
              background:dark?"#1a2b4a":"#f0f4f8", padding:"1px 6px", borderRadius:"3px", letterSpacing:".06em" }}>
              MANUAL
            </span>
          )}
        </div>
        {detail&&(
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"11px", color:textMid, marginTop:"2px" }}>
            {detail}
          </div>
        )}
      </div>

      {/* AUTO ROW: source link + verify button */}
      {!manual&&(
        <div style={{ display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
          {sourceUrl&&(
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
              title="Open source to verify"
              style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid,
                textDecoration:"none", padding:"4px 8px", border:"1px solid "+border,
                borderRadius:"4px", lineHeight:1, whiteSpace:"nowrap" }}>
              ↗ Source
            </a>
          )}
          <button onClick={function(){ onVerify(verifyKey); }}
            style={{
              background: verified ? SC.green : "transparent",
              border: "1px solid " + (verified ? SC.green : border),
              borderRadius:"4px", color: verified ? WHITE : textMid,
              padding:"4px 10px", fontFamily:"'DM Mono',monospace",
              fontSize:"10px", cursor:"pointer", whiteSpace:"nowrap", lineHeight:1,
              letterSpacing:".04em",
            }}>
            {verified ? "✓ Verified" : "Verify"}
          </button>
        </div>
      )}

      {/* MANUAL ROW: confirm button */}
      {manual&&(
        <button onClick={onToggle} style={{
          background:checked?NAVY:"transparent", border:"1px solid "+(checked?NAVY:border),
          borderRadius:"5px", color:checked?WHITE:textMid,
          padding:"5px 14px", fontFamily:"'DM Sans',sans-serif",
          fontSize:"12px", fontWeight:500, cursor:"pointer", flexShrink:0,
        }}>
          {checked?"✓ Done":"Confirm"}
        </button>
      )}
    </div>
  );
}
