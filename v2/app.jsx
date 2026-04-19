// Main app — binary coalition model with alpha sliders and fund inputs
import React from 'react';
import CG from './engine.js';
import { fmtB, fmtT, fmtP, fmtGt, regionByKey, C, Bar, LineChart, AlphaSlider } from './ui.jsx';
const { useState: uS, useMemo: uM, useEffect: uE } = React;

function App() {
  const [alphas, setAlphas] = uS(() => CG.engine.defaultAlphas(0.5));
  const [funds, setFunds] = uS(() => CG.engine.defaultFunds());
  const [manualOverride, setManualOverride] = uS(null); // null = auto-Nash, object = manual membership
  const [selectedBloc, setSelectedBloc] = uS("GCC");
  const [tab, setTab] = uS("simulator");
  const [expandedBloc, setExpandedBloc] = uS(null);

  // Membership: auto-solve Nash from alphas+funds, unless manually overridden
  const nashMembership = uM(() => CG.engine.solveNash(alphas, funds), [alphas, funds]);
  const membership = manualOverride || nashMembership;

  // Core computation — depends on membership AND funds
  const outcome = uM(() => CG.engine.computeOutcome(membership, funds), [membership, funds]);
  const tempPath = uM(() => CG.engine.temperaturePath(outcome.T), [outcome.T]);
  const tipping = uM(() => CG.engine.tippingProbs(outcome.T), [outcome.T]);

  // Critical alphas for each bloc (given current membership & funds)
  const critAlphas = uM(() => {
    const ca = {};
    for (const r of CG.REGIONS) {
      ca[r.key] = CG.engine.criticalAlpha(r.key, membership, funds);
    }
    return ca;
  }, [membership, funds]);

  // Alpha-weighted objectives — depends on alphas + outcome
  // U_i(α) = α × U_global + (1-α) × U_regional_i
  const alphaObjs = uM(() => {
    const ao = {};
    for (const r of CG.REGIONS) {
      ao[r.key] = CG.engine.alphaObjective(r.key, alphas[r.key], outcome);
    }
    return ao;
  }, [alphas, outcome]);

  // Helpers
  const setAlpha = (k, v) => {
    setAlphas(a => ({...a, [k]: v}));
    setManualOverride(null); // alpha change → re-solve Nash
  };
  // Manual toggle creates an override; next alpha/fund change will clear it via Nash
  const toggleMembership = (k) => {
    const base = manualOverride || {...membership};
    setManualOverride({...base, [k]: !base[k]});
  };
  const setFund = (k, field, v) => {
    setFunds(f => ({...f, [k]: {...f[k], [field]: v}}));
    setManualOverride(null); // fund change → re-solve Nash
  };

  // Reset All IN: force all blocs IN (manual override)
  const resetAll = () => { setManualOverride(CG.engine.defaultMembership()); };
  // Use Nash: clear manual override, let Nash determine membership
  const useNash = () => { setManualOverride(null); };
  const loadIdealFunds = () => {
    const f = {};
    for (const r of CG.REGIONS) {
      f[r.key] = CG.IDEAL_FUNDS[r.key] ? {...CG.IDEAL_FUNDS[r.key]} : {ccf:0,af:0,ld:0,forest:0};
    }
    setFunds(f);
    setManualOverride(null); // re-solve Nash with new funds
  };

  const bloc = regionByKey(selectedBloc);
  const tempOK = outcome.T <= CG.T_TARGET + 0.02;
  const covOK = outcome.coverage >= 0.80;

  return (
    <div style={{minHeight:"100vh", background:C.bg, color:C.ink, fontFamily:"ui-sans-serif, -apple-system, system-ui, Helvetica"}}>
      {/* Header */}
      <div style={{borderBottom:`1px solid ${C.line}`, background:"#fffdf8", padding:"16px 28px", display:"flex", alignItems:"baseline", justifyContent:"space-between", flexWrap:"wrap", gap:16}}>
        <div>
          <div style={{fontSize:11, letterSpacing:".12em", color:C.dim, textTransform:"uppercase"}}>Climate Negotiation Game</div>
          <div style={{fontSize:22, fontWeight:700, marginTop:4}}>Coalition Simulator</div>
          <div style={{fontSize:12, color:C.dim, marginTop:4}}>
            Binary coalition model · 9 blocs · 2025-2065 · TCRE 0.56{"\u00B0"}C/1000 GtCO{"\u2082"}
          </div>
        </div>
        <div style={{display:"flex", gap:12, alignItems:"center", flexWrap:"wrap"}}>
          <div style={{padding:"6px 12px", background: tempOK?"#ecfdf5":"#fef2f2",
                       border:`1px solid ${tempOK?"#a7f3d0":"#fecaca"}`, borderRadius:6, fontSize:12}}>
            <b>T(2065)</b> {fmtT(outcome.T)} {tempOK? "\u2713 \u22641.86\u00B0C" : "\u2717 exceeds target"}
          </div>
          <div style={{padding:"6px 12px", background: covOK?"#ecfdf5":"#fff7ed",
                       border:`1px solid ${covOK?"#a7f3d0":"#fed7aa"}`, borderRadius:6, fontSize:12}}>
            <b>Coverage</b> {fmtP(outcome.coverage)} {covOK? "\u2713 \u226580%":"\u2717 <80%"}
          </div>
          <div style={{padding:"6px 12px", background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:6, fontSize:12}}>
            <b>Global net</b> ${fmtB(outcome.globalNet)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{padding:"0 28px", borderBottom:`1px solid ${C.line}`, display:"flex", gap:0, background:"#fffdf8"}}>
        {[
          ["simulator","Simulator"],
          ["alpha-spectrum","Alpha-Spectrum Analysis"],
          ["ideal-world","Ideal World"],
          ["model","Model & Assumptions"],
        ].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{padding:"12px 16px", fontSize:13, background:"transparent", cursor:"pointer",
                    border:"none", borderBottom: tab===k? `2px solid ${C.accent}`:"2px solid transparent",
                    color: tab===k? C.ink:C.dim, fontWeight: tab===k?600:500}}>{l}</button>
        ))}
      </div>

      <div style={{padding:"20px 28px", display:"grid", gridTemplateColumns:"380px 1fr", gap:20}}>
        {/* LEFT: controls */}
        <div>
          <Card title="Coalition Controls">
            <div style={{display:"flex", gap:6, marginBottom:10, flexWrap:"wrap"}}>
              <button onClick={resetAll} style={btnStyle}>Force All IN</button>
              <button onClick={useNash} style={{...btnStyle, background: !manualOverride?"#ecfdf5":"#fff7ed",
                border:`1px solid ${!manualOverride?C.ok:C.accent}`,
                color: !manualOverride?C.ok:C.accent, fontWeight:600}}>
                {!manualOverride? "\u2713 Auto Nash":"Restore Nash"}
              </button>
              <button onClick={loadIdealFunds} style={btnStyle}>Load Ideal Funds</button>
              <button onClick={()=>{setFunds(CG.engine.defaultFunds()); setManualOverride(null);}} style={btnStyle}>Clear Funds</button>
              <button onClick={()=>{setAlphas(CG.engine.defaultAlphas(0.5)); setManualOverride(null);}} style={btnStyle}>Reset {"\u03B1"}=0.5</button>
            </div>
            {manualOverride && (
              <div style={{fontSize:11, color:C.accent, marginBottom:6, padding:"4px 8px", background:"#fff7ed", borderRadius:4, border:`1px solid ${C.accent}`}}>
                Manual override active — IN/OUT set by hand. Click "Restore Nash" to let {"\u03B1"} values determine membership.
              </div>
            )}
            <div style={{fontSize:11, color:C.dim, marginBottom:8, lineHeight:1.5}}>
              <b>{"\u03B1"}</b> sliders control each bloc's preference (0=regional, 1=global). Nash equilibrium auto-solves: blocs with {"\u03B1"} {"<"} {"\u03B1"}<sub>crit</sub> defect (OUT).
              You can manually toggle IN/OUT to override. Fund inputs: <b>+contributes</b>, <b>−receives</b> ($bn cumulative).
            </div>
            {CG.REGIONS.map(r => (
              <BlocCard key={r.key} regionKey={r.key}
                membership={membership} alphas={alphas} funds={funds}
                critAlpha={critAlphas[r.key]} outcome={outcome}
                alphaObj={alphaObjs[r.key]}
                toggleMembership={toggleMembership} setAlpha={setAlpha} setFund={setFund}
                expanded={expandedBloc===r.key}
                onExpand={()=>setExpandedBloc(expandedBloc===r.key? null : r.key)}
                onSelect={()=>setSelectedBloc(r.key)}
                isSelected={selectedBloc===r.key}
              />
            ))}
          </Card>
        </div>

        {/* RIGHT: content */}
        <div>
          {tab === "simulator" && <SimulatorPanel outcome={outcome} tempPath={tempPath} tipping={tipping}
            selectedBloc={selectedBloc} setSelectedBloc={setSelectedBloc}
            membership={membership} funds={funds} alphas={alphas}
            critAlphas={critAlphas} alphaObjs={alphaObjs}/>}
          {tab === "alpha-spectrum" && <AlphaSpectrumPanel funds={funds} membership={membership}/>}
          {tab === "ideal-world" && <IdealWorldPanel membership={membership} setFunds={setFunds}/>}
          {tab === "model" && <ModelPanel/>}
        </div>
      </div>
    </div>
  );
}

// ─── Shared components ──────────────────────────────────────────────
const btnStyle = {padding:"6px 10px", fontSize:11, background:"#fff", border:`1px solid ${C.line}`, borderRadius:4, cursor:"pointer", color:C.ink};
const tableS = {width:"100%", borderCollapse:"collapse", fontSize:12, fontVariantNumeric:"tabular-nums"};
const thS = {textAlign:"right", padding:"6px 8px", borderBottom:`1px solid ${C.line}`, fontWeight:600, color:C.dim, fontSize:11};
const tdS = {textAlign:"right", padding:"5px 8px", borderBottom:`1px solid ${C.line}`};

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

function Kpi({title, value, sub, ok, bad}) {
  return (
    <div style={{background:C.card, border:`1px solid ${C.line}`, borderRadius:6, padding:"10px 12px"}}>
      <div style={{fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:".06em"}}>{title}</div>
      <div style={{fontSize:20, fontWeight:700, marginTop:3, color: ok?C.ok: bad?C.bad: C.ink}}>{value}</div>
      <div style={{fontSize:11, color:C.dim, marginTop:2}}>{sub}</div>
    </div>
  );
}

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

function Eq({children}) {
  return <div style={{fontFamily:"ui-monospace, Menlo, monospace", fontSize:12.5, background:"#fbf7ec", border:`1px solid ${C.line}`, borderRadius:4, padding:"8px 12px", margin:"8px 0"}}>{children}</div>;
}
function P({children}) {
  return <p style={{fontSize:12.5, lineHeight:1.6, color:C.ink, margin:"8px 0"}}>{children}</p>;
}

// ─── Bloc Card (left panel) ─────────────────────────────────────────
function BlocCard({regionKey, membership, alphas, funds, critAlpha, outcome, alphaObj,
                   toggleMembership, setAlpha, setFund, expanded, onExpand, onSelect, isSelected}) {
  const r = regionByKey(regionKey);
  const isIn = membership[regionKey];
  const b = outcome.blocs[regionKey];
  const alpha = alphas[regionKey];
  const f = funds[regionKey];

  return (
    <div style={{padding:"8px 0", borderTop:`1px dashed ${C.line}`, background: isSelected?"#fbf7ec":"transparent"}}>
      <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:4}}>
        <div style={{width:10, height:10, borderRadius:2, background:r.color, cursor:"pointer"}} onClick={onSelect}/>
        <span style={{fontWeight:isSelected?700:500, fontSize:12, cursor:"pointer", flex:1}} onClick={onSelect}>{r.name}</span>
        <button onClick={()=>toggleMembership(regionKey)}
          style={{padding:"2px 8px", fontSize:10, borderRadius:3, cursor:"pointer",
                  border:`1px solid ${isIn? C.ok: C.bad}`,
                  background: isIn? "#ecfdf5":"#fef2f2",
                  color: isIn? C.ok: C.bad, fontWeight:600}}>
          {isIn? "IN":"OUT"}
        </button>
        <span style={{fontSize:10, color:C.dim, fontVariantNumeric:"tabular-nums", minWidth:60, textAlign:"right"}}
              title={`Regional W=${fmtB(b.net)}, U(α)=${fmtB(alphaObj)}`}>
          U{"\u2093"} {alphaObj>=0?"+":""}{fmtB(alphaObj)}
        </span>
      </div>
      <div style={{paddingLeft:16}}>
        <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:2}}>
          <span style={{fontSize:10, color:C.dim, width:14}}>{"\u03B1"}</span>
          <input type="range" min="0" max="1" step="0.01" value={alpha}
                 onChange={e=>setAlpha(regionKey, parseFloat(e.target.value))}
                 style={{flex:1, accentColor:C.accent, height:14}}/>
          <span style={{fontSize:10, fontVariantNumeric:"tabular-nums", color:C.ink, width:28}}>{alpha.toFixed(2)}</span>
          <span style={{fontSize:9, color: critAlpha<10 ? (alpha>=critAlpha? C.ok : C.bad) : C.dim}}>
            {"\u03B1"}<sub>c</sub>={critAlpha<10? critAlpha.toFixed(2):"n/a"}
            {critAlpha<10 && critAlpha>0 && <span> {alpha>=critAlpha? "\u2713":"\u2717"}</span>}
          </span>
        </div>
        {/* Inline welfare summary — shows how alpha blends regional/global */}
        <div style={{fontSize:9, color:C.dim, marginBottom:2}}>
          W<sub>reg</sub>={b.net>=0?"+":""}{fmtB(b.net)} · W<sub>global</sub>={outcome.globalNet>=0?"+":""}{fmtB(outcome.globalNet)}
        </div>
        <div style={{fontSize:9, color:C.dim, cursor:"pointer", userSelect:"none"}} onClick={onExpand}>
          {expanded? "\u25BC":"▶"} Funds {f.ccf||f.af||f.ld||f.forest? `(net ${fmtB((f.ccf||0)+(f.af||0)+(f.ld||0)+(f.forest||0))})` : "(click to set)"}
        </div>
        {expanded && (
          <div style={{marginTop:4, paddingLeft:14}}>
            {[["ccf","CCF"],["af","Adapt"],["ld","L&D"],["forest","Forest"]].map(([field,label])=>(
              <div key={field} style={{display:"flex", alignItems:"center", gap:4, marginBottom:2}}>
                <span style={{fontSize:10, color:C.dim, width:40}}>{label}</span>
                <input type="number" value={f[field]} step={100}
                       onChange={e=>setFund(regionKey, field, parseFloat(e.target.value)||0)}
                       style={{width:70, fontSize:11, padding:"2px 4px", border:`1px solid ${C.line}`, borderRadius:3, textAlign:"right"}}/>
                <span style={{fontSize:9, color:C.dim}}>$bn</span>
              </div>
            ))}
            <div style={{fontSize:9, color:C.dim, marginTop:2}}>
              + = contributes, – = receives
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Simulator Panel ────────────────────────────────────────────────
function SimulatorPanel({outcome, tempPath, tipping, selectedBloc, setSelectedBloc,
                         membership, funds, alphas, critAlphas, alphaObjs}) {
  const yr = CG.YEARS;
  const b = outcome.blocs[selectedBloc];
  const bloc = regionByKey(selectedBloc);
  const selAlpha = alphas[selectedBloc];
  const selAlphaObj = alphaObjs[selectedBloc];

  // Per-year series for selected bloc
  const damSeries = uM(() => CG.engine.damageSeries(selectedBloc, outcome.T), [selectedBloc, outcome.T]);
  const damLowSeries = uM(() => CG.engine.damageSeries(selectedBloc, CG.T_LOW), [selectedBloc]);
  const transCur = uM(() => CG.engine.transSeries(selectedBloc, b.isIn), [selectedBloc, b.isIn]);
  const transLow = uM(() => CG.engine.transSeries(selectedBloc, false), [selectedBloc]);

  return (
    <div>
      {/* KPI strip */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:14}}>
        <Kpi title="Temperature T(2065)" value={fmtT(outcome.T)} sub={outcome.T<=CG.T_TARGET+0.02? "Meets 1.86\u00B0C target":"Exceeds target"} ok={outcome.T<=CG.T_TARGET+0.02} bad={outcome.T>CG.T_TARGET+0.02}/>
        <Kpi title="Coalition coverage" value={fmtP(outcome.coverage)} sub={`${CG.REGIONS.filter(r=>membership[r.key]).length}/9 blocs IN`} ok={outcome.coverage>=0.80}/>
        <Kpi title="Global net welfare" value={"$"+fmtB(outcome.globalNet)} sub={`Saved $${fmtB(outcome.globalDamSaved)}`} ok={outcome.globalNet>0} bad={outcome.globalNet<0}/>
        <Kpi title={`${bloc.name} W\u1D62 (regional)`} value={"$"+fmtB(b.net)} sub={b.isIn?"IN coalition":"OUT"} ok={b.net>0} bad={b.net<0}/>
        <Kpi title={`${bloc.name} U\u1D62(\u03B1=${selAlpha.toFixed(2)})`} value={"$"+fmtB(selAlphaObj)}
             sub={`\u03B1\u00D7Global + (1-\u03B1)\u00D7Regional`}
             ok={selAlphaObj>0} bad={selAlphaObj<0}/>
      </div>

      {/* Per-bloc welfare table */}
      <Card title="All Blocs — Welfare Breakdown (cumulative $bn, 2025-2065)">
        <div style={{fontSize:11, color:C.dim, marginBottom:6}}>
          U({"\u03B1"}) = {"\u03B1"} {"\u00D7"} W<sub>global</sub> + (1-{"\u03B1"}) {"\u00D7"} W<sub>regional</sub>. Moving {"\u03B1"} sliders updates the U({"\u03B1"}) column live. Fund changes update all columns.
        </div>
        <div style={{overflowX:"auto"}}>
        <table style={tableS}>
          <thead><tr>
            <th style={{...thS, textAlign:"left"}}>Bloc</th>
            <th style={thS}>Status</th>
            <th style={thS}>{"\u03B1"}</th>
            <th style={thS}>{"\u03B1"}<sub>crit</sub></th>
            <th style={thS}>Trans cost</th>
            <th style={thS}>Rent loss</th>
            <th style={thS}>Dam saved</th>
            <th style={thS}>Fund net</th>
            <th style={thS}>W<sub>i</sub> (regional)</th>
            <th style={{...thS, background:"#f5efe3"}}>U<sub>i</sub>({"\u03B1"})</th>
          </tr></thead>
          <tbody>
            {CG.REGIONS.map(r => {
              const rb = outcome.blocs[r.key];
              const ca = critAlphas[r.key];
              const al = alphas[r.key];
              const uAlpha = alphaObjs[r.key];
              const wouldJoin = ca <= 0 || al >= ca;
              return (
                <tr key={r.key} style={{background: selectedBloc===r.key? "#fbf7ec":"transparent", cursor:"pointer"}}
                    onClick={()=>setSelectedBloc(r.key)}>
                  <td style={{...tdS, textAlign:"left"}}>
                    <span style={{display:"inline-block",width:8,height:8,background:r.color,marginRight:6,borderRadius:2}}/>
                    {r.name}
                  </td>
                  <td style={{...tdS, color:rb.isIn?C.ok:C.bad, fontWeight:600}}>{rb.isIn?"IN":"OUT"}</td>
                  <td style={{...tdS, fontSize:11}}>{al.toFixed(2)}</td>
                  <td style={{...tdS, color: wouldJoin?C.ok:C.bad}}>
                    {ca<10? ca.toFixed(2):"n/a"}
                    <span style={{marginLeft:2}}>{wouldJoin?"\u2713":"\u2717"}</span>
                  </td>
                  <td style={{...tdS, color:rb.transIncr>0?C.bad:C.dim}}>{rb.transIncr>0? "-"+fmtB(rb.transIncr):"0"}</td>
                  <td style={{...tdS, color:rb.rent>0?C.bad:C.dim}}>{rb.rent>0? "-"+fmtB(rb.rent):"0"}</td>
                  <td style={{...tdS, color:C.ok}}>+{fmtB(rb.damSaved)}</td>
                  <td style={{...tdS, color:rb.netFund>0?C.bad:rb.netFund<0?C.ok:C.dim}}>
                    {rb.netFund===0? "0" : (rb.netFund>0?"-":"+")+fmtB(Math.abs(rb.netFund))}
                  </td>
                  <td style={{...tdS, fontWeight:600, color:rb.net>0?C.ok:C.bad}}>{rb.net>=0?"+":""}{fmtB(rb.net)}</td>
                  <td style={{...tdS, fontWeight:700, color:uAlpha>0?C.ok:C.bad, background:"#fbf7ec"}}>
                    {uAlpha>=0?"+":""}{fmtB(uAlpha)}
                  </td>
                </tr>
              );
            })}
            <tr style={{background:"#f5efe3"}}>
              <td style={{...tdS, textAlign:"left", fontWeight:700}}>GLOBAL</td>
              <td style={tdS}></td><td style={tdS}></td><td style={tdS}></td>
              <td style={{...tdS, fontWeight:700, color:C.bad}}>-{fmtB(outcome.globalTrans)}</td>
              <td style={{...tdS, fontWeight:700, color:C.bad}}>-{fmtB(outcome.globalRent)}</td>
              <td style={{...tdS, fontWeight:700, color:C.ok}}>+{fmtB(outcome.globalDamSaved)}</td>
              <td style={{...tdS, fontWeight:700}}>{outcome.globalFund===0?"0":fmtB(outcome.globalFund)}</td>
              <td style={{...tdS, fontWeight:700, color:outcome.globalNet>0?C.ok:C.bad}}>{outcome.globalNet>=0?"+":""}{fmtB(outcome.globalNet)}</td>
              <td style={{...tdS, fontWeight:700, background:"#fbf7ec"}}></td>
            </tr>
          </tbody>
        </table>
        </div>
      </Card>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        {/* Temperature chart */}
        <Card title="Temperature path (\u00B0C)">
          <LineChart years={yr} height={180} yLabel={"\u00B0C"} yRange={[1.5, 2.6]}
            annotate={[{y:1.86, label:"1.86\u00B0C target", color:C.accent}, {y:2.0, label:"2.0\u00B0C", color:C.dim}]}
            series={[{name:"Current path", data:tempPath, color:"#1a1a1a", bold:true}]} legend/>
        </Card>

        {/* Tipping probabilities */}
        <Card title={`Tipping-point probabilities at ${fmtT(outcome.T)}`}>
          <div style={{fontSize:12}}>
            {tipping.map((t,i) => (
              <div key={i} style={{display:"flex", alignItems:"center", gap:8, padding:"4px 0", borderBottom:`1px dashed ${C.line}`}}>
                <span style={{flex:1, color:C.dim}}>{t.name} (T*={t.Tstar}°C)</span>
                <Bar v={t.p} max={1} color={t.p>0.5?C.bad:t.p>0.2?C.warn:C.ok} w={80}/>
                <span style={{fontVariantNumeric:"tabular-nums", fontWeight:600, minWidth:40, textAlign:"right",
                              color:t.p>0.5?C.bad:t.p>0.2?C.warn:C.ok}}>{fmtP(t.p)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Selected bloc detail */}
      <Card title={`${bloc.name} — Per-5-year cost ledger ($bn/yr)`}>
        <div style={{overflowX:"auto"}}>
        <table style={tableS}>
          <thead><tr>
            <th style={{...thS,textAlign:"left"}}>Item</th>
            {yr.map(y=><th key={y} style={thS}>{y}</th>)}
            <th style={{...thS, background:"#f5efe3"}}>Cum</th>
          </tr></thead>
          <tbody>
            <Tr label="Transition cost" row={transCur} cum={CG.engine.cumTrap(transCur)}/>
            <Tr label="Transition cost (Low baseline)" row={transLow} cum={CG.engine.cumTrap(transLow)}/>
            <Tr label="Climate damage (current T)" row={damSeries} cum={CG.engine.cumTrap(damSeries)}/>
            <Tr label="Climate damage (Low T)" row={damLowSeries} cum={CG.engine.cumTrap(damLowSeries)}/>
            <Tr label="Damage saved vs Low" row={damLowSeries.map((d,i)=>d-damSeries[i])} cum={b.damSaved} ok/>
          </tbody>
        </table>
        </div>
        <div style={{marginTop:10, display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, fontSize:11}}>
          <div><span style={{color:C.dim}}>Trans incr:</span> <b style={{color:C.bad}}>-${fmtB(b.transIncr)}</b></div>
          <div><span style={{color:C.dim}}>Rent loss:</span> <b style={{color:C.bad}}>-${fmtB(b.rent)}</b></div>
          <div><span style={{color:C.dim}}>Fund net:</span> <b style={{color:b.netFund>0?C.bad:b.netFund<0?C.ok:C.dim}}>{b.netFund>0?"-":"+"}{fmtB(Math.abs(b.netFund))}</b></div>
          <div><span style={{color:C.dim}}>W<sub>i</sub>:</span> <b style={{color:b.net>0?C.ok:C.bad}}>{b.net>=0?"+":""}${fmtB(b.net)}</b></div>
          <div><span style={{color:C.dim}}>U<sub>i</sub>({"\u03B1"}):</span> <b style={{color:selAlphaObj>0?C.ok:C.bad}}>{selAlphaObj>=0?"+":""}${fmtB(selAlphaObj)}</b></div>
        </div>
      </Card>

      {/* Charts */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        <Card title={`${bloc.name} — Damage trajectory ($bn/yr)`}>
          <LineChart years={yr} height={180} yLabel="$bn/yr" legend
            series={[
              {name:"At current T", data:damSeries, color:bloc.color, bold:true},
              {name:"At Low T (2.49\u00B0C)", data:damLowSeries, color:C.low, dashed:true},
            ]}/>
        </Card>
        <Card title={`${bloc.name} — Transition cost ($bn/yr)`}>
          <LineChart years={yr} height={180} yLabel="$bn/yr" legend
            series={[
              {name: b.isIn?"High (IN)":"Low (OUT)", data:transCur, color:bloc.color, bold:true},
              {name:"Low baseline", data:transLow, color:C.low, dashed:true},
            ]}/>
        </Card>
      </div>

      {/* Canonical benchmark */}
      <Card title="Canonical Grand Coalition benchmark">
        <div style={{fontSize:11, color:C.dim, marginBottom:8}}>Reference values from the delegation strategy reports.</div>
        <table style={tableS}>
          <thead><tr>
            <th style={{...thS,textAlign:"left"}}>Bloc</th>
            <th style={thS}>Trans $bn</th><th style={thS}>Rent $bn</th>
            <th style={thS}>Saved $bn</th><th style={thS}>Net $bn</th>
          </tr></thead>
          <tbody>
            {CG.REGIONS.map(r => {
              const c = CG.CANONICAL[r.key];
              return (
                <tr key={r.key}>
                  <td style={{...tdS,textAlign:"left"}}><span style={{display:"inline-block",width:8,height:8,background:r.color,marginRight:6,borderRadius:2}}/>{r.name}</td>
                  <td style={tdS}>{fmtB(c.trans)}</td>
                  <td style={tdS}>{fmtB(c.rent)}</td>
                  <td style={{...tdS,color:C.ok}}>+{fmtB(c.saved)}</td>
                  <td style={{...tdS,fontWeight:700,color:c.net>0?C.ok:C.bad}}>{c.net>=0?"+":""}{fmtB(c.net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Alpha-Spectrum Panel ───────────────────────────────────────────
function AlphaSpectrumPanel({funds, membership}) {
  const spectrum = uM(() => CG.engine.alphaSpectrum(funds, 20), [funds]);

  // Critical alphas with all others IN (for reference)
  const critAllIn = uM(() => {
    const allIn = CG.engine.defaultMembership();
    const ca = {};
    for (const r of CG.REGIONS) {
      ca[r.key] = CG.engine.criticalAlpha(r.key, allIn, funds);
    }
    return ca;
  }, [funds]);

  // Also compute with current membership
  const critCurrent = uM(() => {
    const ca = {};
    for (const r of CG.REGIONS) {
      ca[r.key] = CG.engine.criticalAlpha(r.key, membership, funds);
    }
    return ca;
  }, [membership, funds]);

  return (
    <div>
      <Card title="Critical Alpha Values">
        <P>The <b>critical alpha ({"\u03B1"}<sub>crit</sub>)</b> is the minimum weight on global welfare needed for a bloc to prefer joining the coalition. Below this alpha, the bloc defects.</P>
        <P><b>{"\u03B1"} = 0</b>: purely regional interest. <b>{"\u03B1"} = 1</b>: fully global interest. A bloc with {"\u03B1"} {">"} {"\u03B1"}<sub>crit</sub> stays IN.</P>
        <table style={tableS}>
          <thead><tr>
            <th style={{...thS,textAlign:"left"}}>Bloc</th>
            <th style={thS}>{"\u03B1"}<sub>crit</sub> (all others IN)</th>
            <th style={thS}>{"\u03B1"}<sub>crit</sub> (current config)</th>
            <th style={thS}>Status</th>
            <th style={thS}>Interpretation</th>
          </tr></thead>
          <tbody>
            {CG.REGIONS.map(r => {
              const ca = critAllIn[r.key];
              const cc = critCurrent[r.key];
              const interp = ca <= 0 ? "Always joins (net positive regionally)"
                           : ca >= 1 ? "Needs compensation (never joins alone)"
                           : `Joins if \u03B1 \u2265 ${ca.toFixed(2)}`;
              return (
                <tr key={r.key}>
                  <td style={{...tdS,textAlign:"left"}}><span style={{display:"inline-block",width:8,height:8,background:r.color,marginRight:6,borderRadius:2}}/>{r.name}</td>
                  <td style={{...tdS, fontWeight:600}}>{ca<10? ca.toFixed(3):"n/a"}</td>
                  <td style={tdS}>{cc<10? cc.toFixed(3):"n/a"}</td>
                  <td style={{...tdS, color:ca<=0?C.ok:ca>=1?C.bad:C.warn}}>{ca<=0?"\u2713 Voluntary":ca>=1?"\u2717 Needs aid":"Conditional"}</td>
                  <td style={{...tdS, textAlign:"left", fontSize:11, color:C.dim}}>{interp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title={`Alpha Spectrum — Nash equilibrium as \u03B1 sweeps 0\u21921`}>
        <P>Each row shows the Nash equilibrium when all blocs share the same {"\u03B1"} value. This reveals which blocs are the first to defect at low cooperation levels and which join only at high {"\u03B1"}.</P>
        <table style={tableS}>
          <thead><tr>
            <th style={{...thS,textAlign:"left"}}>{"\u03B1"}</th>
            {CG.REGIONS.map(r=><th key={r.key} style={{...thS,fontSize:10}}>{r.name.slice(0,3)}</th>)}
            <th style={thS}>Coverage</th>
            <th style={thS}>T(2065)</th>
            <th style={thS}>Global net</th>
          </tr></thead>
          <tbody>
            {spectrum.map((s,i) => (
              <tr key={i}>
                <td style={{...tdS,textAlign:"left", fontWeight:600}}>{s.alpha.toFixed(2)}</td>
                {CG.REGIONS.map(r=>(
                  <td key={r.key} style={{...tdS, textAlign:"center"}}>
                    <span style={{display:"inline-block", width:10, height:10, borderRadius:2,
                                  background: s.membership[r.key]? r.color:"#e5e7eb"}}/>
                  </td>
                ))}
                <td style={tdS}>{fmtP(s.coverage)}</td>
                <td style={{...tdS, color:s.T<=1.88?C.ok:s.T<=2.0?C.warn:C.bad}}>{fmtT(s.T)}</td>
                <td style={{...tdS, fontWeight:600, color:s.globalNet>0?C.ok:C.bad}}>{s.globalNet>=0?"+":""}${fmtB(s.globalNet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Coverage vs Alpha">
        <LineChart years={spectrum.map(s=>s.alpha.toFixed(2))} height={200} yLabel="Coverage %"
          yRange={[0, 100]}
          annotate={[{y:80, label:"80% threshold", color:C.accent}]}
          series={[{name:"Coverage", data:spectrum.map(s=>s.coverage*100), color:C.ink, bold:true}]}
          legend/>
        <div style={{fontSize:11, color:C.dim, marginTop:4}}>x-axis: {"\u03B1"} (0 = regional, 1 = global). Fund configuration: {Object.values(funds).some(f=>f.ccf||f.af||f.ld||f.forest)? "Custom funds active":"No funds"}</div>
      </Card>
    </div>
  );
}

// ─── Ideal World Panel ──────────────────────────────────────────────
function IdealWorldPanel({membership, setFunds}) {
  // Compute outcome with ideal funds
  const idealOutcome = uM(() => {
    const allIn = CG.engine.defaultMembership();
    const f = {};
    for (const r of CG.REGIONS) f[r.key] = CG.IDEAL_FUNDS[r.key]? {...CG.IDEAL_FUNDS[r.key]}:{ccf:0,af:0,ld:0,forest:0};
    return CG.engine.computeOutcome(allIn, f);
  }, []);

  const noFundOutcome = uM(() => {
    const allIn = CG.engine.defaultMembership();
    return CG.engine.computeOutcome(allIn, CG.engine.defaultFunds());
  }, []);

  const applyIdeal = () => {
    const f = {};
    for (const r of CG.REGIONS) f[r.key] = CG.IDEAL_FUNDS[r.key]? {...CG.IDEAL_FUNDS[r.key]}:{ccf:0,af:0,ld:0,forest:0};
    setFunds(f);
  };

  return (
    <div>
      <Card title="Ideal World — Fund Allocations">
        <P>The <b>Ideal World</b> shows optimal fund allocations that make the Grand Coalition stable for all blocs. Positive values = contributions, negative values = receipts ($bn cumulative 2025-2065).</P>
        <P>Funds work as direct welfare transfers: contributors pay into the fund (reducing their net welfare), recipients receive from the fund (increasing their net welfare). The Forest fund additionally reduces global temperature through avoided deforestation and reforestation.</P>
        <button onClick={applyIdeal} style={{...btnStyle, marginBottom:12, background:"#fff7ed", border:`1px solid ${C.accent}`, color:C.accent, fontWeight:600}}>Apply ideal funds to simulator</button>
        <div style={{overflowX:"auto"}}>
        <table style={tableS}>
          <thead><tr>
            <th style={{...thS,textAlign:"left"}}>Bloc</th>
            <th style={thS}>CCF</th>
            <th style={thS}>Adapt</th>
            <th style={thS}>L&D</th>
            <th style={thS}>Forest</th>
            <th style={thS}>Net transfer</th>
            <th style={thS}>Welfare (no funds)</th>
            <th style={thS}>Welfare (w/ funds)</th>
            <th style={thS}>{"\u0394"}</th>
          </tr></thead>
          <tbody>
            {CG.REGIONS.map(r => {
              const f = CG.IDEAL_FUNDS[r.key] || {ccf:0,af:0,ld:0,forest:0};
              const netTransfer = f.ccf + f.af + f.ld + f.forest;
              const noFund = noFundOutcome.blocs[r.key].net;
              const wFund = idealOutcome.blocs[r.key].net;
              return (
                <tr key={r.key}>
                  <td style={{...tdS,textAlign:"left"}}><span style={{display:"inline-block",width:8,height:8,background:r.color,marginRight:6,borderRadius:2}}/>{r.name}</td>
                  <td style={{...tdS, color:f.ccf>0?C.bad:f.ccf<0?C.ok:C.dim}}>{f.ccf||"0"}</td>
                  <td style={{...tdS, color:f.af>0?C.bad:f.af<0?C.ok:C.dim}}>{f.af||"0"}</td>
                  <td style={{...tdS, color:f.ld>0?C.bad:f.ld<0?C.ok:C.dim}}>{f.ld||"0"}</td>
                  <td style={{...tdS, color:f.forest>0?C.bad:f.forest<0?C.ok:C.dim}}>{f.forest||"0"}</td>
                  <td style={{...tdS, fontWeight:600, color:netTransfer>0?C.bad:netTransfer<0?C.ok:C.dim}}>
                    {netTransfer>0?"-":"+"}{fmtB(Math.abs(netTransfer))}
                  </td>
                  <td style={{...tdS, color:noFund>0?C.ok:C.bad}}>{noFund>=0?"+":""}{fmtB(noFund)}</td>
                  <td style={{...tdS, fontWeight:700, color:wFund>0?C.ok:C.bad}}>{wFund>=0?"+":""}{fmtB(wFund)}</td>
                  <td style={{...tdS, color:(wFund-noFund)>0?C.ok:(wFund-noFund)<0?C.bad:C.dim}}>
                    {(wFund-noFund)>=0?"+":""}{fmtB(wFund-noFund)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </Card>

      <Card title="How to read the Alpha slider">
        <P><b>{"\u03B1"} (alpha)</b> represents how much weight a bloc places on global welfare vs its own regional welfare when deciding whether to join the coalition.</P>
        <Eq>U<sub>i</sub>({"\u03B1"}) = {"\u03B1"} {"\u00D7"} U<sub>global</sub> + (1 - {"\u03B1"}) {"\u00D7"} U<sub>regional,i</sub></Eq>
        <P><b>{"\u03B1"} = 0</b>: The bloc cares only about its own net welfare. It will join only if joining is regionally profitable (damage saved {">"} transition cost + rent loss). Most developing blocs pass this test; GCC and Russia do not.</P>
        <P><b>{"\u03B1"} = 1</b>: The bloc cares only about global welfare. Since the Grand Coalition maximizes global welfare, all blocs join. This is unrealistic but useful as an upper bound.</P>
        <P><b>{"\u03B1"}<sub>crit</sub></b>: The critical alpha at which a bloc is indifferent. Below {"\u03B1"}<sub>crit</sub>, the bloc defects. Fund transfers reduce {"\u03B1"}<sub>crit</sub> by improving the bloc's regional welfare in-coalition.</P>
      </Card>

      <Card title="Key Assumptions for Ideal World">
        <ul style={{fontSize:12, lineHeight:1.7, marginTop:0, paddingLeft:18}}>
          <li><b>All 9 blocs</b> join the Grand Coalition at High ambition.</li>
          <li>Fund transfers are cumulative 2025-2065 in $bn.</li>
          <li>Positive = contributor (pays into fund), Negative = recipient (receives from fund).</li>
          <li>CCF (Climate Co-financing Fund): finances clean energy transition in recipient countries.</li>
          <li>AF (Adaptation Fund): finances climate adaptation infrastructure.</li>
          <li>L&D (Loss & Damage): compensates for unavoidable climate impacts and fossil rent loss.</li>
          <li>Forest: finances avoided deforestation and reforestation; additionally reduces global CO{"\u2082"} by up to 86 GtCO{"\u2082"} (linear with pool, max at $100bn).</li>
          <li>GCC's large L&D receipt ($10tn) compensates for massive fossil rent loss ($13.4tn).</li>
          <li>The goal: make every bloc's net welfare positive, so the Grand Coalition is individually rational.</li>
        </ul>
      </Card>
    </div>
  );
}

// ─── Model & Assumptions Panel ──────────────────────────────────────
function ModelPanel() {
  return (
    <div>
      <Card title="A1 — Temperature equation (TCRE)">
        <Eq>T(2065) = 1.50 + 0.56 {"\u00D7"} (1768 - 1125 {"\u00D7"} coverage - forest_reduction) / 1000</Eq>
        <P>TCRE = 0.56{"\u00B0"}C per 1000 GtCO{"\u2082"} (IPCC AR6 central). Baseline 2025 warming = 1.50{"\u00B0"}C. Cumulative emissions under all-Low = 1768 GtCO{"\u2082"}. Maximum abatement (all-High) = 1125 GtCO{"\u2082"}.</P>
      </Card>

      <Card title="A2 — Binary coalition model">
        <Eq>Status<sub>i</sub> {"\u2208"} {"{"}IN, OUT{"}"}</Eq>
        <P>Each bloc is either <b>IN</b> (High ambition, pays transition costs, achieves full abatement) or <b>OUT</b> (Low ambition, no additional transition costs, no abatement contribution). This simplifies the continuous model to match the game-theoretic structure.</P>
      </Card>

      <Card title="A3 — Coalition coverage">
        <Eq>Coverage = {"\u03A3"}<sub>i {"\u2208"} IN</sub> abShare<sub>i</sub></Eq>
        <P>Sum of abatement shares for blocs in the coalition. At Grand Coalition (all IN), coverage = 0.999. The 80% coverage threshold (0.80) is the minimum for a viable deal.</P>
      </Card>

      <Card title="A4 — Damage interpolation">
        <Eq>D<sub>i</sub>(T) = piecewise-linear interpolation between LOW (2.49{"\u00B0"}C), MED (2.10{"\u00B0"}C), HIGH (1.86{"\u00B0"}C) canonical values</Eq>
        <P>Cumulative damages at each temperature anchor are calibrated to the master workbook. For intermediate temperatures, linear interpolation between the nearest two anchors.</P>
      </Card>

      <Card title="A5 — Welfare equation">
        <Eq>W<sub>i</sub> = DamSaved<sub>i</sub>(T) - TransIncr<sub>i</sub>(status) - RentLoss<sub>i</sub>(coverage) - FundNet<sub>i</sub></Eq>
        <P><b>DamSaved</b> = damage at all-Low T minus damage at current T. Benefits all blocs regardless of status.</P>
        <P><b>TransIncr</b> = transition cost increment (HIGH - LOW). Only paid by IN blocs.</P>
        <P><b>RentLoss</b> = fossil rent lost due to global demand reduction. Scales with coverage. Applies to all fossil-producing blocs (IN or OUT).</P>
        <P><b>FundNet</b> = sum of fund contributions (positive) minus receipts (negative).</P>
      </Card>

      <Card title="A6 — Alpha-weighted objective">
        <Eq>U<sub>i</sub>({"\u03B1"}) = {"\u03B1"} {"\u00D7"} W<sub>global</sub> + (1 - {"\u03B1"}) {"\u00D7"} W<sub>i</sub></Eq>
        <P>{"\u03B1"} {"\u2208"} [0,1] weights global vs regional welfare. At {"\u03B1"} = 0, bloc is purely self-interested. At {"\u03B1"} = 1, bloc maximizes global welfare.</P>
      </Card>

      <Card title="A7 — Critical alpha">
        <Eq>{"\u03B1"}<sub>crit</sub> = -{"\u0394"}U<sub>r</sub> / ({"\u0394"}U<sub>g</sub> - {"\u0394"}U<sub>r</sub>)</Eq>
        <P>Where {"\u0394"}U<sub>r</sub> = regional welfare change from joining, {"\u0394"}U<sub>g</sub> = global welfare change. A bloc joins if {"\u03B1"} {"\u2265"} {"\u03B1"}<sub>crit</sub>. If {"\u0394"}U<sub>r</sub> {">"} 0 (regionally profitable), {"\u03B1"}<sub>crit</sub> {"\u2264"} 0 (always joins).</P>
      </Card>

      <Card title="A8 — Nash equilibrium">
        <Eq>Iterated best-response: each bloc re-optimizes given others' choices. Converges in {"\u2264"} 50 iterations.</Eq>
        <P>Starting from all-IN, each bloc evaluates whether to switch to OUT. The equilibrium is the stable configuration where no bloc wants to unilaterally change.</P>
      </Card>

      <Card title="A9 — Tipping points">
        <Eq>P<sub>k</sub>(T) = P<sub>max</sub> / (1 + exp(-s<sub>k</sub> {"\u00D7"} (T - T<sub>k</sub>*)))</Eq>
        <P>Five tipping elements with logistic activation. Displayed for information; damage effects are already captured in the canonical damage scenarios.</P>
        <table style={tableS}>
          <thead><tr>
            <th style={{...thS,textAlign:"left"}}>Tipping point</th>
            <th style={thS}>T* ({"\u00B0"}C)</th>
            <th style={thS}>s</th>
            <th style={thS}>P<sub>max</sub></th>
            <th style={thS}>Global cost</th>
            <th style={thS}>Regional surcharges</th>
          </tr></thead>
          <tbody>
            {CG.TIPS.map((t,i) => (
              <tr key={i}>
                <td style={{...tdS,textAlign:"left"}}>{t.name}</td>
                <td style={tdS}>{t.Tstar.toFixed(2)}</td>
                <td style={tdS}>{t.s.toFixed(2)}</td>
                <td style={tdS}>{((t.Pmax||1)*100).toFixed(0)}%</td>
                <td style={tdS}>${(t.globalCost/1000).toFixed(0)}tn</td>
                <td style={{...tdS,textAlign:"left",fontSize:11}}>{Object.entries(t.regional||{}).map(([k,v])=>`${k}: $${v>=1000?(v/1000).toFixed(1)+"tn":v+"bn"}`).join(", ")||"none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="A10 — Fund mechanics">
        <P><b>CCF</b>: Climate Co-financing Fund. Direct welfare transfer to reduce transition cost burden in developing countries.</P>
        <P><b>AF</b>: Adaptation Fund. Finances climate adaptation infrastructure in vulnerable regions.</P>
        <P><b>L&D</b>: Loss & Damage fund. Compensates for unavoidable climate impacts and fossil rent losses.</P>
        <P><b>Forest</b>: Finances REDD+ and reforestation. Side effect: total pool (sum of positive contributions) reduces global emissions by up to 86 GtCO{"\u2082"} (linear: $100bn {"\u2192"} 86 GtCO{"\u2082"}).</P>
        <P>All funds: <b>positive = contributor</b>, <b>negative = recipient</b>. Net fund payment is subtracted from bloc welfare.</P>
      </Card>

      <Card title="A11 — Energy transition cost">
        <P>Components A (electricity LCOE), B (grid integration), C (hard-to-abate premium). Incremental cost = HIGH minus LOW cumulative 2025-2065. Sensitive to WACC: same solar costs $22/MWh at 5.5% but $67/MWh at 14%.</P>
        <P style={{fontSize:11, color:C.dim, marginTop:-4}}>All figures are <b>cumulative totals over 2025-2065</b> (trapezoidal integration of annual values). E.g. China's cumulative GDP of $3,128tn reflects annual GDP growing from ~$38tn/yr to ~$97tn/yr over 40 years.</P>
        <table style={tableS}>
          <thead><tr><th style={{...thS,textAlign:"left"}}>Bloc</th><th style={thS}>Incr. cost</th><th style={thS}>Cum. GDP</th><th style={thS}>Cost / GDP</th></tr></thead>
          <tbody>
            {CG.REGIONS.map(r=>{
              const cost = CG.ENERGY_INCR[r.key];
              const gdp = CG.GDP_CUM_TN[r.key];
              return (
                <tr key={r.key}>
                  <td style={{...tdS,textAlign:"left"}}>{r.name}</td>
                  <td style={tdS}>${cost>=1000?(cost/1000).toFixed(1)+"tn":Math.round(cost)+"bn"}</td>
                  <td style={tdS}>${gdp>=1000?(gdp/1000).toFixed(1)+"tn":Math.round(gdp)+"tn"}</td>
                  <td style={tdS}>{(cost/(gdp*10)).toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="A12 — Fossil rent loss">
        <P>Rent = (Price - Cost) {"\u00D7"} Production. Equiproportional rule: all producers' output scales down with global demand. Scales linearly with coalition coverage.</P>
        <table style={tableS}>
          <thead><tr><th style={{...thS,textAlign:"left"}}>Bloc</th><th style={thS}>GC rent loss</th></tr></thead>
          <tbody>
            {CG.REGIONS.filter(r=>CG.RENT_LOSS_GC[r.key]>0).map(r=>{
              const v = CG.RENT_LOSS_GC[r.key];
              return (
                <tr key={r.key}>
                  <td style={{...tdS,textAlign:"left"}}>{r.name}</td>
                  <td style={tdS}>${v>=1000?(v/1000).toFixed(1)+"tn":Math.round(v)+"bn"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="A13-A16 — Additional assumptions">
        <ul style={{fontSize:12, lineHeight:1.7, marginTop:0, paddingLeft:18}}>
          <li><b>A13</b>: Baseline warming 1.50{"\u00B0"}C (2025, Copernicus/ERA5).</li>
          <li><b>A14</b>: Oil price fixed at $75/bbl (OPEC-stabilized).</li>
          <li><b>A15</b>: All figures $2025 PPP. GDP from workbook Sheet 1.</li>
          <li><b>A16</b>: Non-CO{"\u2082"} GHG and aerosol forcing folded into residual emissions stream.</li>
        </ul>
      </Card>

      <Card title="Data sources">
        <ul style={{fontSize:12, lineHeight:1.7, marginTop:0, paddingLeft:18}}>
          <li>Climate Game Master Data workbook (Sheets 1-17).</li>
          <li>Nine strategic delegation reports (Oct 2025).</li>
          <li>IPCC AR6 for TCRE central estimate.</li>
          <li>Copernicus/ERA5 for 2025 baseline temperature.</li>
          <li>Damage calibration from Burke et al. (2015), extended.</li>
        </ul>
      </Card>
    </div>
  );
}

export default App;
