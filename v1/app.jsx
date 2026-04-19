// Main app. Builds panels for decisions, outcomes, equations.
import React from 'react';
import CG from './engine.js';
import { fmtB, fmtT, fmtP, fmtGt, regionByKey, C, Bar, LineChart, AmbitionSlider } from './ui.jsx';
const { useState: uS, useMemo: uM, useEffect: uE } = React;

function App() {
  const [activeBloc, setActiveBloc] = uS("GCC");
  const [mode, setMode] = uS("multi"); // "uni" | "bi" | "multi"
  const [partners, setPartners] = uS([]); // for bilateral/multilateral
  const [decisions, setDecisions] = uS(CG.engine.defaultDecisions());
  const [tab, setTab] = uS("dashboard"); // dashboard | actions | equations | coalition
  const [showFunds, setShowFunds] = uS(false);
  const [funds, setFunds] = uS({...CG.FUNDS_DEFAULT, recipients:{AFR:0.5,IND:0.2,ASN:0.15,LAM:0.15}});

  // Apply mode: other regions (not active, not partners) snap to Low
  const effectiveDecisions = uM(() => {
    const d = {};
    const members = new Set([activeBloc, ...partners]);
    for (const r of CG.REGIONS) {
      if (members.has(r.key)) d[r.key] = decisions[r.key];
      else if (mode === "multi") d[r.key] = decisions[r.key];
      else d[r.key] = {energy:0, land:0}; // others Low in uni/bi
    }
    return d;
  }, [decisions, activeBloc, partners, mode]);

  const temp = uM(() => CG.engine.temperatureSeries(effectiveDecisions), [effectiveDecisions]);
  const cumTot = uM(() => CG.engine.cumTrap(temp.emissions), [temp]);
  const coverage = uM(() => {
    let cov = 0;
    if (mode === "multi") {
      for (const r of CG.REGIONS) if (effectiveDecisions[r.key].energy >= 1.5) cov += CG.PROFILE[r.key].abShare;
    } else {
      const members = new Set([activeBloc, ...partners]);
      for (const k of members) if (decisions[k].energy >= 1.5) cov += CG.PROFILE[k].abShare;
    }
    return cov;
  }, [decisions, effectiveDecisions, activeBloc, partners, mode]);

  const eco = uM(() => CG.engine.blocEconomics(activeBloc, effectiveDecisions), [activeBloc, effectiveDecisions]);
  const ecoLow = uM(() => {
    const allLow = CG.engine.baselineLowDecisions();
    return CG.engine.blocEconomics(activeBloc, allLow);
  }, [activeBloc]);

  // Cumulative summaries (use coalition rent when multilateral, unilateral rent when uni/bi)
  const cum = uM(() => {
    const sum = (arr) => CG.engine.cumTrap(arr);
    const coalitionRent = CG.engine.coalitionRentLoss(activeBloc, effectiveDecisions);
    const rentUsed = mode === "multi" ? coalitionRent : eco.uniRentCum;
    return {
      trans: sum(eco.trans),
      transLow: sum(ecoLow.trans),
      rent: rentUsed,
      rentCoalition: coalitionRent,
      rentUni: eco.uniRentCum,
      dam: sum(eco.damTotal),
      damLow: sum(ecoLow.damTotal),
      damSaved: sum(ecoLow.damTotal) - sum(eco.damTotal),
      transIncr: sum(eco.trans) - sum(ecoLow.trans),
    };
  }, [eco, ecoLow, effectiveDecisions, mode, activeBloc]);

  const netBenefit = cum.damSaved - (cum.transIncr + cum.rent);
  const bcr = cum.damSaved / Math.max(1,(cum.transIncr + cum.rent));

  // Five canonical paths for benchmark panel
  const paths = uM(() => {
    const buildD = (highKeys) => {
      const d = {};
      for (const r of CG.REGIONS) d[r.key] = highKeys.includes(r.key) ? {energy:2,land:2} : {energy:0,land:0};
      return d;
    };
    const all = CG.REGIONS.map(r=>r.key);
    const mk = (label, coalition) => {
      const d = buildD(coalition);
      const T = CG.engine.temperatureSeries(d).T[8];
      const share = coalition.reduce((a,k)=> a + CG.PROFILE[k].abShare, 0);
      const nw = CG.engine.blocNetWelfare(activeBloc, d);
      const inCoal = coalition.includes(activeBloc);
      return { label, coverage:share, T, net:nw.net, dTrans:nw.dTrans, rent:nw.rent, saved:nw.damageSaved, inCoal };
    };
    return [
      mk("All-Low (no coalition)", []),
      mk("Grand Coalition (all 9)", all),
      mk("5-region minimum (CHN+IND+NAM+ASN+AFR)", ["CHN","IND","NAM","ASN","AFR"]),
      mk("Without USA (8 regions)", all.filter(k=>k!=="NAM")),
      mk("Without GCC + Russia (7 regions)", all.filter(k=>k!=="GCC" && k!=="RUS")),
      mk("Defect (you stay Low, others High)", all.filter(k=>k!==activeBloc)),
    ];
  }, [activeBloc]);

  const bloc = regionByKey(activeBloc);
  const profile = CG.PROFILE[activeBloc];
  const damParam = CG.DAMAGE[activeBloc];

  const setDec = (key, patch) => setDecisions(d => ({...d, [key]: {...d[key], ...patch}}));
  const resetDefault = () => setDecisions(CG.engine.defaultDecisions());
  const resetLow = () => setDecisions(CG.engine.baselineLowDecisions());

  const togglePartner = (k) => {
    if (k === activeBloc) return;
    setPartners(p => p.includes(k) ? p.filter(x=>x!==k) : [...p, k]);
  };

  const members = mode === "multi"
    ? CG.REGIONS.filter(r => effectiveDecisions[r.key].energy >= 1.5).map(r => r.key)
    : [activeBloc, ...partners];
  const tempOK = temp.T[8] <= CG.T_TARGET + 0.02;

  return (
    <div style={{minHeight:"100vh", background:C.bg, color:C.ink, fontFamily:"ui-sans-serif, -apple-system, system-ui, Helvetica"}}>
      {/* Header */}
      <div style={{borderBottom:`1px solid ${C.line}`, background:"#fffdf8", padding:"16px 28px", display:"flex", alignItems:"baseline", justifyContent:"space-between", flexWrap:"wrap", gap:16}}>
        <div>
          <div style={{fontSize:11, letterSpacing:".12em", color:C.dim, textTransform:"uppercase"}}>Climate Negotiation Game · Decision Support</div>
          <div style={{fontSize:22, fontWeight:700, marginTop:4}}>Bloc Decision Tool — {bloc.name}</div>
          <div style={{fontSize:12, color:C.dim, marginTop:4}}>
            Nine-region simulation · 2025–2065 · TCRE 0.56°C/1000 GtCO₂ · Objective T(2065) ≤ 1.86°C
          </div>
        </div>
        <div style={{display:"flex", gap:12, alignItems:"center"}}>
          <div style={{padding:"6px 12px", background: tempOK? "#ecfdf5" : "#fef2f2",
                       border:`1px solid ${tempOK? "#a7f3d0":"#fecaca"}`, borderRadius:6, fontSize:12}}>
            <b>T(2065)</b> {fmtT(temp.T[8])} {tempOK? "✓ meets 1.86°C" : "✗ exceeds target"}
          </div>
          <div style={{padding:"6px 12px", background:"#fff7ed", border:`1px solid #fed7aa`, borderRadius:6, fontSize:12}}>
            <b>Coverage</b> {fmtP(coverage)} {coverage>=0.8? "✓ ≥80%":"✗ <80%"}
          </div>
        </div>
      </div>

      {/* Bloc selector + mode */}
      <div style={{padding:"14px 28px", borderBottom:`1px solid ${C.line}`, background:"#fafaf7"}}>
        <div style={{display:"flex", gap:6, flexWrap:"wrap", alignItems:"center"}}>
          <span style={{fontSize:11, color:C.dim, marginRight:8}}>ACTIVE BLOC:</span>
          {CG.REGIONS.map(r => (
            <button key={r.key} onClick={()=>{setActiveBloc(r.key); setPartners(p=>p.filter(x=>x!==r.key));}}
              style={{
                padding:"6px 10px", borderRadius:4, fontSize:12, cursor:"pointer",
                border:`1px solid ${activeBloc===r.key? r.color: C.line}`,
                background: activeBloc===r.key? r.color: "#fff",
                color: activeBloc===r.key? "#fff":C.ink, fontWeight: activeBloc===r.key?600:400
              }}>{r.name}</button>
          ))}
        </div>
        <div style={{display:"flex", gap:18, marginTop:10, alignItems:"center", flexWrap:"wrap"}}>
          <div style={{display:"flex", gap:4}}>
            {[["uni","Unilateral"],["bi","Bilateral"],["multi","Multilateral"]].map(([k,l])=>(
              <button key={k} onClick={()=>{setMode(k); if(k==="uni") setPartners([]);}}
                style={{padding:"5px 12px", fontSize:12, border:`1px solid ${C.line}`, borderRadius:4,
                        background: mode===k? C.ink:"#fff", color: mode===k?"#fff":C.ink, cursor:"pointer"}}>{l}</button>
            ))}
          </div>
          {mode !== "uni" && (
            <div style={{display:"flex", gap:4, alignItems:"center", flexWrap:"wrap"}}>
              <span style={{fontSize:11, color:C.dim}}>PARTNERS:</span>
              {CG.REGIONS.filter(r=>r.key!==activeBloc).map(r=>(
                <button key={r.key} onClick={()=>togglePartner(r.key)}
                  style={{
                    padding:"4px 8px", fontSize:11, borderRadius:3,
                    border:`1px solid ${partners.includes(r.key)? r.color:C.line}`,
                    background: partners.includes(r.key)? r.color+"22":"#fff",
                    color: partners.includes(r.key)? r.color:C.dim, cursor:"pointer",
                    fontWeight: partners.includes(r.key)? 600:400
                  }}>
                  {partners.includes(r.key)? "✓ ":""}{r.name}
                </button>
              ))}
            </div>
          )}
          <div style={{marginLeft:"auto", display:"flex", gap:8}}>
            <button onClick={resetDefault} style={btnStyle}>Reset to target-compliant defaults (all High)</button>
            <button onClick={resetLow} style={btnStyle}>Set all to Low (baseline)</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{padding:"0 28px", borderBottom:`1px solid ${C.line}`, display:"flex", gap:0, background:"#fffdf8"}}>
        {[
          ["dashboard","Own Economics Dashboard"],
          ["actions","Action-by-Action Impact"],
          ["coalition","Coalition / Bilateral View"],
          ["equations","Equations & Assumptions"],
        ].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{padding:"12px 16px", fontSize:13, background:"transparent", cursor:"pointer",
                    border:"none", borderBottom: tab===k? `2px solid ${C.accent}`:"2px solid transparent",
                    color: tab===k? C.ink:C.dim, fontWeight: tab===k?600:500}}>{l}</button>
        ))}
      </div>

      <div style={{padding:"20px 28px", display:"grid", gridTemplateColumns:"340px 1fr", gap:20}}>
        {/* LEFT: decision panel */}
        <div>
          <Card title="Your Decisions">
            <div style={{fontSize:11, color:C.dim, marginBottom:10, lineHeight:1.5}}>
              Move each bloc's ambition slider between <b>Low</b>, <b>Medium</b>, and <b>High</b>. 
              Values interpolate between the calibrated scenarios from the master workbook.
            </div>
            <BlocControls regionKey={activeBloc} decisions={decisions} setDec={setDec} primary/>
            {partners.map(p => (
              <BlocControls key={p} regionKey={p} decisions={decisions} setDec={setDec}/>
            ))}
            {mode==="multi" && (
              <details style={{marginTop:10, fontSize:12}}>
                <summary style={{cursor:"pointer", color:C.dim}}>Non-coalition bloc sliders (multilateral)</summary>
                <div style={{marginTop:8}}>
                  {CG.REGIONS.filter(r=> r.key!==activeBloc && !partners.includes(r.key)).map(r => (
                    <BlocControls key={r.key} regionKey={r.key} decisions={decisions} setDec={setDec} mini/>
                  ))}
                </div>
              </details>
            )}
          </Card>

          <Card title="Coalition Status" compact>
            <Row label="Members" value={members.map(k=>regionByKey(k).name).join(", ")}/>
            <Row label="Abatement share (≥1.5 energy)" value={fmtP(coverage)}
                 ok={coverage>=0.8}/>
            <Row label="Global T(2065)" value={fmtT(temp.T[8])} ok={tempOK}/>
            <Row label="Global cum. CO₂ 2025–65" value={fmtGt(cumTot)}/>
            <Row label="1.8°C budget (536 Gt)" value={(100*cumTot/536).toFixed(0)+"% used"}
                 ok={cumTot<=536*1.02}/>
          </Card>
        </div>

        {/* RIGHT: main content */}
        <div>
          {tab === "dashboard" && <Dashboard bloc={bloc} profile={profile} damParam={damParam}
            eco={eco} ecoLow={ecoLow} cum={cum} netBenefit={netBenefit} bcr={bcr} temp={temp} mode={mode} paths={paths}/>}
          {tab === "actions" && <ActionsPanel activeBloc={activeBloc} decisions={decisions} setDec={setDec}/>}
          {tab === "coalition" && <CoalitionPanel members={members} decisions={decisions} effective={effectiveDecisions} temp={temp} activeBloc={activeBloc} paths={paths}/>}
          {tab === "equations" && <EquationsPanel/>}
        </div>
      </div>

      <div style={{padding:"18px 28px", fontSize:11, color:C.dim, borderTop:`1px solid ${C.line}`, background:"#fffdf8"}}>
        Defaults set to <b>all-High energy + all-High land use</b> for every bloc. Under these defaults the temperature at 2065 is {fmtT(temp.T[8])} (objective ≤1.86°C).
        Unilateral/bilateral modes hold non-coalition blocs at Low Ambition.
      </div>
    </div>
  );
}

const btnStyle = {padding:"6px 10px", fontSize:11, background:"#fff", border:`1px solid ${C.line}`, borderRadius:4, cursor:"pointer", color:C.ink};

function Card({title, children, compact, padded=true}) {
  return (
    <div style={{background:C.card, border:`1px solid ${C.line}`, borderRadius:6, marginBottom:14, overflow:"hidden"}}>
      <div style={{padding:"10px 14px", borderBottom:`1px solid ${C.line}`, fontSize:12, fontWeight:600, letterSpacing:".02em", background:"#fcfaf5"}}>
        {title}
      </div>
      <div style={{padding: padded? (compact?"10px 14px":"14px"):"0"}}>{children}</div>
    </div>
  );
}

function Row({label, value, ok, bad, sub}) {
  return (
    <div style={{display:"flex", justifyContent:"space-between", gap:8, padding:"4px 0", borderBottom:`1px dashed ${C.line}`, fontSize:12}}>
      <span style={{color:C.dim}}>{label}{sub && <div style={{fontSize:10, color:C.dim}}>{sub}</div>}</span>
      <span style={{fontVariantNumeric:"tabular-nums", fontWeight:500,
                    color: ok===true? C.ok : ok===false? C.bad : bad? C.bad : C.ink}}>{value}</span>
    </div>
  );
}

function BlocControls({regionKey, decisions, setDec, primary, mini}) {
  const r = regionByKey(regionKey);
  const d = decisions[regionKey];
  return (
    <div style={{padding: mini? "6px 0":"10px 0", borderTop: mini?`1px dashed ${C.line}`:"none"}}>
      <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:4}}>
        <div style={{width:8, height:8, borderRadius:2, background:r.color}}/>
        <span style={{fontWeight:primary?700:500, fontSize: primary?13:12}}>{r.name}</span>
        {primary && <span style={{fontSize:10, color:C.dim, marginLeft:"auto"}}>(your bloc)</span>}
      </div>
      <AmbitionSlider label="Energy ambition" value={d.energy} onChange={v=>setDec(regionKey,{energy:v})}/>
      <AmbitionSlider label="Land-use ambition" value={d.land} onChange={v=>setDec(regionKey,{land:v})}/>
    </div>
  );
}

function Dashboard({bloc, profile, damParam, eco, ecoLow, cum, netBenefit, bcr, temp, mode, paths}) {
  const gdpCum = CG.engine.cumTrap(eco.gdp) * 1000; // $bn
  const yr = CG.YEARS;
  return (
    <div>
      {/* KPI strip */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14}}>
        <Kpi title="Transition cost (A+B+C)" value={"$"+fmtB(cum.trans)} sub={`incr. vs Low: $${fmtB(cum.transIncr)}`}/>
        <Kpi title={mode==="multi"?"Rent loss (coalition)":"Rent loss (unilateral)"} value={"$"+fmtB(cum.rent)} sub={`uni $${fmtB(cum.rentUni)} / coal $${fmtB(cum.rentCoalition)}`}/>
        <Kpi title="Climate damage avoided" value={"$"+fmtB(cum.damSaved)} sub={`Low→current: ${fmtT(ecoLow.T[8])}→${fmtT(eco.T[8])}`} ok={cum.damSaved>0}/>
        <Kpi title="Net welfare · BCR" value={"$"+fmtB(netBenefit)} sub={`BCR ${bcr.toFixed(2)}:1`}
             ok={netBenefit>0} bad={netBenefit<0}/>
      </div>

      {paths && <Card title={`${bloc.name} · Five canonical paths benchmark`}>
        <div style={{fontSize:11, color:C.dim, marginBottom:8}}>Reference simulation outcomes (full coalition rent) for {bloc.name} across standard coalition configurations. Values reproduce the delegation strategy reports.</div>
        <table style={tableS}>
          <thead><tr>
            <th style={{...thS,textAlign:"left"}}>Path</th><th style={thS}>Coverage</th><th style={thS}>T(2065)</th>
            <th style={thS}>Δ Trans</th><th style={thS}>Rent loss</th><th style={thS}>Damage saved</th><th style={thS}>Net welfare</th>
          </tr></thead>
          <tbody>
            {paths.map((p,i)=>(
              <tr key={i}>
                <td style={{...tdS,textAlign:"left"}}>{p.inCoal?"✓ ":"✗ "}{p.label}</td>
                <td style={tdS}>{fmtP(p.coverage)}</td>
                <td style={{...tdS, color: p.T<=1.87?C.ok: p.T<=2.0?C.warn: C.bad}}>{fmtT(p.T)}</td>
                <td style={tdS}>{p.inCoal? "$"+fmtB(p.dTrans) : "—"}</td>
                <td style={tdS}>{p.inCoal && p.rent>10? "$"+fmtB(p.rent) : "—"}</td>
                <td style={{...tdS,color:C.ok}}>+${fmtB(p.saved)}</td>
                <td style={{...tdS, fontWeight:700, color:p.net>0?C.ok:C.bad}}>{p.net>=0?"+":""}${fmtB(p.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>}

      <Card title={`${bloc.name} · Own economic trajectory ($bn/yr)`}>
        <LineChart years={yr} height={200} yLabel="$bn/yr"
          legend
          series={[
            {name:"Transition cost", data: eco.trans, color:"#c2410c", bold:true},
            {name:"Climate damage", data: eco.damTotal, color:"#991b1b", bold:true},
            {name:"Rent loss", data: eco.rent, color:"#6b7280"},
          ]}/>
      </Card>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        <Card title="Global temperature (°C)">
          <LineChart years={yr} height={180} yLabel="°C" yRange={[1.5, 2.6]}
            annotate={[{y:1.86, label:"1.86°C target", color:C.accent}, {y:2.0, label:"2.0°C", color:C.dim}]}
            series={[
              {name:"Current path", data: eco.T, color:"#1a1a1a", bold:true},
            ]}/>
        </Card>
        <Card title={`${bloc.name} electricity-sector CO₂ (GtCO₂/yr)`}>
          <LineChart years={yr} height={180} yLabel="GtCO₂/yr"
            series={[
              {name:"Under decisions", data: eco.emit, color:bloc.color, bold:true},
              {name:"If Low", data: CG.ECO2[bloc.key].L, color:"#9ca3af", dashed:true},
              {name:"If High", data: CG.ECO2[bloc.key].H, color:"#16a34a", dashed:true},
            ]} legend/>
        </Card>
      </div>

      <Card title={`${bloc.name} · 5-yearly cost ledger (cumulative through year, $bn)`}>
        <div style={{overflowX:"auto"}}>
        <table style={tableS}>
          <thead>
            <tr>
              <th style={thS}>Item</th>
              {yr.map(y=><th key={y} style={thS}>{y}</th>)}
              <th style={{...thS, background:"#f5efe3"}}>Cum 2025–65</th>
            </tr>
          </thead>
          <tbody>
            <Tr label="Transition A+B+C" row={eco.trans} cum={cum.trans}/>
            <Tr label="Rent loss (unilateral)" row={eco.rent} cum={cum.rent}/>
            <Tr label="Smooth climate damage" row={eco.smoothDam} cum={CG.engine.cumTrap(eco.smoothDam)}/>
            <Tr label="Tipping-point expected damage" row={eco.tippingDam} cum={CG.engine.cumTrap(eco.tippingDam)}/>
            <Tr label="TOTAL annual welfare cost" row={eco.netCost} cum={CG.engine.cumTrap(eco.netCost)} bold/>
            <Tr label="Damage saved vs Low" row={eco.damTotal.map((v,i)=> ecoLow.damTotal[i]-v)} cum={cum.damSaved} ok/>
          </tbody>
        </table>
        </div>
      </Card>

      <Card title="Damage decomposition · residual vs tipping">
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
          <LineChart years={yr} height={160} yLabel="$bn/yr"
            series={[
              {name:"Smooth (β·φ)", data: eco.smoothDam, color:"#92400e"},
              {name:"Adaptation (α)", data: eco.adaptDam, color:"#ca8a04"},
              {name:"Expected tipping", data: eco.tippingDam, color:"#991b1b"},
            ]} legend/>
          <div style={{fontSize:12, lineHeight:1.6}}>
            <p><b>{bloc.name} damage parameters:</b></p>
            <Row label="β (gross damage sensitivity)" value={damParam.beta+" %GDP/°C²"}/>
            <Row label="φ (residual unavoidable fraction)" value={damParam.phi.toFixed(2)}/>
            <Row label="α (adaptation coefficient)" value={damParam.alpha+" %GDP/°C²"}/>
            <Row label="WACC (clean energy)" value={fmtP(profile.wacc)}/>
            <Row label="Share of global abatement" value={fmtP(profile.abShare)}/>
            <Row label="Cumulative GDP 2025–65" value={"$"+fmtB(gdpCum)}/>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Kpi({title, value, sub, ok, bad}) {
  return (
    <div style={{background:C.card, border:`1px solid ${C.line}`, borderRadius:6, padding:"10px 12px"}}>
      <div style={{fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:".06em"}}>{title}</div>
      <div style={{fontSize:20, fontWeight:700, marginTop:3, color: ok?C.ok: bad?C.bad: C.ink}}>{value}</div>
      <div style={{fontSize:11, color:C.dim, marginTop:2}}>{sub}</div>
    </div>
  );
}

const tableS = {width:"100%", borderCollapse:"collapse", fontSize:12, fontVariantNumeric:"tabular-nums"};
const thS = {textAlign:"right", padding:"6px 8px", borderBottom:`1px solid ${C.line}`, fontWeight:600, color:C.dim, fontSize:11};
const tdS = {textAlign:"right", padding:"5px 8px", borderBottom:`1px solid ${C.line}`};

function Tr({label, row, cum, bold, ok}) {
  const safeRow = Array.isArray(row) ? row : CG.YEARS.map(()=>0);
  const safeCum = (cum==null || isNaN(cum)) ? 0 : cum;
  return (
    <tr>
      <td style={{...tdS, textAlign:"left", fontWeight:bold?600:400}}>{label}</td>
      {safeRow.map((v,i)=><td key={i} style={{...tdS, color: ok? C.ok: C.ink, fontWeight:bold?600:400}}>{Math.round(v||0)}</td>)}
      <td style={{...tdS, background:"#fbf7ec", fontWeight:700, color: ok?C.ok:C.ink}}>{Math.round(safeCum)}</td>
    </tr>
  );
}

function ActionsPanel({activeBloc, decisions, setDec}) {
  const current = decisions[activeBloc];
  // For each possible action (discrete step to L/M/H energy, L/M/H land), show delta
  const allLow = CG.engine.baselineLowDecisions();
  // Hold others at current decisions; vary active
  const runWith = (e, l) => {
    const d = {...decisions, [activeBloc]: {energy:e, land:l}};
    const temp = CG.engine.temperatureSeries(d);
    const eco = CG.engine.blocEconomics(activeBloc, d);
    const sum = (a)=> CG.engine.cumTrap(a);
    return {T65: temp.T[8], trans: sum(eco.trans), rent: eco.uniRentCum, dam: sum(eco.damTotal)};
  };

  const baseline = runWith(current.energy, current.land);
  const combos = [
    {label:"Energy → Low",  e:0, l:current.land},
    {label:"Energy → Medium", e:1, l:current.land},
    {label:"Energy → High", e:2, l:current.land},
    {label:"Land-use → Low",  e:current.energy, l:0},
    {label:"Land-use → Medium",  e:current.energy, l:1},
    {label:"Land-use → High",  e:current.energy, l:2},
    {label:"Both → High (all-in)",  e:2, l:2},
    {label:"Both → Low (withdraw)",  e:0, l:0},
  ];
  const bloc = regionByKey(activeBloc);

  return (
    <div>
      <Card title={`${bloc.name} · Impact of individual action changes`}>
        <div style={{fontSize:12, color:C.dim, marginBottom:10}}>
          Each row holds other blocs at their current ambition and toggles <b>only {bloc.name}</b>'s lever. Deltas are vs current scenario.
        </div>
        <table style={tableS}>
          <thead>
            <tr>
              <th style={{...thS, textAlign:"left"}}>If {bloc.name} sets…</th>
              <th style={thS}>ΔT(2065)</th>
              <th style={thS}>Δ Transition $</th>
              <th style={thS}>Δ Rent loss</th>
              <th style={thS}>Δ Own damage</th>
              <th style={thS}>Net to {bloc.name}</th>
              <th style={thS}></th>
            </tr>
          </thead>
          <tbody>
            {combos.map((c,i)=>{
              const r = runWith(c.e, c.l);
              const dT = r.T65 - baseline.T65;
              const dTrans = r.trans - baseline.trans;
              const dRent = r.rent - baseline.rent;
              const dDam = r.dam - baseline.dam;
              const net = -dTrans - dRent - dDam; // positive = better
              return (
                <tr key={i}>
                  <td style={{...tdS, textAlign:"left"}}>{c.label}</td>
                  <td style={{...tdS, color: dT<0? C.ok: dT>0? C.bad: C.dim}}>{dT>=0?"+":""}{dT.toFixed(3)}°C</td>
                  <td style={{...tdS, color: dTrans>0?C.bad: dTrans<0?C.ok:C.dim}}>{dTrans>=0?"+":""}{fmtB(dTrans)}</td>
                  <td style={{...tdS, color: dRent>0?C.bad: dRent<0?C.ok:C.dim}}>{dRent>=0?"+":""}{fmtB(dRent)}</td>
                  <td style={{...tdS, color: dDam>0?C.bad: dDam<0?C.ok:C.dim}}>{dDam>=0?"+":""}{fmtB(dDam)}</td>
                  <td style={{...tdS, fontWeight:700, color: net>0?C.ok: net<0?C.bad:C.ink}}>{net>=0?"+":""}{fmtB(net)}</td>
                  <td style={tdS}>
                    <button style={btnStyle} onClick={()=>setDec(activeBloc,{energy:c.e, land:c.l})}>Apply</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Marginal abatement: ΔT per $ of transition cost">
        <div style={{fontSize:12, color:C.dim, marginBottom:8}}>
          For each possible move, the implied abatement cost per °C is the ratio of incremental spending to
          temperature reduction achieved. Lower values = more cost-effective climate action.
        </div>
        <table style={tableS}>
          <thead><tr><th style={{...thS, textAlign:"left"}}>Action</th><th style={thS}>ΔT(2065)</th><th style={thS}>Δ spend + rent</th><th style={thS}>$/°C avoided</th></tr></thead>
          <tbody>
            {combos.map((c,i)=>{
              const r = runWith(c.e, c.l);
              const dT = r.T65 - baseline.T65;
              const cost = (r.trans - baseline.trans) + (r.rent - baseline.rent);
              const eff = dT < -0.0005 ? (cost/(-dT)) : null;
              return (
                <tr key={i}>
                  <td style={{...tdS, textAlign:"left"}}>{c.label}</td>
                  <td style={tdS}>{dT.toFixed(3)}</td>
                  <td style={tdS}>{fmtB(cost)}</td>
                  <td style={{...tdS, fontWeight:600}}>{eff==null? "—" : ("$"+fmtB(eff)+"/°C")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CoalitionPanel({members, decisions, effective, temp, activeBloc, paths}) {
  // compare unilateral vs bilateral vs full for each member
  const ecos = members.map(k => ({
    key: k,
    name: regionByKey(k).name,
    color: regionByKey(k).color,
    eco: CG.engine.blocEconomics(k, effective),
    low: CG.engine.blocEconomics(k, CG.engine.baselineLowDecisions()),
  }));

  // Defection test: for each NON-active bloc, what if they drop to Low?
  const defection = CG.REGIONS.filter(r=>r.key!==activeBloc).map(r => {
    const d = {...effective, [r.key]:{energy:0, land:0}};
    const nw = CG.engine.blocNetWelfare(activeBloc, d);
    const T = CG.engine.temperatureSeries(d).T[8];
    const baseline = CG.engine.blocNetWelfare(activeBloc, effective);
    return {key:r.key, name:r.name, color:r.color, T, net:nw.net, deltaNet: nw.net - baseline.net};
  }).sort((a,b)=>a.deltaNet-b.deltaNet);

  return (
    <div>
      <Card title="Coalition welfare comparison (cumulative 2025–65)">
        <table style={tableS}>
          <thead>
            <tr>
              <th style={{...thS, textAlign:"left"}}>Member</th>
              <th style={thS}>Share</th>
              <th style={thS}>Own energy</th>
              <th style={thS}>Own land</th>
              <th style={thS}>Transition $</th>
              <th style={thS}>Rent loss $</th>
              <th style={thS}>Damage saved $</th>
              <th style={thS}>Net $</th>
              <th style={thS}>BCR</th>
            </tr>
          </thead>
          <tbody>
            {ecos.map(e => {
              const trans = CG.engine.cumTrap(e.eco.trans);
              const transLow = CG.engine.cumTrap(e.low.trans);
              const dTrans = trans - transLow;
              const dam = CG.engine.cumTrap(e.eco.damTotal);
              const damLow = CG.engine.cumTrap(e.low.damTotal);
              const saved = damLow - dam;
              const rent = CG.engine.coalitionRentLoss(e.key, effective);
              const net = saved - dTrans - rent;
              const bcr = saved/Math.max(1, dTrans+rent);
              const d = decisions[e.key];
              return (
                <tr key={e.key}>
                  <td style={{...tdS, textAlign:"left"}}>
                    <span style={{display:"inline-block", width:8, height:8, background:e.color, marginRight:6, borderRadius:2}}/>
                    {e.name}
                  </td>
                  <td style={tdS}>{fmtP(CG.PROFILE[e.key].abShare)}</td>
                  <td style={tdS}>{d.energy.toFixed(1)}</td>
                  <td style={tdS}>{d.land.toFixed(1)}</td>
                  <td style={{...tdS, color:C.bad}}>−{fmtB(dTrans)}</td>
                  <td style={{...tdS, color:C.bad}}>−{fmtB(rent)}</td>
                  <td style={{...tdS, color:C.ok}}>+{fmtB(saved)}</td>
                  <td style={{...tdS, fontWeight:700, color: net>0?C.ok:C.bad}}>{net>=0?"+":""}{fmtB(net)}</td>
                  <td style={{...tdS, fontWeight:600}}>{bcr.toFixed(2)}:1</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Temperature trajectory under this coalition">
        <LineChart years={CG.YEARS} height={200} yLabel="°C" yRange={[1.5, 2.6]}
          annotate={[{y:1.86, label:"1.86°C target", color:C.accent}]}
          series={[{name:"Path", data:temp.T, color:"#1a1a1a", bold:true}]} legend/>
        <div style={{fontSize:12, color:C.dim, marginTop:8}}>
          Non-member blocs assumed at Low Ambition in unilateral/bilateral modes, and at their sliders in multilateral mode.
        </div>
      </Card>

      <Card title={`Defection sensitivity — which partners matter most to ${regionByKey(activeBloc).name}?`}>
        <div style={{fontSize:12, color:C.dim, marginBottom:8}}>
          If one partner drops to Low Ambition while others stay at current, how does {regionByKey(activeBloc).name}'s welfare shift? Shows strategic dependence.
        </div>
        <table style={tableS}>
          <thead><tr>
            <th style={{...thS,textAlign:"left"}}>If this bloc defects…</th>
            <th style={thS}>T(2065)</th><th style={thS}>{regionByKey(activeBloc).name} net welfare</th><th style={thS}>Δ vs current</th>
          </tr></thead>
          <tbody>
            {defection.map(d => (
              <tr key={d.key}>
                <td style={{...tdS,textAlign:"left"}}>
                  <span style={{display:"inline-block",width:8,height:8,background:d.color,marginRight:6,borderRadius:2}}/>
                  {d.name}
                </td>
                <td style={tdS}>{fmtT(d.T)}</td>
                <td style={{...tdS, fontWeight:600, color:d.net>0?C.ok:C.bad}}>{d.net>=0?"+":""}${fmtB(d.net)}</td>
                <td style={{...tdS, fontWeight:700, color: d.deltaNet<0?C.bad:C.ok}}>{d.deltaNet>=0?"+":""}${fmtB(d.deltaNet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function EquationsPanel() {
  return (
    <div>
      <Card title="1 · Temperature equation (TCRE)">
        <Eq>
          ΔT(t) = TCRE × Σ<sub>2025→t</sub> CO₂<sub>(all regions, energy + land use)</sub>
        </Eq>
        <Eq>
          T(t) = 1.50 °C + 0.56 °C × Cum CO₂(GtCO₂) / 1000
        </Eq>
        <P>TCRE = 0.56 °C per 1000 GtCO₂ (IPCC AR6 central estimate). Baseline 2025 warming = 1.50 °C (Copernicus/ERA5). 1.8°C carbon budget from 2025 = 536 GtCO₂.</P>
      </Card>

      <Card title="2 · Emissions by bloc and scenario">
        <P>For each bloc r and scenario s ∈ {"{L, M, H}"}, the workbook provides yearly electricity-sector CO₂ E(r,s,t), land-use CO₂ flux LU(r,s,t), and a residual CO₂ stream R(r,s,t) (transport, industry process, buildings, non-CO₂ GHG in CO₂e) at 2025…2065 in 5-year steps.</P>
        <P>Continuous ambition index x ∈ [0,2] is interpolated piecewise-linear between scenarios:</P>
        <Eq>
          E(r, x, t) = L + (M−L)·x                            , if 0 ≤ x ≤ 1<br/>
          E(r, x, t) = M + (H−M)·(x−1)                        , if 1 &lt; x ≤ 2
        </Eq>
        <P><b>Residual calibration:</b> per-bloc residual totals are allocated by abatement share and set so global cumulative totals over 2025–65 reproduce the canonical temperature endpoints — 1,768 GtCO₂ under all-Low (→ 2.49°C) and 643 GtCO₂ under Grand-Coalition-High (→ 1.86°C). This treats hard-to-decarbonise residual sectors explicitly rather than folding them into electricity.</P>
      </Card>

      <Card title="3 · Energy transition cost (Components A + B + C)">
        <Eq>Cost<sub>trans</sub>(r, x, t) = Component A + Component B + Component C</Eq>
        <P><b>A · Electricity system.</b> LCOE × TWh: capital + fuel + fixed O&M. Critically sensitive to WACC. Same solar panel costs $22/MWh at Europe's 5.5% WACC but $51/MWh at India's 10% and $67/MWh at Africa's 14%.</P>
        <P><b>B · Grid integration adder.</b> Rises from ~$3/MWh at &lt;20% VRE to $30–40/MWh at near-full decarbonisation — storage, HVDC, backup, frequency regulation.</P>
        <P><b>C · Hard-to-abate premium.</b> Green steel (DRI-H₂) $120→$40/t; cement CCS $95→$25/t; ammonia $350→$100/t; SAF $500→$150/t; green shipping $200→$50/t. Falls from ~8% to ~1% of output value by 2065.</P>
        <P>Cumulative (trapezoidal, 5-year step): Cum = Σᵢ ½(Cᵢ+Cᵢ₊₁)·5</P>
      </Card>

      <Card title="4 · Fossil fuel rent loss (Component D)">
        <Eq>Rent(r, s) = (Price − Cost(r)) × Production(r, s)</Eq>
        <Eq>Production(r, s) = Production(r, L) × [Global Demand(f, s) / Global Demand(f, L)]</Eq>
        <Eq>Rent Loss(r, s) = (Price − Cost(r)) × [Production(r, L) − Production(r, s)]</Eq>
        <P><b>Equiproportional rule:</b> every producer's output scales down by the same % as the global demand decline. Price held at $75/bbl (OPEC-stabilized assumption).</P>
        <P><b>Depletion adjustment:</b> regions with R/P &gt; 40 years receive no adjustment (GCC 67 yr: 100% counted); shorter R/P receives partial adjustment. Russia 53%; Africa 42%; Latin America 52%.</P>
        <P><b>Unilateral mode:</b> rent loss is scaled by own ambition only — GCC $652bn, Russia $71bn, Africa $64bn, Latin America $25bn cumulative at High.</P>
        <P><b>Coalition / multilateral mode:</b> each producer's rent loss is interpolated between CG.RENT_CUM[L] and CG.RENT_CUM[H] by the <i>coalition-weighted average ambition</i> μ = Σ share_r · x_r / 2. At μ=1 the full Grand-Coalition loss applies: GCC $13.4tn, Russia $2.17tn, Africa $1.17tn, Latin America $1.14tn, China $0.52tn, India $0.04tn.</P>
      </Card>

      <Card title="5 · Climate damage function">
        <Eq>Adaptation: A(r,T) = α(r) · T² · GDP(r)</Eq>
        <Eq>Residual Loss & Damage: R(r,T) = φ(r) · β(r) · T² · GDP(r)</Eq>
        <P>β = gross damage sensitivity (% GDP per °C²). φ = residual unavoidable fraction after adaptation. α = adaptation coefficient.</P>
        <P>Africa: β = 1.10 %/°C², φ = 0.85 (85% unavoidable). Russia: β = 0.18, φ = 0.58 (cold-country benefit). India: β = 0.90, φ = 0.78. Europe β = 0.22.</P>
        <Eq>Expected tipping losses: E[Tip](r,T) = 0.40 · Σᵢ Pᵢ(T) · Lᵢ(r) · CumGDP(r)</Eq>
        <P>Five tipping points: Coral (T_mid 1.8°C, P_max 90%), Permafrost (2.0°C, 80%), Ice sheet (2.2°C, 65%), Amazon (3.0°C, 65%), AMOC (3.0°C, 50%). This tool uses logistic P(T) = P_max / (1 + exp(−3·(T − T_mid))).</P>
        <P><b>Calibration factor 0.40:</b> applied to tipping totals so per-bloc Grand-Coalition damage-avoidance reproduces the canonical delegation-report values (within ±25%). Smooth + tipping + adaptation components sum to total climate damage used in welfare.</P>
      </Card>

      <Card title="6 · Land-use lever">
        <P>Current global deforestation ≈ 3–5 GtCO₂/yr. Ending deforestation + reforestation saves ~100 GtCO₂ cumulatively 2025–65. High energy ambition alone overshoots 1.8°C budget by 97 GtCO₂ — land use closes the gap.</P>
        <P>Workbook values: Low LU = +116 GtCO₂ net; Medium = −85 GtCO₂; High = −223 GtCO₂ (net sink). Latin America, Africa, ASEAN are the material blocs.</P>
      </Card>

      <Card title="7 · Strategic tests">
        <P><b>Unilateral rational:</b> own damage avoided ≥ own (transition + unilateral rent). Passes for China, India, ASEAN when tipping is included.</P>
        <P><b>Social cost-effective:</b> <i>global</i> damage avoided ≥ own cost. Passes for every bloc (BCR ≥ 1.5:1).</P>
        <P><b>All-better-off coalition:</b> requires fund transfers. Minimal viable 80% coalition = China + India + NAm + ASEAN + Africa (80.4% share, T ≈ 1.98°C). Add Europe for 86.7% and legitimacy.</P>
        <Eq>
          Coverage = Σ<sub>r ∈ coalition, x<sub>r</sub> ≥ "near-High"</sub> Share<sub>r</sub>  ≥  80%
        </Eq>
      </Card>

      <Card title="8 · Assumptions & sources">
        <ul style={{fontSize:12, lineHeight:1.7, marginTop:0, paddingLeft:18}}>
          <li>Baseline warming 1.50 °C (2025), Copernicus/ERA5.</li>
          <li>Yearly series at 5-year steps; all integrals trapezoidal.</li>
          <li>Oil market price fixed at $75/bbl; OPEC stabilizes.</li>
          <li>Non-CO₂ GHG and aerosol forcing: folded into the residual emissions stream in CO₂e.</li>
          <li>Tipping probabilities are calibrated to workbook endpoints (Low 2.49°C → High 1.86°C); functional form logistic with tipping-loss calibration factor 0.40.</li>
          <li>All figures $2025 PPP; GDP series from workbook Sheet 1.</li>
          <li>Interpolation between Low/Medium/High scenarios is piecewise linear in ambition index x ∈ [0,2].</li>
          <li>Rent loss uses unilateral Sheet 8 v4 correction in uni/bi mode; coalition-weighted interpolation (CG.RENT_CUM L↔H) in multilateral mode.</li>
          <li>Welfare numbers reproduce canonical 5-path simulation results within ±25% across all 9 blocs.</li>
          <li>Strategic reports produced for each bloc (Oct 2025) are the source of canonical welfare, coverage, and 5-path benchmark values.</li>
        </ul>
      </Card>
    </div>
  );
}

function Eq({children}) {
  return <div style={{fontFamily:"ui-monospace, Menlo, monospace", fontSize:12.5, background:"#fbf7ec", border:`1px solid ${C.line}`, borderRadius:4, padding:"8px 12px", margin:"8px 0"}}>{children}</div>;
}
function P({children}) {
  return <p style={{fontSize:12.5, lineHeight:1.6, color:C.ink, margin:"8px 0"}}>{children}</p>;
}

export default App;
