import React, { useState, useEffect, useCallback } from "react";

const LOCATIONS = [
  { id:0, name:"Titlow Beach, Tacoma",        lat:47.2489, lon:-122.5525, tideStation:"9446484", currentStation:"TAC0101" },
  { id:1, name:"Owen Beach / Pt Defiance",    lat:47.2985, lon:-122.5409, tideStation:"9446484", currentStation:"TAC0101" },
  { id:2, name:"Dash Point, Federal Way",     lat:47.3087, lon:-122.4078, tideStation:"9446484", currentStation:"TAC0101" },
  { id:3, name:"Saltwater SP, Des Moines",    lat:47.3654, lon:-122.3237, tideStation:"9447130", currentStation:"SEA0101" },
  { id:4, name:"Shilshole Bay, Seattle",      lat:47.6877, lon:-122.4014, tideStation:"9447130", currentStation:"SEA0101" },
  { id:5, name:"Edmonds Marina",              lat:47.8127, lon:-122.3891, tideStation:"9447130", currentStation:"PUG1515" },
  { id:6, name:"Gig Harbor Launch Ramp",      lat:47.3327, lon:-122.5797, tideStation:"9446484", currentStation:"TAC0101" },
  { id:7, name:"Joemma Beach, Key Peninsula", lat:47.2480, lon:-122.7580, tideStation:"9446484", currentStation:"TAC0101" },
  { id:8, name:"Anderson Island",             lat:47.1560, lon:-122.6860, tideStation:"9446484", currentStation:"TAC0101" },
];

const MPH_TO_KT = 0.868976;
const todayStr = new Date().toISOString().split("T")[0];

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
  const val = m[2] ? (parseInt(m[1]) + parseInt(m[2])) / 2 : parseInt(m[1]);
  return Math.round(val * MPH_TO_KT * 10) / 10;
}

function wStatus(kt)  { return kt == null ? "unknown" : kt <= 8 ? "green" : kt <= 12 ? "yellow" : kt <= 15 ? "orange" : "red"; }
function gStatus(kt)  { return kt == null ? "green"   : kt <= 12 ? "green" : kt <= 15 ? "yellow" : "red"; }
function wvStatus(ft, p) {
  if (ft == null) return "unknown";
  if (ft <= 1) return "green";
  if (ft <= 2 && (!p || p >= 6)) return "yellow";
  if (ft >= 3 || (ft >= 2 && p < 5)) return "red";
  return "yellow";
}
function cStatus(kt)  { return kt == null ? "unknown" : kt < 1 ? "green" : kt < 2 ? "yellow" : "red"; }
function visStatus(d) {
  if (!d) return "unknown";
  const s = d.toLowerCase();
  if (s.includes("dense fog") || (s.includes("fog") && !s.includes("patchy"))) return "red";
  if (s.includes("fog") || s.includes("mist") || s.includes("haze")) return "yellow";
  return "green";
}
function overallVerdict(arr) {
  for (const p of ["red","orange","yellow","green"]) if (arr.includes(p)) return p;
  return "unknown";
}

const SC = { green:"#2d8a1a", yellow:"#c48a00", orange:"#c45a00", red:"#c43010", unknown:"#a08050" };
const SL = { green:"GO", yellow:"CAUTION", orange:"MARGINAL", red:"NO GO", unknown:"—" };
const SI = { green:"✓", yellow:"!", orange:"!", red:"✕", unknown:"·" };

const LT = {
  bg:"#f5efe0", bgCard:"#fdf8ee", bgAlt:"#efe5cc", border:"#c4a96a", borderF:"#c4a96a44",
  text:"#2a1a0e", textM:"#6b4c2a", textF:"#a08050", accent:"#c43010", green:"#2d5016",
  shadow:"rgba(42,26,14,.15)", inputBg:"#fdf8ee",
};
const DT = {
  bg:"#1a1208", bgCard:"#221a0a", bgAlt:"#2a2010", border:"#5a3e18", borderF:"#5a3e1833",
  text:"#f0e4c8", textM:"#c4a060", textF:"#7a5c30", accent:"#e05020", green:"#4a7a28",
  shadow:"rgba(0,0,0,.45)", inputBg:"#1e1408",
};

export default function LaunchWindow() {
  const [dark, setDark] = useState(false);
  const T = dark ? DT : LT;

  const [locId, setLocId] = useState(0);
  const [date, setDate]   = useState(todayStr);
  const [hour, setHour]   = useState(new Date().getHours());
  const [cond, setCond]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [manual, setManual]   = useState({ gear:true, floatPlan:false, shore:false });

  const loc = LOCATIONS[locId];

  useEffect(function() {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Rye&family=Special+Elite&family=Courier+Prime:wght@400;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = [
      "*{box-sizing:border-box;margin:0;padding:0}",
      "body{overflow-x:hidden}",
      "@keyframes spin{to{transform:rotate(360deg)}}",
      "@keyframes fi{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}",
      ".fi0{animation:fi .4s ease both}",
      ".fi1{animation:fi .4s .1s ease both}",
      ".fi2{animation:fi .4s .2s ease both}",
      ".fi3{animation:fi .4s .3s ease both}",
    ].join("");
    document.head.appendChild(style);
    return function() {
      try { document.head.removeChild(link); } catch(e) {}
      try { document.head.removeChild(style); } catch(e) {}
    };
  }, []);

  const check = useCallback(async function() {
    setLoading(true);
    setCond(null);
    setSources([]);
    const src = [];
    try {
      const ptRes = await fetch(
        "https://api.weather.gov/points/" + loc.lat + "," + loc.lon,
        { headers: { "User-Agent": "LaunchWindow/2.0" } }
      );
      if (!ptRes.ok) throw new Error("NWS " + ptRes.status);
      const pt = await ptRes.json();
      const fhUrl = pt.properties.forecastHourly;
      src.push({ label:"NWS Hourly Forecast", url:fhUrl });

      const fRes = await fetch(fhUrl, { headers: { "User-Agent": "LaunchWindow/2.0" } });
      if (!fRes.ok) throw new Error("Hourly unavailable");
      const fData = await fRes.json();
      const periods = fData.properties.periods;
      const target = new Date(date + "T" + String(hour).padStart(2,"0") + ":00:00");
      const period = periods.find(function(p) {
        return new Date(p.startTime) <= target && new Date(p.endTime) > target;
      }) || periods[0];

      const windKt  = parseMph(period.windSpeed);
      const gustKt  = period.windGust ? parseMph(period.windGust) : null;
      const windDir = period.windDirection || "—";
      const fc      = period.shortForecast || "";
      const detail  = period.detailedForecast || "";
      const temp    = period.temperature;
      const tempU   = period.temperatureUnit;

      let waveHt = null, wavePd = null;
      const wm = detail.match(/waves?\s+(\d+(?:\.\d+)?)\s*(?:to\s+(\d+(?:\.\d+)?)\s*)?(?:ft|feet)/i);
      if (wm) waveHt = wm[2] ? (parseFloat(wm[1]) + parseFloat(wm[2])) / 2 : parseFloat(wm[1]);
      const pm = detail.match(/(\d+)\s*(?:second|sec)\s*period/i);
      if (pm) wavePd = parseInt(pm[1]);

      let scaAlerts = [];
      try {
        const alRes = await fetch(
          "https://api.weather.gov/alerts/active?point=" + loc.lat + "," + loc.lon,
          { headers: { "User-Agent": "LaunchWindow/2.0" } }
        );
        if (alRes.ok) {
          const al = await alRes.json();
          scaAlerts = (al.features || []).filter(function(f) {
            const ev = (f.properties && f.properties.event || "").toLowerCase();
            return ev.includes("small craft") || ev.includes("gale") || ev.includes("storm warning") || ev.includes("marine");
          }).map(function(f) { return f.properties.event; });
          src.push({ label:"NWS Alerts", url:"https://alerts.weather.gov" });
        }
      } catch(e) {}

      const td = date.replace(/-/g,"");
      let tides = [];
      try {
        const tRes = await fetch(
          "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW&station=" +
          loc.tideStation + "&begin_date=" + td + "&end_date=" + td +
          "&time_zone=lst_lnt&interval=hilo&units=english&application=LaunchWindow&format=json"
        );
        const tData = await tRes.json();
        tides = tData.predictions || [];
        src.push({ label:"NOAA Tides", url:"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=" + loc.tideStation });
      } catch(e) {}

      let currKt = null;
      try {
        const cRes = await fetch(
          "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=currents_predictions&station=" +
          loc.currentStation + "&begin_date=" + td + "&end_date=" + td +
          "&interval=h&units=english&time_zone=lst_lnt&application=LaunchWindow&format=json"
        );
        const cData = await cRes.json();
        const preds = (cData.current_predictions && cData.current_predictions.cp) || [];
        const cTarget = date + " " + String(hour).padStart(2,"0") + ":00";
        const cl = preds.find(function(p) { return p.Time && p.Time.startsWith(cTarget.slice(0,13)); }) || preds[0];
        if (cl && cl.Velocity_Major) currKt = Math.abs(parseFloat(cl.Velocity_Major));
        src.push({ label:"NOAA Currents", url:"https://tidesandcurrents.noaa.gov/currents/overview/" + loc.currentStation });
      } catch(e) {}

      const _ws  = wStatus(windKt);
      const _gs  = gStatus(gustKt);
      const _wvs = wvStatus(waveHt, wavePd);
      const _cs  = cStatus(currKt);
      const adv  = scaAlerts.length > 0 ? "red" : "green";
      const _vis = visStatus(fc);
      const verdict = overallVerdict([_ws, _gs, _wvs, adv, _vis, _cs]);

      setCond({ windKt, gustKt, windDir, fc, temp, tempU, waveHt, wavePd, scaAlerts, tides, currKt,
        ws:_ws, gs:_gs, wvs:_wvs, cs:_cs, adv, vis:_vis, verdict });
      setSources(src);
    } catch(err) {
      setCond(MOCK);
      setSources([
        { label:"NWS Forecast",  url:"https://forecast.weather.gov" },
        { label:"NOAA Tides",    url:"https://tidesandcurrents.noaa.gov" },
        { label:"NOAA Currents", url:"https://tidesandcurrents.noaa.gov/currents.html" },
        { label:"NWS Alerts",    url:"https://alerts.weather.gov" },
      ]);
    }
    setLoading(false);
  }, [loc, date, hour]);

  useEffect(function() { check(); }, []);

  const c = cond;
  const v = (c && c.verdict) || "unknown";
  const vc = SC[v];
  const allManual = manual.gear && manual.floatPlan && manual.shore;
  const allGo = v === "green" && allManual;

  const inp = {
    width:"100%", background:T.inputBg, border:"1.5px solid " + T.border, borderRadius:"4px",
    color:T.text, padding:"8px 10px", fontFamily:"'Special Elite',serif",
    fontSize:"13px", cursor:"pointer", outline:"none", height:"40px",
  };

  return (
    <div style={{ fontFamily:"'Special Elite',serif", background:T.bg, minHeight:"100vh", color:T.text }}>

      {/* HEADER */}
      <div style={{ background:T.green, padding:"0 0 3px", textAlign:"center" }}>
        <div style={{ display:"flex", justifyContent:"space-between", padding:"7px 16px 0", opacity:.5 }}>
          <span style={{ color:"#fff", fontSize:"9px" }}>●</span>
          <span style={{ color:"#fff", fontSize:"9px" }}>●</span>
        </div>
        <div style={{ background:T.accent, padding:"10px 20px 8px", margin:"0 5px" }}>
          <div style={{ fontFamily:"'Alfa Slab One',serif", fontSize:"clamp(24px,6vw,44px)", color:"#fdf8ee",
            textShadow:"2px 2px 0 rgba(0,0,0,.35)", letterSpacing:".06em", lineHeight:1 }}>
            LAUNCH WINDOW
          </div>
          <div style={{ fontFamily:"'Rye',serif", fontSize:"11px", color:"#f0d9b0", letterSpacing:".2em", marginTop:"3px" }}>
            HOBIE OUTBACK · PUGET SOUND SAFETY CHECK
          </div>
        </div>
        <div style={{ padding:"6px 16px 8px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"10px", color:dark?"#a8c890":"#c8e8b0", fontStyle:"italic" }}>
            ❝ Best caught by those who check the weather first ❞
          </div>
          <button
            onClick={function() { setDark(function(d) { return !d; }); }}
            style={{ background:"none", border:"1px solid " + (dark ? "#4a7a28" : "#a8c890"),
              borderRadius:"20px", padding:"3px 12px", color:dark?"#b8d4a0":"#c8e8b0",
              fontSize:"11px", cursor:"pointer", fontFamily:"'Special Elite',serif", whiteSpace:"nowrap" }}>
            {dark ? "☀ Light" : "☽ Dark"}
          </button>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", padding:"0 16px 7px", opacity:.5 }}>
          <span style={{ color:"#fff", fontSize:"9px" }}>●</span>
          <span style={{ color:"#fff", fontSize:"9px" }}>●</span>
        </div>
      </div>

      <div style={{ textAlign:"center", padding:"8px 0 4px", color:T.green, fontSize:"16px", letterSpacing:"8px", opacity:.6 }}>
        ⊸ ∿∿∿ ⊷
      </div>

      <div style={{ maxWidth:"800px", margin:"0 auto", padding:"12px 18px 56px" }}>

        {/* CONTROLS */}
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr auto", gap:"10px", marginBottom:"20px", alignItems:"end" }}>
          <div>
            <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"10px", color:T.textF, letterSpacing:".14em", marginBottom:"5px" }}>LAUNCH SITE</div>
            <select value={locId} onChange={function(e) { setLocId(+e.target.value); }} style={inp}>
              {LOCATIONS.map(function(l) { return <option key={l.id} value={l.id}>{l.name}</option>; })}
            </select>
          </div>
          <div>
            <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"10px", color:T.textF, letterSpacing:".14em", marginBottom:"5px" }}>DATE</div>
            <input type="date" value={date}
              onChange={function(e) { setDate(e.target.value); }}
              min={todayStr}
              max={new Date(Date.now() + 7*864e5).toISOString().split("T")[0]}
              style={inp} />
          </div>
          <div>
            <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"10px", color:T.textF, letterSpacing:".14em", marginBottom:"5px" }}>LAUNCH TIME</div>
            <select value={hour} onChange={function(e) { setHour(+e.target.value); }} style={inp}>
              {Array.from({ length:16 }, function(_, i) { return i + 5; }).map(function(h) {
                return <option key={h} value={h}>{h < 12 ? h + ":00 AM" : h === 12 ? "12:00 PM" : (h-12) + ":00 PM"}</option>;
              })}
            </select>
          </div>
          <button onClick={check} disabled={loading} style={{
            background: loading ? T.bgAlt : T.accent,
            border: "2px solid " + (loading ? T.border : T.accent),
            borderRadius:"4px", color: loading ? T.textF : "#fdf8ee",
            padding:"0 18px", fontFamily:"'Alfa Slab One',serif",
            fontSize:"13px", cursor: loading ? "not-allowed" : "pointer",
            height:"40px", whiteSpace:"nowrap",
            boxShadow: loading ? "none" : "2px 2px 0 " + (dark ? "#3a1a0a" : "#8a3010"),
          }}>
            {loading ? "CHECKING…" : "CHECK"}
          </button>
        </div>

        {/* MOCK NOTICE */}
        {c && c.isMock && (
          <div style={{ background:T.bgAlt, border:"1.5px dashed " + T.border, borderRadius:"5px",
            padding:"9px 14px", fontFamily:"'Courier Prime',monospace", fontSize:"11px",
            color:T.textF, marginBottom:"18px", textAlign:"center" }}>
            ⚠ DEMO DATA — Live NOAA fetch unavailable in this preview. Deploy to GitHub Pages to see real conditions.
          </div>
        )}

        {/* VERDICT BADGE */}
        {(loading || c) && (
          <div className="fi0" style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"24px 0 28px" }}>
            <div style={{ position:"relative", width:"160px", height:"160px" }}>
              <svg viewBox="0 0 160 160" style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}>
                <circle cx="80" cy="80" r="78" fill={loading ? T.bgCard : vc} stroke={loading ? T.border : vc} strokeWidth="1.5" opacity={loading ? .25 : .95} />
                <circle cx="80" cy="80" r="71" fill="none" stroke={loading ? T.borderF : "#fff5"} strokeWidth="1.2" />
                <circle cx="80" cy="80" r="63" fill={loading ? T.bgAlt : vc} opacity={loading ? .1 : .75} />
                {Array.from({ length:36 }, function(_, i) {
                  const a = (i * 10 - 90) * Math.PI / 180;
                  const r1 = 70, r2 = i % 3 === 0 ? 63 : 67;
                  return <line key={i}
                    x1={80 + r1 * Math.cos(a)} y1={80 + r1 * Math.sin(a)}
                    x2={80 + r2 * Math.cos(a)} y2={80 + r2 * Math.sin(a)}
                    stroke="#fff5" strokeWidth={i % 3 === 0 ? "1.5" : "0.8"} />;
                })}
                <defs>
                  <path id="arc" d="M 14,80 A 66,66 0 0,1 146,80" />
                </defs>
                <text textAnchor="middle" fill="#fff7" fontSize="7.5" fontFamily="'Courier Prime',monospace" letterSpacing="3.8">
                  <textPath href="#arc" startOffset="50%">· · · PUGET SOUND · · ·</textPath>
                </text>
              </svg>
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center" }}>
                {loading
                  ? <div style={{ width:"30px", height:"30px", border:"3px solid " + T.border,
                      borderTopColor:T.accent, borderRadius:"50%", animation:"spin .8s linear infinite" }} />
                  : <React.Fragment>
                      <div style={{ fontFamily:"'Alfa Slab One',serif",
                        fontSize: v === "yellow" || v === "orange" ? "20px" : "28px",
                        color:"#fff", textShadow:"1px 1px 0 rgba(0,0,0,.3)", lineHeight:1, marginBottom:"4px" }}>
                        {SL[v]}
                      </div>
                      <div style={{ fontSize:"20px" }}>
                        {v === "green" ? "🎣" : v === "red" ? "🚫" : "⚠"}
                      </div>
                    </React.Fragment>
                }
              </div>
            </div>

            {!loading && c && (
              <div style={{ textAlign:"center", marginTop:"14px" }}>
                <div style={{ fontFamily:"'Rye',serif", fontSize:"15px", color:T.textM, letterSpacing:".06em" }}>
                  {loc.name}
                </div>
                <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"11px", color:T.textF, marginTop:"3px" }}>
                  {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}
                  {c.temp ? " · " + c.temp + "°" + c.tempU : ""}
                </div>
                {c.fc && (
                  <div style={{ fontFamily:"'Special Elite',serif", fontSize:"13px", color:T.textM, marginTop:"5px" }}>
                    {c.fc}
                  </div>
                )}
                {c.scaAlerts && c.scaAlerts.length > 0 && (
                  <div style={{ marginTop:"10px", padding:"7px 14px",
                    background: dark ? "#2a0000" : "#fff0ef",
                    border:"1.5px solid " + T.accent, borderRadius:"4px",
                    fontFamily:"'Courier Prime',monospace", fontSize:"12px", color:T.accent }}>
                    ⚠ {c.scaAlerts.join(" · ")}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* METRIC CARDS */}
        {c && (
          <div className="fi1">
            <SecHead T={T} label="CONDITIONS AT A GLANCE" icon="〰" />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"4px" }}>
              <MetCard T={T} dark={dark} label="WIND"
                value={c.windKt != null ? c.windKt.toFixed(1) : "—"} unit="kt"
                sub={c.windDir ? "from " + c.windDir : null} status={c.ws}
                thresh="0–8 kt: Ideal · 8–12: OK · 12–15: Marginal · 15+: No Go" />
              <MetCard T={T} dark={dark} label="GUSTS"
                value={c.gustKt != null ? c.gustKt.toFixed(1) : "—"} unit="kt"
                sub={c.gustKt == null ? "none reported" : null} status={c.gs}
                thresh="≤12 kt: OK · ≤15: Caution · 15+: No Go" />
              <MetCard T={T} dark={dark} label="WAVES"
                value={c.waveHt != null ? c.waveHt.toFixed(1) : "—"} unit="ft"
                sub={c.wavePd ? c.wavePd + "s period" : c.waveHt == null ? "check manually" : null}
                status={c.wvs} thresh="≤1 ft: Easy · 1–2 ft @ 6s+: OK · 3 ft+ / short period: No Go" />
              <MetCard T={T} dark={dark} label="CURRENT"
                value={c.currKt != null ? c.currKt.toFixed(2) : "—"} unit="kt"
                sub={c.currKt == null ? "see NOAA Currents →" : null} status={c.cs}
                thresh="<1 kt: Fine · 1–2 kt: Plan carefully · 2 kt+: No Go" />
              <MetCard T={T} dark={dark} label="ADVISORIES"
                value={c.scaAlerts && c.scaAlerts.length ? "ACTIVE" : "CLEAR"} unit=""
                sub={(c.scaAlerts && c.scaAlerts[0]) || "No marine advisories"} status={c.adv}
                thresh="Any Small Craft / Gale / Storm Warning = No Go" />
              <MetCard T={T} dark={dark} label="VISIBILITY"
                value={c.vis === "green" ? "GOOD" : c.vis === "yellow" ? "LIMITED" : "POOR"} unit=""
                sub={c.fc || null} status={c.vis}
                thresh=">1 mile: OK · Fog + shipping traffic: No Go" />
            </div>
          </div>
        )}

        {/* TIDES */}
        {c && c.tides && c.tides.length > 0 && (
          <div className="fi2" style={{ marginTop:"18px" }}>
            <SecHead T={T} label={"TIDES · " + date} icon="⋄" />
            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
              {c.tides.map(function(t, i) {
                return (
                  <div key={i} style={{ background:T.bgCard,
                    border:"1.5px solid " + (t.type === "H" ? T.green : T.border),
                    borderRadius:"5px", padding:"12px 16px", minWidth:"108px",
                    boxShadow:"2px 2px 0 " + T.shadow }}>
                    <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"10px", fontWeight:700,
                      color: t.type === "H" ? T.green : T.textF, letterSpacing:".12em", marginBottom:"5px" }}>
                      {t.type === "H" ? "HIGH TIDE" : "LOW TIDE"}
                    </div>
                    <div style={{ fontFamily:"'Alfa Slab One',serif", fontSize:"26px",
                      color: t.type === "H" ? T.green : T.textM, lineHeight:1 }}>
                      {parseFloat(t.v).toFixed(1)}
                      <span style={{ fontSize:"12px", fontFamily:"'Courier Prime',monospace", color:T.textF, fontWeight:400 }}> ft</span>
                    </div>
                    <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"11px", color:T.textF, marginTop:"3px" }}>
                      {t.t && t.t.split(" ")[1]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CHECKLIST */}
        {c && (
          <div className="fi2" style={{ marginTop:"18px" }}>
            <SecHead T={T} label="PRE-LAUNCH CHECKLIST" icon="✦" />
            <div style={{ background:T.bgCard, border:"1.5px solid " + T.border,
              borderRadius:"7px", overflow:"hidden", boxShadow:"2px 2px 0 " + T.shadow }}>
              <CRow T={T} dark={dark} status={c.ws}  label="Wind ≤ 12 kt"
                detail={c.windKt != null ? c.windKt.toFixed(1) + " kt from " + c.windDir : "data unavailable"} />
              <CRow T={T} dark={dark} status={c.gs}  label="Gusts ≤ 15 kt"
                detail={c.gustKt != null ? c.gustKt.toFixed(1) + " kt" : "none reported"} />
              <CRow T={T} dark={dark} status={c.wvs} label="Waves ≤ 2 ft, 6s+ period"
                detail={c.waveHt != null ? c.waveHt.toFixed(1) + " ft" + (c.wavePd ? " @ " + c.wavePd + "s" : "") : "check manually"} />
              <CRow T={T} dark={dark} status={c.cs}  label="Current ≤ 1 kt"
                detail={c.currKt != null ? c.currKt.toFixed(2) + " kt" : "check tidesandcurrents.noaa.gov"} />
              <CRow T={T} dark={dark} status={c.adv} label="No Small Craft Advisory"
                detail={(c.scaAlerts && c.scaAlerts.length) ? c.scaAlerts.join(", ") : "No active advisories"} />
              <CRow T={T} dark={dark} status={c.vis} label="Visibility good, no fog" detail={c.fc || "—"} />
              <CRow T={T} dark={dark} manual
                status={manual.gear ? "green" : "unknown"}
                label="Cold-water gear on — dry suit ✓"
                detail="Dry suit on. Assume you will flip. No cotton."
                checked={manual.gear}
                onToggle={function() { setManual(function(p) { return Object.assign({}, p, { gear:!p.gear }); }); }} />
              <CRow T={T} dark={dark} manual
                status={manual.floatPlan ? "green" : "unknown"}
                label="Float plan shared with someone ashore"
                detail="Tell someone where you're going & when you'll be back."
                checked={manual.floatPlan}
                onToggle={function() { setManual(function(p) { return Object.assign({}, p, { floatPlan:!p.floatPlan }); }); }} />
              <CRow T={T} dark={dark} manual last
                status={manual.shore ? "green" : "unknown"}
                label="Route stays close to shore"
                detail="Narrows can run 3+ kt at exchange — plan accordingly."
                checked={manual.shore}
                onToggle={function() { setManual(function(p) { return Object.assign({}, p, { shore:!p.shore }); }); }} />
            </div>

            <div style={{ marginTop:"12px", padding:"14px 18px",
              background: allGo ? T.green : v === "red" ? (dark ? "#2a0500" : "#fff5f4") : T.bgAlt,
              border: "2px solid " + (allGo ? T.green : v === "red" ? T.accent : T.border),
              borderRadius:"5px", display:"flex", alignItems:"center", gap:"14px",
              boxShadow:"2px 2px 0 " + T.shadow }}>
              <div style={{ fontFamily:"'Alfa Slab One',serif", fontSize:"22px",
                color: allGo ? "#fdf8ee" : v === "red" ? T.accent : T.textM }}>
                {allGo ? "🎣" : v === "red" ? "🚫" : "✓?"}
              </div>
              <div style={{ fontFamily:"'Special Elite',serif", fontSize:"13px", lineHeight:"1.6",
                color: allGo ? "#fdf8ee" : v === "red" ? T.accent : T.textM }}>
                {allGo
                  ? "All checks clear — conditions look good. Fish on, paddle safe."
                  : v === "red" || v === "orange"
                  ? "Conditions are outside safe limits. Strongly reconsider today's launch."
                  : !allManual
                  ? "Confirm the manual checks above before heading out."
                  : "Marginal conditions — keep it short, hug the shore."}
              </div>
            </div>
          </div>
        )}

        {/* SOURCES */}
        {sources.length > 0 && (
          <div className="fi3" style={{ marginTop:"24px", borderTop:"1.5px solid " + T.border, paddingTop:"16px" }}>
            <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"10px", color:T.textF, letterSpacing:".14em", marginBottom:"9px" }}>
              VERIFY SOURCES
            </div>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
              {sources.concat([
                { label:"NDBC NW Buoys", url:"https://www.ndbc.noaa.gov/maps/northwest_hist.shtml" },
                { label:"NOAA Marine",   url:"https://www.weather.gov/mtr/marine" },
              ]).map(function(s, i) {
                return (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily:"'Courier Prime',monospace", fontSize:"11px", color:T.green,
                      textDecoration:"none", padding:"4px 10px", background:T.bgCard,
                      border:"1px solid " + T.border, borderRadius:"3px",
                      boxShadow:"1px 1px 0 " + T.shadow }}>
                    ↗ {s.label}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* DISCLAIMER */}
        <div style={{ marginTop:"22px", padding:"14px 16px", background:T.bgAlt,
          border:"1.5px solid " + T.border, borderRadius:"5px", boxShadow:"2px 2px 0 " + T.shadow }}>
          <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"10px", color:T.textF, lineHeight:"1.75" }}>
            ⚠ INFORMATIONAL USE ONLY — This tool aggregates public NOAA/NWS data and does not replace on-the-water judgment or local knowledge. Puget Sound conditions change rapidly. Cold-water immersion (45–55°F year-round) causes cold shock in under 1 minute and swimming failure within ~10 minutes — even on mild days. A dry suit is your best insurance. Always dress for the water temperature, not the air. Assume you will flip.
          </div>
        </div>

        <div style={{ textAlign:"center", padding:"20px 0 0", color:T.green, fontSize:"16px", letterSpacing:"8px", opacity:.5 }}>
          ⊸ ∿∿∿ ⊷
        </div>
      </div>
    </div>
  );
}

function SecHead({ T, label, icon }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
      <span style={{ color:T.accent, fontSize:"14px" }}>{icon}</span>
      <span style={{ fontFamily:"'Courier Prime',monospace", fontSize:"10px", fontWeight:700,
        color:T.textF, letterSpacing:".18em" }}>{label}</span>
      <div style={{ flex:1, height:"1px", background:T.border, opacity:.5 }} />
    </div>
  );
}

function MetCard({ T, dark, label, value, unit, sub, status, thresh }) {
  const [open, setOpen] = useState(false);
  const sc = SC[status] || SC.unknown;
  return (
    <div onClick={function() { setOpen(function(o) { return !o; }); }}
      style={{ background:T.bgCard, border:"1.5px solid " + T.border, borderTopColor:sc,
        borderRadius:"5px", padding:"13px 11px", cursor:"pointer", position:"relative",
        boxShadow:"2px 2px 0 " + T.shadow, overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:sc }} />
      <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"10px", fontWeight:700, color:T.textF,
        letterSpacing:".14em", marginBottom:"7px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span>{label}</span>
        <span style={{ color:sc, background:sc + (dark ? "33" : "18"), padding:"1px 5px", borderRadius:"2px",
          fontSize:"10px", fontFamily:"'Special Elite',serif" }}>
          {SL[status] || "—"}
        </span>
      </div>
      <div style={{ fontFamily:"'Alfa Slab One',serif", fontSize:"26px", color:T.text, lineHeight:1, marginBottom:"3px" }}>
        {value}
        <span style={{ fontSize:"12px", fontFamily:"'Courier Prime',monospace", color:T.textF, fontWeight:400, marginLeft:"3px" }}>
          {unit}
        </span>
      </div>
      {sub && (
        <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"10px", color:T.textF, marginTop:"3px" }}>{sub}</div>
      )}
      {open && thresh && (
        <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"10px", color:T.textF,
          marginTop:"10px", lineHeight:"1.6", borderTop:"1px dashed " + T.border, paddingTop:"8px" }}>
          {thresh}
        </div>
      )}
      <div style={{ position:"absolute", bottom:"5px", right:"7px", fontSize:"9px", color:T.border }}>
        {open ? "▲" : "▼"}
      </div>
    </div>
  );
}

function CRow({ T, dark, status, label, detail, manual, checked, onToggle, last }) {
  const sc = SC[status] || SC.unknown;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 14px",
      borderBottom: last ? "none" : "1px solid " + T.borderF,
      background: (status === "red" || status === "orange") ? (dark ? "#1a0500" : "#fff8f6") : "transparent" }}>
      <div style={{ width:"22px", height:"22px", borderRadius:"50%", border:"2px solid " + sc,
        background: status === "unknown" ? "transparent" : sc + "20",
        flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:"'Courier Prime',monospace", fontWeight:700, fontSize:"13px", color:sc }}>
        {SI[status] || "·"}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:"'Special Elite',serif", fontSize:"13px", color:T.text,
          display:"flex", alignItems:"center", gap:"6px" }}>
          {label}
          {manual && (
            <span style={{ fontFamily:"'Courier Prime',monospace", fontSize:"9px", color:T.textF,
              background:T.bgAlt, padding:"1px 5px", borderRadius:"2px" }}>
              MANUAL
            </span>
          )}
        </div>
        {detail && (
          <div style={{ fontFamily:"'Courier Prime',monospace", fontSize:"10px", color:T.textF, marginTop:"2px" }}>
            {detail}
          </div>
        )}
      </div>
      {manual && (
        <button onClick={onToggle} style={{
          background: checked ? T.green : T.bgAlt,
          border: "1.5px solid " + (checked ? T.green : T.border),
          borderRadius:"3px", color: checked ? "#fdf8ee" : T.textF,
          padding:"4px 12px", fontFamily:"'Courier Prime',monospace",
          fontSize:"11px", cursor:"pointer", flexShrink:0, fontWeight:700 }}>
          {checked ? "✓ DONE" : "CONFIRM"}
        </button>
      )}
    </div>
  );
}
