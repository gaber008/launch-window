import React, { useState, useEffect, useCallback } from "react";

// ─── Locations ────────────────────────────────────────────────────────────────
// tideStation   : NOAA CO-OPS verified station IDs
// currentStation: Only PUG1515 (Tacoma Narrows) is confirmed valid for Puget Sound
// cwfZone       : NWS Coastal Waters Forecast zone — PZZ135 = Puget Sound & Hood Canal
//                 PZZ134 = Admiralty Inlet (Edmonds)
const LOCATIONS = [
  { id:0, name:"Titlow Beach",         region:"Tacoma",        lat:47.2489, lon:-122.5525, tideStation:"9446484", currentStation:"PUG1515", cwfZone:"PZZ135" },
  { id:1, name:"Owen Beach",           region:"Pt Defiance",   lat:47.2985, lon:-122.5409, tideStation:"9446484", currentStation:"PUG1515", cwfZone:"PZZ135" },
  { id:2, name:"Dash Point",           region:"Federal Way",   lat:47.3087, lon:-122.4078, tideStation:"9446484", currentStation:null,      cwfZone:"PZZ135" },
  { id:3, name:"Saltwater State Park", region:"Des Moines",    lat:47.3654, lon:-122.3237, tideStation:"9447130", currentStation:null,      cwfZone:"PZZ135" },
  { id:4, name:"Shilshole Bay",        region:"Seattle",       lat:47.6877, lon:-122.4014, tideStation:"9447130", currentStation:null,      cwfZone:"PZZ135" },
  { id:5, name:"Edmonds Marina",       region:"Edmonds",       lat:47.8127, lon:-122.3891, tideStation:"9447130", currentStation:null,      cwfZone:"PZZ134" },
  { id:6, name:"Gig Harbor Ramp",      region:"Gig Harbor",    lat:47.3327, lon:-122.5797, tideStation:"9446484", currentStation:"PUG1515", cwfZone:"PZZ135" },
  { id:7, name:"Joemma Beach",         region:"Key Peninsula", lat:47.2480, lon:-122.7580, tideStation:"9446484", currentStation:null,      cwfZone:"PZZ135" },
  { id:8, name:"Anderson Island",      region:"Anderson Is.",  lat:47.1560, lon:-122.6860, tideStation:"9446484", currentStation:null,      cwfZone:"PZZ135" },
];

const MPH_TO_KT = 0.868976;
const todayStr  = new Date().toISOString().split("T")[0];

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK = {
  windKt:7.2, gustKt:null, windDir:"S", fc:"Rain", temp:52, tempU:"F",
  waveHt:1.5, wavePd:null, waveText:"Waves around 2 ft or less", waveZone:"PZZ135",
  scaAlerts:[],
  tides:[
    {t:"2026-03-06 00:13",v:"2.8",type:"L"},
    {t:"2026-03-06 06:24",v:"11.7",type:"H"},
    {t:"2026-03-06 12:53",v:"1.4",type:"L"},
    {t:"2026-03-06 19:11",v:"10.0",type:"H"},
  ],
  currKt:0.6, currAvail:true,
  ws:"yellow", gs:"green", wvs:"yellow", cs:"green", adv:"green", vis:"green",
  verdict:"yellow", isMock:true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseMph(str) {
  if (!str) return null;
  const m = str.match(/(\d+)(?:\s+to\s+(\d+))?\s*mph/i);
  if (!m) return null;
  const v = m[2] ? (parseInt(m[1])+parseInt(m[2]))/2 : parseInt(m[1]);
  return Math.round(v * MPH_TO_KT * 10) / 10;
}

// Parse wave height from CWF forecast text section
// Handles: "Waves around 2 ft or less", "Waves 3 to 5 ft", "Seas 6 to 7 ft"
function parseWavesFromCWF(sectionText, targetDate, targetHour) {
  if (!sectionText) return { ht: null, pd: null, raw: null };
  // Map target time to a period label
  const now = new Date();
  const target = new Date(targetDate + "T" + String(targetHour).padStart(2,"0") + ":00:00");
  const todayMidnight = new Date(now.toISOString().split("T")[0] + "T00:00:00");
  const diffDays = Math.floor((target - todayMidnight) / 86400000);
  const isNight = targetHour >= 18 || targetHour < 6;
  const dayNames = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  let label;
  if (diffDays === 0) {
    label = isNight ? ".TONIGHT" : ".TODAY";
  } else {
    const d = new Date(todayMidnight);
    d.setDate(d.getDate() + diffDays);
    const dn = dayNames[d.getDay()];
    label = isNight ? ("." + dn + " NIGHT") : ("." + dn);
  }
  // Find the period block — look for label in text, grab until next period
  const idx = sectionText.indexOf(label);
  let block = "";
  if (idx > -1) {
    const nextPeriod = sectionText.slice(idx+1).search(/\.[A-Z]{2,}/);
    block = nextPeriod > -1
      ? sectionText.slice(idx, idx + 1 + nextPeriod)
      : sectionText.slice(idx, idx + 300);
  } else {
    // Fallback: use first period after zone header
    const firstPeriod = sectionText.search(/\.[A-Z]{2,}/);
    block = firstPeriod > -1 ? sectionText.slice(firstPeriod, firstPeriod + 300) : sectionText;
  }
  // Parse wave height
  const htMatch = block.match(/(?:waves?|seas?)\s+(?:around\s+)?(\d+(?:\.\d+)?)\s*(?:to\s+(\d+(?:\.\d+)?)\s*)?(?:ft|feet)(?:\s+or\s+less)?/i);
  if (!htMatch) return { ht: null, pd: null, raw: block.slice(0,120) };
  const ht = htMatch[2]
    ? (parseFloat(htMatch[1]) + parseFloat(htMatch[2])) / 2
    : htMatch[0].toLowerCase().includes("or less") ? parseFloat(htMatch[1]) * 0.75 : parseFloat(htMatch[1]);
  // Parse period
  const pdMatch = block.match(/(\d+)\s*(?:second|sec)\s*period|at\s+(\d+)\s*sec/i);
  const pd = pdMatch ? parseInt(pdMatch[1] || pdMatch[2]) : null;
  return { ht: Math.round(ht * 10) / 10, pd, raw: htMatch[0] };
}

function wStatus(kt)    { return kt==null?"unknown":kt<=8?"green":kt<=12?"yellow":kt<=15?"orange":"red"; }
function gStatus(kt)    { return kt==null?"green":kt<=12?"green":kt<=15?"yellow":"red"; }
function wvStatus(ft)   { if(ft==null)return"unknown";if(ft<=1)return"green";if(ft<=2)return"yellow";return"red"; }
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

// Format time string "HH:MM" from tide time "YYYY-MM-DD HH:MM"
function fmtTime(t) { return t ? t.split(" ")[1] : ""; }

// Salmon window: 1hr before and after a tide transition time
function salmonWindows(tides) {
  return tides.map(function(t) {
    const [datePart, timePart] = t.t.split(" ");
    const [h, m] = timePart.split(":").map(Number);
    const base = new Date(datePart + "T" + timePart + ":00");
    const before = new Date(base.getTime() - 60*60*1000);
    const after  = new Date(base.getTime() + 60*60*1000);
    const fmt = function(d) {
      return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
    };
    return { type: t.type, peak: timePart, start: fmt(before), end: fmt(after) };
  });
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const NAVY  = "#1a2b4a";
const NAVY2 = "#243558";
const WHITE = "#ffffff";
const OFF   = "#f7f8fa";
const BORDER= "#e2e7ee";
const MUTED = "#7a8ca0";
const SC = { green:"#00875a", yellow:"#c48a00", orange:"#c45a00", red:"#c8322a", unknown:"#b0bac6" };
const SL = { green:"Go", yellow:"Caution", orange:"Marginal", red:"No Go", unknown:"—" };
const SALMON = "#e07b39";

function KayakLogo({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
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

// ─── App ──────────────────────────────────────────────────────────────────────
export default function LaunchWindow() {
  const [dark,     setDark]    = useState(false);
  const [locId,    setLocId]   = useState(4); // Default: Shilshole Bay, Seattle
  const [date,     setDate]    = useState(todayStr);
  const [hour,     setHour]    = useState(new Date().getHours());
  const [cond,     setCond]    = useState(null);
  const [loading,  setLoading] = useState(false);
  const [sources,  setSources] = useState([]);
  const [manual,   setManual]  = useState({ gear:true, floatPlan:false, shore:false });
  const [verified, setVerified]= useState({ wind:false, gusts:false, waves:false, current:false, advisories:false, visibility:false });

  const loc = LOCATIONS[locId];
  const bg      = dark ? NAVY   : WHITE;
  const bgCard  = dark ? NAVY2  : OFF;
  const border  = dark ? "#2e4268" : BORDER;
  const text    = dark ? "#e8edf4" : NAVY;
  const textMid = dark ? "#8faabb" : MUTED;

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
      ".a0{animation:up .5s ease both}.a1{animation:up .5s .08s ease both}",
      ".a2{animation:up .5s .16s ease both}.a3{animation:up .5s .24s ease both}",
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
      // ── 1. NWS Hourly Forecast (wind speed + direction + visibility) ─────────
      // windGust is present only when gusts are forecast; absent = calm/no gusts
      const nwsPageUrl = "https://forecast.weather.gov/MapClick.php?lat=" + loc.lat + "&lon=" + loc.lon;
      const ptRes = await fetch(
        "https://api.weather.gov/points/" + loc.lat + "," + loc.lon,
        { headers:{"User-Agent":"LaunchWindow/3.0 (puget-sound-kayak-safety)"} }
      );
      if (!ptRes.ok) throw new Error("NWS points " + ptRes.status);
      const pt = await ptRes.json();
      const fhUrl = pt.properties.forecastHourly;

      const fRes = await fetch(fhUrl, { headers:{"User-Agent":"LaunchWindow/3.0"} });
      if (!fRes.ok) throw new Error("NWS hourly " + fRes.status);
      const fData = await fRes.json();
      const periods = fData.properties.periods;
      const target  = new Date(date + "T" + String(hour).padStart(2,"0") + ":00:00");
      const period  = periods.find(function(p){ return new Date(p.startTime)<=target && new Date(p.endTime)>target; }) || periods[0];

      const windKt  = parseMph(period.windSpeed);
      // windGust field absent = no gusts forecast
      const gustKt  = period.windGust ? parseMph(period.windGust) : null;
      const windDir = period.windDirection || "—";
      const fc      = period.shortForecast || "";
      const temp    = period.temperature;
      const tempU   = period.temperatureUnit;

      src.push({ label:"NWS Hourly Forecast", url:nwsPageUrl, metric:"wind · visibility" });

      // ── 2. NWS Coastal Waters Forecast text (waves) ──────────────────────────
      // CWF from Seattle NWS office — PZZ135 = Puget Sound & Hood Canal
      // PZZ134 = Admiralty Inlet (Edmonds)
      const cwfPageUrl = "https://marine.weather.gov/MapClick.php?zoneid=" + loc.cwfZone;
      let waveHt = null, wavePd = null, waveText = null;
      try {
        const cwfListRes = await fetch(
          "https://api.weather.gov/products/types/CWF/locations/SEW",
          { headers:{"User-Agent":"LaunchWindow/3.0"} }
        );
        if (cwfListRes.ok) {
          const cwfList = await cwfListRes.json();
          const latestId = cwfList["@graph"][0].id;
          const cwfRes = await fetch(
            "https://api.weather.gov/products/" + latestId,
            { headers:{"User-Agent":"LaunchWindow/3.0"} }
          );
          if (cwfRes.ok) {
            const cwfData = await cwfRes.json();
            const fullText = cwfData.productText || "";
            // Extract just the zone section
            const zoneIdx = fullText.indexOf(loc.cwfZone);
            if (zoneIdx > -1) {
              // Find next zone or end
              const nextZone = fullText.slice(zoneIdx + 6).search(/PZZ\d{3}/);
              const section = nextZone > -1
                ? fullText.slice(zoneIdx, zoneIdx + 6 + nextZone)
                : fullText.slice(zoneIdx, zoneIdx + 1000);
              const parsed = parseWavesFromCWF(section, date, hour);
              waveHt   = parsed.ht;
              wavePd   = parsed.pd;
              waveText = parsed.raw;
            }
          }
        }
        src.push({ label:"NWS CWF · " + loc.cwfZone + " (Puget Sound)", url:cwfPageUrl, metric:"waves" });
      } catch(e) {}

      // ── 3. NWS Active Alerts ─────────────────────────────────────────────────
      let scaAlerts = [];
      try {
        const alRes = await fetch(
          "https://api.weather.gov/alerts/active?point=" + loc.lat + "," + loc.lon,
          { headers:{"User-Agent":"LaunchWindow/3.0"} }
        );
        if (alRes.ok) {
          const al = await alRes.json();
          scaAlerts = (al.features||[]).filter(function(f){
            const ev=((f.properties&&f.properties.event)||"").toLowerCase();
            return ev.includes("small craft")||ev.includes("gale")||ev.includes("storm warning")||ev.includes("marine");
          }).map(function(f){ return f.properties.event; });
        }
        src.push({ label:"NWS Marine Alerts", url:"https://alerts.weather.gov/", metric:"advisories" });
      } catch(e) {}

      // ── 4. NOAA Tides ────────────────────────────────────────────────────────
      // Timezone: lst_ldt = Local Standard Time with Daylight Saving (correct for Pacific)
      const td = date.replace(/-/g,"");
      const tidePageUrl = "https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=" + loc.tideStation;
      let tides = [];
      try {
        const tRes = await fetch(
          "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
          "?product=predictions&datum=MLLW&station=" + loc.tideStation +
          "&begin_date=" + td + "&end_date=" + td +
          "&time_zone=lst_ldt&interval=hilo&units=english&application=LaunchWindow&format=json"
        );
        const tData = await tRes.json();
        tides = tData.predictions || [];
        src.push({ label:"NOAA Tide Predictions (" + loc.tideStation + ")", url:tidePageUrl, metric:"tides" });
      } catch(e) {}

      // ── 5. NOAA Currents ─────────────────────────────────────────────────────
      // Only PUG1515 (Tacoma Narrows) is a confirmed CO-OPS current prediction station
      // All other Puget Sound locations: direct user to NOAA Currents map
      const currMapUrl = "https://tidesandcurrents.noaa.gov/noaacurrents/";
      let currKt = null, currAvail = false;
      if (loc.currentStation) {
        try {
          const cRes = await fetch(
            "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
            "?product=currents_predictions&station=" + loc.currentStation +
            "&begin_date=" + td + "&end_date=" + td +
            "&interval=h&units=english&time_zone=lst_ldt&application=LaunchWindow&format=json"
          );
          const cData = await cRes.json();
          const preds = (cData.current_predictions && cData.current_predictions.cp) || [];
          const cT = date + " " + String(hour).padStart(2,"0") + ":00";
          const cl = preds.find(function(p){ return p.Time && p.Time.startsWith(cT.slice(0,13)); }) || preds[0];
          if (cl && cl.Velocity_Major) {
            currKt = Math.abs(parseFloat(cl.Velocity_Major));
            currAvail = true;
          }
          src.push({ label:"NOAA Currents · PUG1515 (Tacoma Narrows)", url:"https://tidesandcurrents.noaa.gov/noaacurrents/PUG1515", metric:"current" });
        } catch(e) {}
      } else {
        src.push({ label:"NOAA Currents Map (verify manually)", url:currMapUrl, metric:"current" });
      }

      const _ws=wStatus(windKt), _gs=gStatus(gustKt), _wvs=wvStatus(waveHt);
      const _cs=cStatus(currKt), adv=scaAlerts.length>0?"red":"green", _vis=visStatus(fc);

      setCond({
        windKt, gustKt, windDir, fc, temp, tempU,
        waveHt, wavePd, waveText,
        scaAlerts, tides, currKt, currAvail,
        ws:_ws, gs:_gs, wvs:_wvs, cs:_cs, adv, vis:_vis,
        verdict:overallVerdict([_ws,_gs,_wvs,adv,_vis,_cs]),
        sourceWind:   nwsPageUrl,
        sourceGusts:  nwsPageUrl,
        sourceWaves:  cwfPageUrl,
        sourceCurrent:loc.currentStation
          ? "https://tidesandcurrents.noaa.gov/noaacurrents/" + loc.currentStation
          : currMapUrl,
        sourceAlerts: "https://alerts.weather.gov/",
        sourceVis:    nwsPageUrl,
      });
      setSources(src);
    } catch(err) {
      setCond(Object.assign({}, MOCK, {
        sourceWind:   "https://forecast.weather.gov",
        sourceGusts:  "https://forecast.weather.gov",
        sourceWaves:  "https://marine.weather.gov/MapClick.php?zoneid=" + loc.cwfZone,
        sourceCurrent:"https://tidesandcurrents.noaa.gov/noaacurrents/",
        sourceAlerts: "https://alerts.weather.gov/",
        sourceVis:    "https://forecast.weather.gov",
      }));
      setSources([
        {label:"NWS Forecast",              url:"https://forecast.weather.gov",      metric:"wind · visibility"},
        {label:"NWS CWF (Puget Sound)",     url:"https://marine.weather.gov",        metric:"waves"},
        {label:"NOAA Tide Predictions",     url:"https://tidesandcurrents.noaa.gov", metric:"tides"},
        {label:"NOAA Currents Map",         url:"https://tidesandcurrents.noaa.gov/noaacurrents/", metric:"current"},
        {label:"NWS Marine Alerts",         url:"https://alerts.weather.gov/",       metric:"advisories"},
      ]);
    }
    setLoading(false);
  }, [loc, date, hour]);

  useEffect(function(){ check(); }, []);

  const c   = cond;
  const v   = (c&&c.verdict)||"unknown";
  const vc  = SC[v];
  const allManual   = manual.gear && manual.floatPlan && manual.shore;
  const allVerified = verified.wind && verified.gusts && verified.waves && verified.current && verified.advisories && verified.visibility;
  const allGo       = v==="green" && allManual && allVerified;
  const totalChecked = Object.values(verified).filter(Boolean).length + Object.values(manual).filter(Boolean).length;

  function toggleVerified(key) { setVerified(function(p){ return Object.assign({},p,{[key]:!p[key]}); }); }
  function toggleManual(key)   { setManual(function(p){ return Object.assign({},p,{[key]:!p[key]}); }); }

  const selStyle = {
    background:"transparent", border:"1px solid "+border, borderRadius:"6px",
    color:text, padding:"9px 12px", fontFamily:"'DM Sans',sans-serif",
    fontSize:"14px", cursor:"pointer", outline:"none", width:"100%", height:"42px", appearance:"none",
  };

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

        {/* CONTROLS — wrap on narrow screens */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:"10px", marginBottom:"32px", alignItems:"flex-end" }}>
          <div style={{ flex:"2 1 200px" }}>
            <label style={{ display:"block", fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid, letterSpacing:".1em", marginBottom:"6px" }}>LAUNCH SITE</label>
            <div style={{ position:"relative" }}>
              <select value={locId} onChange={function(e){ setLocId(+e.target.value); }} style={selStyle}>
                {LOCATIONS.map(function(l){ return <option key={l.id} value={l.id}>{l.name} — {l.region}</option>; })}
              </select>
              <span style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", color:textMid, pointerEvents:"none", fontSize:"11px" }}>▾</span>
            </div>
          </div>
          <div style={{ flex:"1 1 120px" }}>
            <label style={{ display:"block", fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid, letterSpacing:".1em", marginBottom:"6px" }}>DATE</label>
            <input type="date" value={date} onChange={function(e){ setDate(e.target.value); }}
              min={todayStr} max={new Date(Date.now()+7*864e5).toISOString().split("T")[0]}
              style={Object.assign({},selStyle,{colorScheme:dark?"dark":"light"})} />
          </div>
          <div style={{ flex:"1 1 120px" }}>
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
          <div style={{ flex:"0 0 auto" }}>
            <button onClick={check} disabled={loading} style={{
              background:loading?bgCard:NAVY, border:"1px solid "+(loading?border:NAVY),
              borderRadius:"6px", color:loading?textMid:WHITE,
              padding:"0 22px", fontFamily:"'DM Sans',sans-serif", fontWeight:500,
              fontSize:"14px", cursor:loading?"not-allowed":"pointer", height:"42px", whiteSpace:"nowrap",
            }}>
              {loading?"Checking…":"Check"}
            </button>
          </div>
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
              {c&&(
                <div style={{ textAlign:"center", padding:"10px 16px", background:dark?"#1a2b4a":WHITE,
                  borderRadius:"8px", border:"1px solid "+border, flexShrink:0, minWidth:"90px" }}>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:textMid, letterSpacing:".1em", marginBottom:"6px" }}>CHECKLIST</div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"22px", fontWeight:500, color:text, lineHeight:1 }}>
                    {totalChecked}<span style={{ fontSize:"13px", color:textMid, fontWeight:300 }}>/9</span>
                  </div>
                  <div style={{ marginTop:"6px", height:"3px", background:border, borderRadius:"2px", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:(totalChecked/9*100)+"%",
                      background:totalChecked===9?SC.green:totalChecked>5?SC.yellow:SC.orange,
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
                source="NWS hourly JSON · windSpeed field (structured)"
                thresh="0–8: Ideal · 8–12: OK · 12–15: Marginal · 15+: No Go" />
              <Metric dark={dark} bg={bgCard} border={border} text={text} textMid={textMid}
                label="Gusts" value={c.gustKt!=null?c.gustKt.toFixed(1):"—"} unit="kt"
                sub={c.gustKt==null?"none forecast":null} status={c.gs}
                source="NWS hourly JSON · windGust field (absent = no gusts forecast)"
                thresh="≤12: OK · ≤15: Caution · 15+: No Go" />
              <Metric dark={dark} bg={bgCard} border={border} text={text} textMid={textMid}
                label="Waves" value={c.waveHt!=null?c.waveHt.toFixed(1):"—"} unit="ft"
                sub={c.waveText||"check NWS marine forecast"} status={c.wvs}
                source={"NWS CWF text · " + loc.cwfZone + " (Puget Sound & Hood Canal) — verify manually"}
                thresh="≤1 ft: Easy · 1–2 ft: Caution · 2+ ft: No Go" />
              <Metric dark={dark} bg={bgCard} border={border} text={text} textMid={textMid}
                label="Current" value={c.currKt!=null?c.currKt.toFixed(2):"—"} unit="kt"
                sub={!c.currAvail?"no API station here — check NOAA map ↗":null} status={c.cs}
                source={loc.currentStation
                  ? "NOAA CO-OPS · PUG1515 (Tacoma Narrows) — nearest verified station"
                  : "No verified CO-OPS current station near this site — check NOAA Currents map manually"}
                thresh="<1 kt: Fine · 1–2 kt: Plan carefully · 2+: No Go" />
              <Metric dark={dark} bg={bgCard} border={border} text={text} textMid={textMid}
                label="Advisories" value={c.scaAlerts&&c.scaAlerts.length?"Active":"Clear"} unit=""
                sub={(c.scaAlerts&&c.scaAlerts[0])||"No marine advisories"} status={c.adv}
                source="NWS alerts API · active alerts for this lat/lon"
                thresh="Any Small Craft / Gale / Storm Warning = No Go" />
              <Metric dark={dark} bg={bgCard} border={border} text={text} textMid={textMid}
                label="Visibility" value={c.vis==="green"?"Good":c.vis==="yellow"?"Limited":"Poor"} unit=""
                sub={c.fc||null} status={c.vis}
                source="NWS hourly · shortForecast text field — fog/mist/haze keywords"
                thresh="Clear: OK · Fog/Mist: Caution · Dense Fog: No Go" />
            </div>
          </div>
        )}

        {/* TIDES + SALMON WINDOWS */}
        {c&&c.tides&&c.tides.length>0&&(
          <div className="a2" style={{ marginBottom:"28px" }}>
            <SectionLabel text={"Tides · "+new Date(date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} textMid={textMid} />
            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", marginBottom:"12px" }}>
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
                      {fmtTime(t.t)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Salmon windows — 1hr before/after each transition */}
            <div style={{ background:bgCard, border:"1px solid "+border, borderRadius:"8px", padding:"14px 18px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                <span style={{ fontSize:"14px" }}>🐟</span>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:SALMON, letterSpacing:".1em" }}>
                  SALMON WINDOWS
                </div>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid }}>
                  · 1 hr before & after each tidal transition
                </div>
              </div>
              <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                {salmonWindows(c.tides).map(function(w,i){
                  return (
                    <div key={i} style={{ padding:"8px 14px", background:SALMON+"18",
                      border:"1px solid "+SALMON+"44", borderRadius:"6px", textAlign:"center" }}>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:SALMON, letterSpacing:".1em", marginBottom:"4px" }}>
                        {w.type==="H"?"HIGH":"LOW"} · {w.peak}
                      </div>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"14px", fontWeight:500, color:text }}>
                        {w.start} – {w.end}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* CHECKLIST */}
        {c&&(
          <div className="a2" style={{ marginBottom:"28px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid, letterSpacing:".12em" }}>PRE-LAUNCH CHECKLIST</div>
              {allVerified&&(
                <button onClick={resetVerified} style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid,
                  background:"none", border:"none", cursor:"pointer", letterSpacing:".06em" }}>
                  Reset verifications
                </button>
              )}
            </div>
            <div style={{ background:bgCard, border:"1px solid "+border, borderRadius:"8px", overflow:"hidden" }}>
              <CheckRow dark={dark} border={border} text={text} textMid={textMid}
                status={c.ws} verifyKey="wind" verified={verified.wind} onVerify={toggleVerified}
                label="Wind ≤ 12 kt"
                detail={c.windKt!=null?c.windKt.toFixed(1)+" kt from "+c.windDir:"data unavailable"}
                sourceUrl={c.sourceWind} />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid}
                status={c.gs} verifyKey="gusts" verified={verified.gusts} onVerify={toggleVerified}
                label="Gusts ≤ 15 kt"
                detail={c.gustKt!=null?c.gustKt.toFixed(1)+" kt":"none forecast"}
                sourceUrl={c.sourceGusts} />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid}
                status={c.wvs} verifyKey="waves" verified={verified.waves} onVerify={toggleVerified}
                label="Waves ≤ 2 ft"
                detail={c.waveText?c.waveText:(c.waveHt!=null?c.waveHt.toFixed(1)+" ft":"verify NWS CWF · "+loc.cwfZone+" ↗")}
                sourceUrl={c.sourceWaves} />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid}
                status={c.cs} verifyKey="current" verified={verified.current} onVerify={toggleVerified}
                label="Current ≤ 1 kt"
                detail={c.currAvail?c.currKt.toFixed(2)+" kt (PUG1515 · Tacoma Narrows)":"no API station — verify on NOAA map ↗"}
                sourceUrl={c.sourceCurrent} />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid}
                status={c.adv} verifyKey="advisories" verified={verified.advisories} onVerify={toggleVerified}
                label="No small craft advisory"
                detail={c.scaAlerts&&c.scaAlerts.length?c.scaAlerts.join(", "):"None active"}
                sourceUrl={c.sourceAlerts} />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid}
                status={c.vis} verifyKey="visibility" verified={verified.visibility} onVerify={toggleVerified}
                label="Visibility good, no fog"
                detail={c.fc||"—"}
                sourceUrl={c.sourceVis} />

              <div style={{ padding:"8px 16px", background:dark?"#1a2b4a30":"#f0f4f8",
                borderTop:"1px solid "+border, borderBottom:"1px solid "+border }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:textMid, letterSpacing:".12em" }}>MANUAL CHECKS</span>
              </div>
              <CheckRow dark={dark} border={border} text={text} textMid={textMid} manual
                status={manual.gear?"green":"unknown"} label="Dry suit on"
                detail="Cold shock < 1 min. Swimming failure < 10 min. Dress for immersion."
                checked={manual.gear} onToggle={function(){ toggleManual("gear"); }} />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid} manual
                status={manual.floatPlan?"green":"unknown"} label="Float plan shared"
                detail="Someone ashore knows where you're going and when you'll be back."
                checked={manual.floatPlan} onToggle={function(){ toggleManual("floatPlan"); }} />
              <CheckRow dark={dark} border={border} text={text} textMid={textMid} manual last
                status={manual.shore?"green":"unknown"} label="Route stays close to shore"
                detail="Narrows can run 3+ kt at exchange — plan accordingly."
                checked={manual.shore} onToggle={function(){ toggleManual("shore"); }} />
            </div>
            <div style={{ marginTop:"10px", padding:"14px 18px",
              background:allGo?SC.green+"18":v==="red"?SC.red+"12":bgCard,
              border:"1px solid "+(allGo?SC.green+"44":v==="red"?SC.red+"44":border),
              borderRadius:"8px", display:"flex", alignItems:"center", gap:"12px" }}>
              <div style={{ width:"8px", height:"8px", borderRadius:"50%", flexShrink:0,
                background:allGo?SC.green:v==="red"||v==="orange"?SC.red:SC.yellow }} />
              <div style={{ fontSize:"14px", color:text }}>
                {allGo?"All checks clear. Conditions look good — paddle safe."
                  :v==="red"||v==="orange"?"Conditions outside safe limits. Strongly reconsider launching today."
                  :!allVerified?"Open each ↗ Source link and verify data before heading out."
                  :!allManual?"Complete the manual checks above before heading out."
                  :"Marginal conditions — short trip, stay close to shore."}
              </div>
            </div>
          </div>
        )}

        {/* SOURCES */}
        {sources.length>0&&(
          <div className="a3" style={{ borderTop:"1px solid "+border, paddingTop:"20px", marginBottom:"24px" }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid, letterSpacing:".1em", marginBottom:"10px" }}>DATA SOURCES</div>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
              {sources.concat([
                {label:"NDBC NW Buoys", url:"https://www.ndbc.noaa.gov/maps/northwest_hist.shtml"},
                {label:"NOAA Currents Map", url:"https://tidesandcurrents.noaa.gov/noaacurrents/"},
              ]).map(function(s,i){
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
            Informational use only. Wind/gusts from NWS hourly forecast JSON fields (structured). Waves parsed from NWS Coastal Waters Forecast zone {loc.cwfZone} (Puget Sound & Hood Canal) — always verify at the ↗ Source link. Tides from NOAA CO-OPS (station {loc.tideStation}, timezone lst_ldt). Current predictions only available via API at Tacoma Narrows (PUG1515) — other sites require manual check. Puget Sound water is 45–55°F year-round. Cold shock in &lt;1 minute. Always dress for immersion.
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

function Metric({ dark, bg, border, text, textMid, label, value, unit, sub, status, thresh, source }) {
  const [open, setOpen] = useState(false);
  const sc = SC[status]||SC.unknown;
  return (
    <div onClick={function(){ setOpen(function(o){ return !o; }); }}
      style={{ background:bg, border:"1px solid "+border, borderRadius:"8px", padding:"16px", cursor:"pointer" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px" }}>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid, letterSpacing:".08em" }}>{label.toUpperCase()}</div>
        <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
          <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:sc, boxShadow:"0 0 0 3px "+sc+"30" }} />
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:sc }}>{SL[status]||"—"}</span>
        </div>
      </div>
      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"28px", fontWeight:500, color:text, lineHeight:1, marginBottom:"4px" }}>
        {value}<span style={{ fontSize:"13px", color:textMid, fontWeight:300, marginLeft:"3px" }}>{unit}</span>
      </div>
      {sub&&<div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid }}>{sub}</div>}
      {open&&(
        <div style={{ marginTop:"10px", paddingTop:"10px", borderTop:"1px solid "+border }}>
          {thresh&&<div style={{ fontSize:"11px", color:textMid, lineHeight:"1.6", marginBottom:"6px" }}>{thresh}</div>}
          {source&&<div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid, opacity:.7, lineHeight:"1.5" }}>Source: {source}</div>}
        </div>
      )}
    </div>
  );
}

function CheckRow({ dark, border, text, textMid, status, label, detail, manual, checked, onToggle, last, verifyKey, verified, onVerify, sourceUrl }) {
  const effectiveStatus = (!manual && verified) ? "green" : status;
  const sc = SC[effectiveStatus]||SC.unknown;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"14px", padding:"12px 16px",
      borderBottom:last?"none":"1px solid "+border,
      background:(status==="red"||status==="orange")?(dark?"#1e1008":"#fffaf9"):"transparent" }}>
      <div style={{ width:"20px", height:"20px", borderRadius:"50%", border:"1.5px solid "+sc,
        background:effectiveStatus==="unknown"?"transparent":sc+"20", flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:"11px", color:sc, fontWeight:600 }}>
        {effectiveStatus==="green"?"✓":effectiveStatus==="red"||effectiveStatus==="orange"?"✕":effectiveStatus==="yellow"?"!":"·"}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:"14px", fontWeight:500, color:text, display:"flex", alignItems:"center", gap:"8px" }}>
          {label}
          {manual&&(
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:textMid,
              background:dark?"#1a2b4a":"#f0f4f8", padding:"1px 6px", borderRadius:"3px", letterSpacing:".06em" }}>MANUAL</span>
          )}
        </div>
        {detail&&<div style={{ fontFamily:"'DM Mono',monospace", fontSize:"11px", color:textMid, marginTop:"2px" }}>{detail}</div>}
      </div>
      {!manual&&(
        <div style={{ display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
          {sourceUrl&&(
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:textMid,
                textDecoration:"none", padding:"4px 8px", border:"1px solid "+border,
                borderRadius:"4px", lineHeight:1, whiteSpace:"nowrap" }}>↗ Source</a>
          )}
          <button onClick={function(){ onVerify(verifyKey); }} style={{
            background:verified?SC.green:"transparent",
            border:"1px solid "+(verified?SC.green:border),
            borderRadius:"4px", color:verified?WHITE:textMid,
            padding:"4px 10px", fontFamily:"'DM Mono',monospace",
            fontSize:"10px", cursor:"pointer", whiteSpace:"nowrap", lineHeight:1, letterSpacing:".04em",
          }}>
            {verified?"✓ Verified":"Verify"}
          </button>
        </div>
      )}
      {manual&&(
        <button onClick={onToggle} style={{
          background:checked?NAVY:"transparent", border:"1px solid "+(checked?NAVY:border),
          borderRadius:"5px", color:checked?WHITE:textMid,
          padding:"5px 14px", fontSize:"12px", fontWeight:500, cursor:"pointer", flexShrink:0,
        }}>
          {checked?"✓ Done":"Confirm"}
        </button>
      )}
    </div>
  );
}
