// UI components
import React from 'react';
import CG from './data.js';
const { useState, useMemo, useEffect, useRef } = React;

const fmtB = (n) => {
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1000) return (n/1000).toFixed(abs>=10000?0:1) + "tn";
  if (abs >= 1) return n.toFixed(0) + "bn";
  return n.toFixed(1);
};
const fmtT = (n) => n.toFixed(2) + "°C";
const fmtP = (n) => (n*100).toFixed(1) + "%";
const fmtGt = (n) => n.toFixed(1) + " Gt";
const regionByKey = (k) => CG.REGIONS.find(r => r.key === k);

// Color tokens
const C = {
  bg: "#f6f4ef",
  card: "#ffffff",
  ink: "#1a1a1a",
  dim: "#6b6b6b",
  line: "#e3ddd2",
  accent: "#c2410c",   // burnt orange
  ok: "#15803d",
  warn: "#b45309",
  bad: "#991b1b",
  low: "#9ca3af",
  med: "#f59e0b",
  high: "#16a34a",
};

// Inline bar chart
function Bar({v, max, color, w=100}) {
  const pct = Math.min(100, Math.max(0, (v/max)*100));
  return (
    <div style={{width:w, height:8, background:"#eee8dd", borderRadius:4, overflow:"hidden"}}>
      <div style={{width:pct+"%", height:"100%", background:color||C.accent}} />
    </div>
  );
}

// Mini sparkline/line chart
function LineChart({series, years, height=160, yLabel="", yRange, highlight, colors, legend, annotate}){
  const w = 560, h = height, pad = {l:44, r:16, t:16, b:28};
  const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
  const flat = series.flatMap(s=>s.data);
  let yMin = yRange ? yRange[0] : Math.min(...flat, 0);
  let yMax = yRange ? yRange[1] : Math.max(...flat, 0.0001);
  if (yMax === yMin) yMax = yMin + 1;
  const x = (i) => pad.l + (i/(years.length-1))*plotW;
  const y = (v) => pad.t + (1 - (v - yMin)/(yMax - yMin))*plotH;
  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%", height, display:"block"}}>
      {[...Array(ticks+1)].map((_,i)=>{
        const v = yMin + (yMax-yMin)*i/ticks;
        const yy = y(v);
        return <g key={i}>
          <line x1={pad.l} x2={w-pad.r} y1={yy} y2={yy} stroke="#eee8dd" strokeWidth="1"/>
          <text x={pad.l-6} y={yy+3} fontSize="10" fill={C.dim} textAnchor="end">{v.toFixed(Math.abs(v)<10?1:0)}</text>
        </g>;
      })}
      {years.map((yr,i)=>(
        <text key={yr} x={x(i)} y={h-8} fontSize="10" fill={C.dim} textAnchor="middle">{yr}</text>
      ))}
      <text x={12} y={14} fontSize="10" fill={C.dim}>{yLabel}</text>
      {highlight !== undefined && (
        <line x1={pad.l} x2={w-pad.r} y1={y(highlight)} y2={y(highlight)}
              stroke={C.accent} strokeDasharray="4 3" strokeWidth="1.2"/>
      )}
      {annotate && annotate.map((a,k)=>(
        <g key={k}>
          <line x1={pad.l} x2={w-pad.r} y1={y(a.y)} y2={y(a.y)} stroke={a.color||C.dim} strokeDasharray="2 2" strokeWidth="1"/>
          <text x={w-pad.r-4} y={y(a.y)-3} fontSize="10" fill={a.color||C.dim} textAnchor="end">{a.label}</text>
        </g>
      ))}
      {series.map((s, si) => {
        const path = s.data.map((v,i)=> `${i===0?"M":"L"} ${x(i)} ${y(v)}`).join(" ");
        return <g key={si}>
          <path d={path} fill="none" stroke={s.color} strokeWidth={s.bold?2.5:1.8} strokeDasharray={s.dashed?"4 3":""}/>
          {s.data.map((v,i)=>(
            <circle key={i} cx={x(i)} cy={y(v)} r={s.bold?3:2.2} fill={s.color}/>
          ))}
        </g>;
      })}
      {legend && (
        <g>
          {series.map((s, si)=>(
            <g key={si} transform={`translate(${pad.l + si*130}, ${pad.t + 2})`}>
              <line x1="0" x2="16" y1="6" y2="6" stroke={s.color} strokeWidth="2.5"/>
              <text x="20" y="9" fontSize="10" fill={C.ink}>{s.name}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

// Ambition slider with ticks at L/M/H
function AmbitionSlider({label, value, onChange, disabled}) {
  const pct = (value/2)*100;
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:11, color:C.dim, marginBottom:2}}>
        <span style={{fontWeight:600, color:C.ink}}>{label}</span>
        <span style={{fontVariantNumeric:"tabular-nums"}}>
          {value < 0.5 ? "Low" : value < 1.5 ? (value<1?"Low→Med":"Med→High") : value < 2 ? "Med→High" : "High"}
          {" · "}{value.toFixed(2)}
        </span>
      </div>
      <input type="range" min="0" max="2" step="0.05" value={value}
             disabled={disabled}
             onChange={e=>onChange(parseFloat(e.target.value))}
             style={{width:"100%", accentColor: C.accent}}/>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:10, color:C.dim, marginTop:-2}}>
        <span>L</span><span>M</span><span>H</span>
      </div>
    </div>
  );
}

export { fmtB, fmtT, fmtP, fmtGt, regionByKey, C, Bar, LineChart, AmbitionSlider };
