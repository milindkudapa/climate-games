// Climate game engine — canonical-anchored
//
// Design principle: every cumulative output at standard configurations reproduces
// the strategic-report tables exactly. Interpolation is used only between those anchors.
//
// Welfare = damages_avoided − transition_cost_increment − rent_loss
// with all three quantities defined on the Sheet-17 basis (per-bloc cumulative 2025–65).
//
import CG from './data.js';
(function () {
  const YEARS = CG.YEARS;
  const N = YEARS.length;

  // Trapezoidal cumulative integral over 5-year steps: Σ (y[i]+y[i+1])/2 × 5
  function cumTrap(arr) {
    if (!arr || !arr.length) return 0;
    let s = 0;
    for (let i = 0; i < arr.length - 1; i++) s += 0.5 * (arr[i] + arr[i+1]) * 5;
    return s;
  }

  // Piecewise-linear blend over ambition index x ∈ [0,2]
  // x=0 → Low, x=1 → Medium, x=2 → High
  function blend(L, M, H, x) {
    const t = Math.max(0, Math.min(2, x));
    if (t <= 1) return L.map((l, i) => l + (M[i] - l) * t);
    return M.map((m, i) => m + (H[i] - m) * (t - 1));
  }
  function blendScalar(L, M, H, x) {
    const t = Math.max(0, Math.min(2, x));
    if (t <= 1) return L + (M - L) * t;
    return M + (H - M) * (t - 1);
  }

  // ── Coalition coverage & temperature ─────────────────────────────────
  // Coverage = sum of abShare for blocs with energy ambition ≥ 1.0.
  function coalitionCoverage(decisions) {
    let c = 0;
    for (const r of CG.REGIONS) {
      if (decisions[r.key].energy >= 1.0) c += CG.PROFILE[r.key].abShare;
    }
    return c;
  }

  // Coalition-weighted ambition μ ∈ [0,2] = Σ share_r · x_r / Σ share_r
  function weightedAmbition(decisions) {
    let num = 0, den = 0;
    for (const r of CG.REGIONS) {
      const share = CG.PROFILE[r.key].abShare;
      num += share * decisions[r.key].energy;
      den += share;
    }
    return den > 0 ? num / den : 0;
  }

  // Global temperature at 2065 as a function of weighted ambition.
  // Anchors: μ=0 → 2.49°C, μ=1 → 2.17°C, μ=2 → 1.86°C.
  function T2065FromAmbition(mu) {
    return blendScalar(CG.T_LOW, CG.T_MED, CG.T_HIGH, mu);
  }

  // Yearly temperature path assuming linear ramp from 1.50°C (2025) to T_2065.
  function temperatureSeries(decisions) {
    const mu = weightedAmbition(decisions);
    const T65 = T2065FromAmbition(mu);
    const T = YEARS.map((_, i) => CG.T_BASE + (T65 - CG.T_BASE) * (i / (N - 1)));
    // Global emissions proxy (GtCO2/yr): falls linearly with μ from ~55 (Low) to ~20 (High)
    const emL = 55, emH = 20;
    const emit = (mu / 2) * (emH - emL) + emL;
    const emissions = YEARS.map((_, i) => emit - (emit - emH) * 0.1 * i);
    return { T, T2065: T65, mu, emissions };
  }

  // ── Bloc-level transition, damages, rent ─────────────────────────────
  // Transition cost: piecewise-linear on own energy ambition x ∈ [0,2].
  function transSeries(regionKey, x) {
    const tc = CG.TRANS[regionKey];
    return blend(tc.L, tc.M, tc.H, x);
  }

  // Own damage series depends on GLOBAL temperature, not own ambition.
  // Canonical damage series are indexed by global L/M/H scenario (μ=0,1,2).
  function damageSeries(regionKey, mu) {
    const dm = CG.DAM[regionKey];
    return blend(dm.L, dm.M, dm.H, mu);
  }

  // Cumulative damage at arbitrary coalition-weighted ambition μ.
  // Calibrated: at μ=0,1,2 we exactly reproduce canonical Sheet-10 cumulative totals
  // (43174, 35108, 29291 for CHN etc.). Rectangular Σ×5 matches workbook better than trapezoidal.
  function cumDamage(regionKey, mu) {
    const s = damageSeries(regionKey, mu);
    return s.reduce((a,b)=>a+b, 0) * 5;
  }

  // Rent loss — TWO canonical modes:
  //   (a) Unilateral: own bloc at High, others Low → CG.RENT_UNI (small, ~$70bn for GCC).
  //   (b) Full coalition at High: CG.RENT_CUM.lossGC (large, ~$13.4tn for GCC).
  // Interpolation: for a given coalition configuration, rent loss scales with the
  // *global demand reduction*, which is well-approximated by coalition-weighted ambition μ.
  // Shape: L (retained) → H (retained); loss = L_ret − retained(μ).
  // Canonical pins: lossGC at Grand Coalition (μ=2 with all-in), = CG.RENT_CUM.lossGC.
  function rentLossCoalition(regionKey, decisions) {
    const rc = CG.RENT_CUM[regionKey];
    if (rc.L === 0) return 0;
    // Compute global-oil-demand reduction as share-weighted (abShare) ambition.
    // At Grand Coalition (all x=2) this = 2; match to canonical lossGC.
    const mu = weightedAmbition(decisions);
    // Interpolate retained rent L→M→H:
    const retained = blendScalar(rc.L, rc.M, rc.H, mu);
    const grossLoss = rc.L - retained;
    // Scale so that at μ=2 the loss equals canonical lossGC (handles depletion adj).
    const grossAtFull = rc.L - rc.H;
    const scale = grossAtFull > 0 ? (rc.lossGC / grossAtFull) : 1;
    return grossLoss * scale;
  }

  // Unilateral rent loss: only own bloc acts, others Low. Bloc-scaled by own ambition.
  function rentLossUnilateral(regionKey, ownAmbition) {
    const x = Math.max(0, Math.min(2, ownAmbition));
    return CG.RENT_UNI[regionKey] * (x / 2);
  }

  // ── Welfare aggregators ──────────────────────────────────────────────
  // Returns cumulative ($bn) components for a bloc given full decisions map.
  //   mode: "coalition" (standard) or "unilateral" (only-own-acts rent model).
  function blocWelfare(regionKey, decisions, mode) {
    mode = mode || "coalition";
    const ownX = decisions[regionKey].energy;

    // Transition (own) — increment vs Low baseline
    const transOwn = cumTrap(transSeries(regionKey, ownX));
    const transLow = cumTrap(transSeries(regionKey, 0));
    const dTrans   = transOwn - transLow;

    // Damages saved (global T → own damages)
    const mu = weightedAmbition(decisions);
    const damAtMu  = cumDamage(regionKey, mu);
    const damAtLow = cumDamage(regionKey, 0);
    const damSaved = damAtLow - damAtMu;

    // Rent loss
    const rentCoal = rentLossCoalition(regionKey, decisions);
    const rentUni  = rentLossUnilateral(regionKey, ownX);
    const rent = mode === "unilateral" ? rentUni : rentCoal;

    const net = damSaved - dTrans - rent;
    const bcr = damSaved / Math.max(1, dTrans + rent);

    return {
      dTrans, damSaved, rent, rentCoal, rentUni, net, bcr,
      damAtMu, damAtLow, transOwn, transLow, mu,
    };
  }

  // Per-year series for charting
  function blocSeries(regionKey, decisions) {
    const ownX = decisions[regionKey].energy;
    const mu = weightedAmbition(decisions);
    const trans = transSeries(regionKey, ownX);
    const transLow = transSeries(regionKey, 0);
    const dam = damageSeries(regionKey, mu);
    const damLow = damageSeries(regionKey, 0);
    const damSavedYr = damLow.map((d, i) => d - dam[i]);
    // Rent loss distributed evenly across 40 years (proxy for yearly flow)
    const rent = rentLossCoalition(regionKey, decisions);
    const rentYr = YEARS.map(() => rent / 40);
    const netYr = damSavedYr.map((s, i) => s - (trans[i] - transLow[i]) - rentYr[i]);
    return { trans, transLow, dam, damLow, damSavedYr, rentYr, netYr };
  }

  // Global totals
  function globalTotals(decisions) {
    let trans = 0, rent = 0, saved = 0, net = 0;
    for (const r of CG.REGIONS) {
      const w = blocWelfare(r.key, decisions, "coalition");
      trans += w.dTrans; rent += w.rent; saved += w.damSaved; net += w.net;
    }
    return { trans, rent, saved, net };
  }

  // Default decisions helpers
  function defaultDecisions() {
    const d = {};
    for (const r of CG.REGIONS) d[r.key] = { energy: 2, land: 2 }; // Grand Coalition
    return d;
  }
  function lowDecisions() {
    const d = {};
    for (const r of CG.REGIONS) d[r.key] = { energy: 0, land: 0 };
    return d;
  }
  function medDecisions() {
    const d = {};
    for (const r of CG.REGIONS) d[r.key] = { energy: 1, land: 1 };
    return d;
  }

  // Tipping probability (display only)
  function tippingProb(T) {
    return CG.TIPS.map(t => ({
      name: t.name,
      p: t.Pmax / (1 + Math.exp(-3 * (T - t.T_mid))),
    }));
  }

  // ── Backward-compat shims for app.jsx ────────────────────────────────
  // app.jsx uses an older API. Provide aliases that synthesize the richer
  // `eco` object (trans, damTotal, rent, emit, gdp, T, smoothDam, tippingDam,
  // adaptDam, netCost, uniRentCum) expected by the UI.
  function blocEconomics(regionKey, decisions) {
    const ownX = decisions[regionKey].energy;
    const mu = weightedAmbition(decisions);
    const T65 = T2065FromAmbition(mu);
    const T = YEARS.map((_, i) => CG.T_BASE + (T65 - CG.T_BASE) * (i / (N - 1)));

    const trans    = transSeries(regionKey, ownX);
    const damTotal = damageSeries(regionKey, mu);

    // Split damages into smooth / tipping / adapt for display purposes.
    // Approx: tipping ≈ 25%, smooth ≈ 70%, adapt offset ≈ 5% (all ≥0).
    const smoothDam  = damTotal.map(v => v * 0.70);
    const tippingDam = damTotal.map(v => v * 0.25);
    const adaptDam   = damTotal.map(v => v * 0.05);

    // Rent flow series — distribute unilateral rent evenly over 40 yrs.
    const uniRentCum = rentLossUnilateral(regionKey, ownX);
    const rent = YEARS.map(() => uniRentCum / 40);

    // Emissions proxy: linear between Low (own=0) and High (own=2) anchors.
    // Use a simple 0..1 scalar: higher ambition → lower emissions.
    // Normalize damage baseline as proxy for emissions shape.
    const emL = damageSeries(regionKey, 0);
    const emH = damageSeries(regionKey, 2);
    const f = ownX / 2;
    const emit = emL.map((l, i) => (l + (emH[i] - l) * f) * 0.01);

    // GDP series — flat interpolation between gdp25 and gdp65 ($T)
    const p = CG.PROFILE[regionKey];
    const gdp = YEARS.map((_, i) => p.gdp25 + (p.gdp65 - p.gdp25) * (i / (N - 1)));

    const netCost = trans.map((t, i) => t + rent[i] + damTotal[i]);

    return { trans, damTotal, smoothDam, tippingDam, adaptDam, rent, emit, gdp, T,
             uniRentCum, T2065: T65, mu };
  }

  function blocNetWelfare(regionKey, decisions) {
    const w = blocWelfare(regionKey, decisions, "coalition");
    return { net: w.net, dTrans: w.dTrans, rent: w.rent, damageSaved: w.damSaved };
  }

  function coalitionRentLoss(regionKey, decisions) {
    return rentLossCoalition(regionKey, decisions);
  }

  // Alias: baselineLowDecisions (old name)
  const baselineLowDecisions = lowDecisions;

  // ── Public API ────────────────────────────────────────────────────────
  CG.engine = {
    cumTrap, blend, blendScalar,
    coalitionCoverage, weightedAmbition, T2065FromAmbition, temperatureSeries,
    transSeries, damageSeries, cumDamage,
    rentLossCoalition, rentLossUnilateral,
    blocWelfare, blocSeries, globalTotals,
    defaultDecisions, lowDecisions, medDecisions, baselineLowDecisions,
    tippingProb,
    // Back-compat shims
    blocEconomics, blocNetWelfare, coalitionRentLoss,
  };

  // ── Back-compat data aliases for app.jsx ─────────────────────────────
  CG.DAMAGE = CG.DAM_PARAMS;  // app.jsx expects {beta, phi, alpha} — not damage series
  CG.LU = CG.LU || {};
  CG.GDP = CG.GDP || {};
  CG.UNI_RENT_HIGH = CG.RENT_UNI;
  // ECO2: canonical emissions "If Low" / "If High" per bloc (display only).
  // Synthesize from damage shape as proxy (no canonical emissions table provided).
  CG.ECO2 = CG.ECO2 || {};
  for (const r of CG.REGIONS) {
    const dm = CG.DAM[r.key];
    CG.ECO2[r.key] = { L: dm.L.map(v=>v*0.01), H: dm.H.map(v=>v*0.01) };
  }
})();

export default CG;
