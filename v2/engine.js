// Climate Game engine — binary coalition model
// IN = High ambition, OUT = Low ambition
// Welfare = damages_avoided − transition_cost_increment − rent_loss − net_fund_payment
import CG from './data.js';

const YEARS = CG.YEARS;
const N = YEARS.length;

// ── Temperature ────────────────────────────────────────────────────
// T(2065) = T_BASE + TCRE × (CUM_CO2_LOW − ABATEMENT_MAX × coverage − forest_reduction) / 1000
function computeTemperature(coverage, forestPool) {
  var fp = forestPool || 0;
  var forestReduction = Math.min(CG.FOREST_MAX_GT, CG.FOREST_MAX_GT * Math.max(0, fp) / CG.FOREST_MAX_BN);
  var cumCO2 = CG.CUM_CO2_LOW - CG.ABATEMENT_MAX * coverage - forestReduction;
  return CG.T_BASE + CG.TCRE * cumCO2 / 1000;
}

// Temperature path (linear ramp from T_BASE to T2065)
function temperaturePath(T2065) {
  return YEARS.map(function(_, i) { return CG.T_BASE + (T2065 - CG.T_BASE) * (i / (N - 1)); });
}

// ── Coverage ───────────────────────────────────────────────────────
function coalitionCoverage(membership) {
  var c = 0;
  for (var i = 0; i < CG.REGIONS.length; i++) {
    var k = CG.REGIONS[i].key;
    if (membership[k]) c += CG.PROFILE[k].abShare;
  }
  return c;
}

// ── Forest pool (sum of positive forest fund values) ───────────────
function forestPool(funds) {
  var pool = 0;
  for (var i = 0; i < CG.REGIONS.length; i++) {
    var k = CG.REGIONS[i].key;
    var f = funds[k];
    if (f && f.forest > 0) pool += f.forest;
  }
  return pool;
}

// ── Damage interpolation (cumulative $bn) ─────────────────────────
// Piecewise linear between T_HIGH(1.86)→T_MED(2.10)→T_LOW(2.49)
function cumDamageAtT(regionKey, T) {
  var dc = CG.DAM_CUM[regionKey];
  if (T >= CG.T_MED) {
    var frac = Math.min(1, (T - CG.T_MED) / (CG.T_LOW - CG.T_MED));
    return dc.M + (dc.L - dc.M) * frac;
  } else {
    // Allow extrapolation below T_HIGH (for forest fund effects)
    var frac = (T - CG.T_HIGH) / (CG.T_MED - CG.T_HIGH);
    return Math.max(0, dc.H + (dc.M - dc.H) * frac);
  }
}

// Per-year damage series for charts (interpolated between scenarios)
function damageSeries(regionKey, T) {
  var dm = CG.DAM[regionKey];
  if (T >= CG.T_MED) {
    var frac = Math.min(1, (T - CG.T_MED) / (CG.T_LOW - CG.T_MED));
    return dm.M.map(function(m, i) { return m + (dm.L[i] - m) * frac; });
  } else {
    var frac = (T - CG.T_HIGH) / (CG.T_MED - CG.T_HIGH);
    return dm.H.map(function(h, i) { return Math.max(0, h + (dm.M[i] - h) * frac); });
  }
}

// Per-year transition cost series for charts
function transSeries(regionKey, isIn) {
  return isIn ? CG.TRANS[regionKey].H : CG.TRANS[regionKey].L;
}

// ── Rent loss ─────────────────────────────────────────────────────
// Scales linearly with coverage (global demand reduction)
// Applies to ALL fossil producers, whether IN or OUT
function rentLoss(regionKey, coverage) {
  return CG.RENT_LOSS_GC[regionKey] * (coverage / 0.999);
}

// ── Tipping points ────────────────────────────────────────────────
// P(T) = Pmax / (1 + exp(-s × (T - Tstar)))
function tippingProb(T, tip) {
  var Pmax = tip.Pmax || 1.0;
  return Pmax / (1.0 + Math.exp(-tip.s * (T - tip.Tstar)));
}

function tippingProbs(T) {
  return CG.TIPS.map(function(tip) {
    return { name: tip.name, p: tippingProb(T, tip), Tstar: tip.Tstar, Pmax: tip.Pmax || 1.0 };
  });
}

// Estimated tipping damage for a bloc (informational, not added to welfare)
function tippingDamage(regionKey, T) {
  var gdpShare = CG.GDP_CUM_TN[regionKey] / CG.GDP_CUM_TOTAL_TN;
  var total = 0;
  for (var i = 0; i < CG.TIPS.length; i++) {
    var tip = CG.TIPS[i];
    var p = tippingProb(T, tip);
    var globalPortion = tip.globalCost * gdpShare;
    var regional = (tip.regional && tip.regional[regionKey]) || 0;
    total += p * (globalPortion + regional);
  }
  return total;
}

// ── Core outcome computation ──────────────────────────────────────
// membership: { CHN: true/false, ... }
// funds: { CHN: { ccf, af, ld, forest }, ... }
function computeOutcome(membership, funds) {
  var cov = coalitionCoverage(membership);
  var fPool = forestPool(funds);
  var T = computeTemperature(cov, fPool);
  var forestReduction = Math.min(CG.FOREST_MAX_GT, CG.FOREST_MAX_GT * Math.max(0, fPool) / CG.FOREST_MAX_BN);

  var blocs = {};
  var globalDamSaved = 0, globalTrans = 0, globalRent = 0, globalFund = 0;

  for (var i = 0; i < CG.REGIONS.length; i++) {
    var k = CG.REGIONS[i].key;
    var isIn = !!membership[k];

    // Transition cost increment (only if IN)
    var transIncr = isIn ? CG.ENERGY_INCR[k] : 0;

    // Damage at current T vs all-Low
    var damAtT = cumDamageAtT(k, T);
    var damAtLow = CG.DAM_CUM[k].L;
    var damSaved = damAtLow - damAtT;

    // Rent loss (applies to all, scales with coverage)
    var rent = rentLoss(k, cov);

    // Fund net (positive = contributor pays, negative = recipient gains)
    var f = (funds && funds[k]) || { ccf: 0, af: 0, ld: 0, forest: 0 };
    var netFund = (f.ccf || 0) + (f.af || 0) + (f.ld || 0) + (f.forest || 0);

    // Tipping info (display only)
    var tipDam = tippingDamage(k, T);
    var tipDamLow = tippingDamage(k, CG.T_LOW);

    // Net welfare = damage saved - transition cost - rent loss - fund payment
    var net = damSaved - transIncr - rent - netFund;

    blocs[k] = {
      isIn: isIn,
      transIncr: transIncr,
      damAtT: damAtT,
      damSaved: damSaved,
      rent: rent,
      netFund: netFund,
      tipDam: tipDam,
      tipDamLow: tipDamLow,
      net: net,
    };

    globalDamSaved += damSaved;
    globalTrans += transIncr;
    globalRent += rent;
    globalFund += netFund;
  }

  var globalNet = globalDamSaved - globalTrans - globalRent - globalFund;

  return {
    coverage: cov,
    T: T,
    forestReduction: forestReduction,
    forestPool: fPool,
    blocs: blocs,
    globalDamSaved: globalDamSaved,
    globalTrans: globalTrans,
    globalRent: globalRent,
    globalFund: globalFund,
    globalNet: globalNet,
  };
}

// ── Alpha-weighted objective ──────────────────────────────────────
// U_i(alpha) = alpha * U_global + (1 - alpha) * U_regional_i
function alphaObjective(regionKey, alpha, outcome) {
  return alpha * outcome.globalNet + (1 - alpha) * outcome.blocs[regionKey].net;
}

// ── Nash equilibrium solver (iterated best-response) ──────────────
function solveNash(alphas, funds, maxIter) {
  maxIter = maxIter || 50;
  // Start with all IN
  var membership = {};
  for (var i = 0; i < CG.REGIONS.length; i++) membership[CG.REGIONS[i].key] = true;

  for (var iter = 0; iter < maxIter; iter++) {
    var changed = false;
    for (var i = 0; i < CG.REGIONS.length; i++) {
      var k = CG.REGIONS[i].key;
      var alpha = alphas[k];

      // Outcome with bloc IN
      var memIn = Object.assign({}, membership); memIn[k] = true;
      var outIn = computeOutcome(memIn, funds);
      var uIn = alphaObjective(k, alpha, outIn);

      // Outcome with bloc OUT
      var memOut = Object.assign({}, membership); memOut[k] = false;
      var outOut = computeOutcome(memOut, funds);
      var uOut = alphaObjective(k, alpha, outOut);

      var shouldBeIn = uIn >= uOut;
      if (membership[k] !== shouldBeIn) {
        membership[k] = shouldBeIn;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return membership;
}

// ── Critical alpha ────────────────────────────────────────────────
// α_crit where a bloc is indifferent between joining and its best outside option.
//
// Two reasons a bloc may need global altruism to join:
//   1. W_in < 0: joining hurts absolutely (GCC, Russia)
//   2. Free-rider gain: W_out > W_in > 0 — staying out while others pay is even better (EUR, NAM…)
//
// Unified formula: dUr = W_in − max(0, W_out)
//   • If W_out ≤ 0: outside option is All Low ($0), so dUr = W_in  [GCC/Russia case]
//   • If W_out > W_in: outside option is free-riding, so dUr = W_in − W_out  [free-rider case]
//   • If W_in ≥ max(0, W_out): joining is the best option regardless → α_crit = 0
//
// dUg = W_global_allIN − W_global_without_bloc  (bloc's marginal global contribution)
//
// α × dUg + (1−α) × dUr = 0  →  α_crit = −dUr / (dUg − dUr)
function criticalAlpha(regionKey, membership, funds) {
  var memIn = Object.assign({}, membership); memIn[regionKey] = true;
  var memOut = Object.assign({}, membership); memOut[regionKey] = false;

  var outIn  = computeOutcome(memIn,  funds);
  var outOut = computeOutcome(memOut, funds);

  var W_in  = outIn.blocs[regionKey].net;
  var W_out = outOut.blocs[regionKey].net;

  // Outside option: better of free-riding (W_out) and not participating at all (0 = All Low)
  var outsideOption = Math.max(0, W_out);

  // dUr: how much joining costs vs best outside option
  var dUr = W_in - outsideOption;

  // dUg: bloc's marginal contribution to global welfare
  var dUg = outIn.globalNet - outOut.globalNet;

  // Joining is at least as good as outside option → always joins
  if (dUr >= 0) return 0;
  // Joining makes global worse (shouldn't happen) → needs compensation regardless
  if (dUg <= 0) return 999;
  // α_crit = −dUr / (dUg − dUr)
  return -dUr / (dUg - dUr);
}

// ── Alpha spectrum analysis ───────────────────────────────────────
// Sweep alpha from 0 to 1 (uniform for all blocs), return Nash membership at each level
function alphaSpectrum(funds, steps) {
  steps = steps || 21;
  var results = [];
  for (var s = 0; s <= steps; s++) {
    var alpha = s / steps;
    var alphas = {};
    for (var i = 0; i < CG.REGIONS.length; i++) alphas[CG.REGIONS[i].key] = alpha;
    var mem = solveNash(alphas, funds);
    var outcome = computeOutcome(mem, funds);
    results.push({
      alpha: alpha,
      membership: Object.assign({}, mem),
      coverage: outcome.coverage,
      T: outcome.T,
      globalNet: outcome.globalNet,
    });
  }
  return results;
}

// ── Trapezoidal integration (for chart series) ────────────────────
function cumTrap(arr) {
  if (!arr || !arr.length) return 0;
  var s = 0;
  for (var i = 0; i < arr.length - 1; i++) s += 0.5 * (arr[i] + arr[i + 1]) * 5;
  return s;
}

// ── Default state helpers ─────────────────────────────────────────
function defaultMembership() {
  var m = {};
  for (var i = 0; i < CG.REGIONS.length; i++) m[CG.REGIONS[i].key] = true;
  return m;
}
function defaultAlphas(val) {
  val = val != null ? val : 0.5;
  var a = {};
  for (var i = 0; i < CG.REGIONS.length; i++) a[CG.REGIONS[i].key] = val;
  return a;
}
function defaultFunds() {
  var f = {};
  for (var i = 0; i < CG.REGIONS.length; i++) {
    f[CG.REGIONS[i].key] = { ccf: 0, af: 0, ld: 0, forest: 0 };
  }
  return f;
}

// ── Public API ────────────────────────────────────────────────────
CG.engine = {
  computeTemperature,
  temperaturePath,
  coalitionCoverage,
  forestPool,
  cumDamageAtT,
  damageSeries,
  transSeries,
  rentLoss,
  tippingProb,
  tippingProbs,
  tippingDamage,
  computeOutcome,
  alphaObjective,
  solveNash,
  criticalAlpha,
  alphaSpectrum,
  cumTrap,
  defaultMembership,
  defaultAlphas,
  defaultFunds,
};

export default CG;
