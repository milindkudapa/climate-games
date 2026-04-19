// Climate Game — Canonical data (spec sections 2.1–2.9 + workbook)
// Binary coalition model: IN = High ambition, OUT = Low ambition

const YEARS = [2025, 2030, 2035, 2040, 2045, 2050, 2055, 2060, 2065];

// ─── Climate parameters ──────────────────────────────────────────────
const T_BASE      = 1.50;   // °C baseline at 2025 (Copernicus/ERA5)
const TCRE        = 0.56;   // °C per 1000 GtCO₂ (IPCC AR6 central)
const T_LOW       = 2.49;   // all-Low 2065 temperature
const T_MED       = 2.10;   // all-Medium (spec 2.5)
const T_HIGH      = 1.86;   // Grand Coalition all-High
const T_TARGET    = 1.86;
const CUM_CO2_LOW = 1768;   // GtCO₂ cumulative 2025-65 under all-Low
const CUM_CO2_HIGH= 643;    // under all-High
const ABATEMENT_MAX = 1125; // CUM_CO2_LOW - CUM_CO2_HIGH
const FOREST_MAX_GT = 86;   // max GtCO₂ from forest fund
const FOREST_MAX_BN = 100;  // $bn pool for full forest effect
const PRICE_OIL   = 75;     // $/bbl

// ─── Regions ─────────────────────────────────────────────────────────
const REGIONS = [
  { key:"CHN", name:"China",         color:"#C8102E" },
  { key:"IND", name:"India",         color:"#FF9933" },
  { key:"EUR", name:"Europe",        color:"#003399" },
  { key:"NAM", name:"North America", color:"#1f4e79" },
  { key:"ASN", name:"ASEAN",         color:"#008751" },
  { key:"AFR", name:"Africa",        color:"#6b8e23" },
  { key:"LAM", name:"Latin America", color:"#009C3B" },
  { key:"RUS", name:"Russia",        color:"#8B0000" },
  { key:"GCC", name:"GCC",           color:"#B8860B" },
];

// ─── Abatement shares (spec 2.1, sum = 0.999) ───────────────────────
const PROFILE = {
  CHN: { abShare: 0.286 },
  IND: { abShare: 0.202 },
  EUR: { abShare: 0.063 },
  NAM: { abShare: 0.111 },
  ASN: { abShare: 0.105 },
  AFR: { abShare: 0.100 },
  LAM: { abShare: 0.038 },
  RUS: { abShare: 0.054 },
  GCC: { abShare: 0.040 },
};

// ─── GDP cumulative 2025-2065 in $tn (spec 2.2) ─────────────────────
const GDP_CUM_TN = {
  CHN: 3127.5, IND: 2015.0, EUR: 1480.0, NAM: 1677.5,
  ASN: 1310.0, AFR: 2102.5, LAM: 1102.5, RUS: 399.75, GCC: 289.5,
};
const GDP_CUM_TOTAL_TN = Object.values(GDP_CUM_TN).reduce((a,b)=>a+b, 0); // 13504.25

// ─── Energy transition cost increment HIGH-LOW cumulative $bn (spec 2.3) ─
const ENERGY_INCR = {
  CHN: 2877.5, IND: 1225.0, EUR: 1477.5, NAM: 3835.0,
  ASN: 1722.5, AFR: 6757.5, LAM: 787.5,  RUS: 1760.0, GCC: 2412.5,
};

// ─── Rent loss at Grand Coalition $bn (spec 2.4) ────────────────────
const RENT_LOSS_GC = {
  CHN: 520,   IND: 44,   EUR: 0,    NAM: 0,    ASN: 0,
  AFR: 1384,  LAM: 1096, RUS: 2200, GCC: 13410,
};

// ─── Cumulative damages at LOW/MED/HIGH $bn (spec 2.5) ──────────────
const DAM_CUM = {
  CHN: { L: 43174, M: 35108, H: 29291 },
  IND: { L: 93436, M: 76121, H: 63744 },
  EUR: { L: 14069, M: 10508, H: 8288  },
  NAM: { L: 15807, M: 12643, H: 10390 },
  ASN: { L: 63541, M: 51699, H: 41345 },
  AFR: { L:138911, M:110839, H: 90872 },
  LAM: { L: 31655, M: 24469, H: 19834 },
  RUS: { L: 4257,  M: 3231,  H: 2444  },
  GCC: { L: 8159,  M: 6710,  H: 5503  },
};

// ─── Per-year damage series ($bn/yr) — for charts ───────────────────
const DAM = {
  CHN:{L:[336,439,577,717,905,1122,1365,1634,1789],
       M:[336,437,563,678,816,959,1096,1233,1266],
       H:[336,433,546,633,728,817,896,972,970]},
  IND:{L:[402,593,887,1365,1961,2638,3369,4160,4812],
       M:[402,589,865,1291,1778,2269,2729,3164,3428],
       H:[402,585,839,1208,1595,1948,2251,2522,2658]},
  EUR:{L:[97,124,158,204,259,320,387,455,522],
       M:[97,123,153,191,231,268,302,333,356],
       H:[97,122,148,177,203,225,240,254,264]},
  NAM:{L:[127,160,203,258,325,399,477,557,633],
       M:[127,159,198,244,292,339,381,418,446],
       H:[127,158,191,227,259,287,309,326,338]},
  ASN:{L:[303,447,649,939,1302,1681,2039,2357,2617],
       M:[303,443,629,878,1166,1432,1648,1805,1898],
       H:[303,439,604,807,1023,1201,1327,1404,1437]},
  AFR:{L:[380,603,951,1506,2376,3551,5128,7065,8810],
       M:[380,599,926,1419,2148,3048,4152,5378,6283],
       H:[380,594,895,1319,1915,2606,3417,4282,4872]},
  LAM:{L:[153,214,300,420,590,797,1029,1277,1508],
       M:[153,213,292,394,530,677,823,956,1054],
       H:[153,211,281,366,471,574,668,750,803]},
  RUS:{L:[26,35,46,59,76,95,115,133,150],
       M:[26,34,44,56,66,79,89,98,105],
       H:[26,34,42,50,57,64,69,73,76]},
  GCC:{L:[54,74,99,131,171,212,257,304,346],
       M:[54,73,95,121,153,185,218,250,274],
       H:[54,73,93,114,138,162,187,211,225]},
};

// ─── Per-year transition cost A+B+C ($bn/yr) — for charts ───────────
const TRANS = {
  CHN:{L:[608,667,816,978,1109,1119,1104,1106,1051],
       H:[608,693,886,1067,1213,1229,1193,1173,1092]},
  IND:{L:[185,279,484,768,1033,1183,1309,1486,1582],
       H:[185,282,510,810,1087,1238,1352,1508,1582]},
  EUR:{L:[165,196,275,357,419,429,425,428,417],
       H:[165,210,307,400,470,482,471,468,450]},
  NAM:{L:[184,207,280,361,421,434,441,461,464],
       H:[184,231,350,459,547,577,572,582,572]},
  ASN:{L:[109,152,242,357,453,497,532,583,604],
       H:[109,156,262,397,513,567,597,644,653]},
  AFR:{L:[53,101,222,441,701,922,1173,1538,1875],
       H:[53,113,276,547,871,1147,1446,1867,2240]},
  LAM:{L:[90,123,191,281,359,398,424,459,473],
       H:[90,129,205,300,383,424,451,487,500]},
  RUS:{L:[78,101,152,216,264,281,291,312,317],
       H:[78,112,179,258,321,344,352,374,375]},
  GCC:{L:[45,61,93,138,177,198,220,254,276],
       H:[45,71,128,193,251,287,308,343,361]},
};

// ─── Fossil rent retained cumulative $bn — for rent interpolation ───
const RENT_CUM = {
  CHN:{L:1060, M:800,  H:540,  lossGC: 520  },
  IND:{L:86,   M:64,   H:42,   lossGC: 44   },
  EUR:{L:0,    M:0,    H:0,    lossGC: 0    },
  NAM:{L:0,    M:0,    H:0,    lossGC: 0    },
  ASN:{L:0,    M:0,    H:0,    lossGC: 0    },
  AFR:{L:1166, M:875,  H:585,  lossGC: 1384 },
  LAM:{L:1141, M:858,  H:576,  lossGC: 1096 },
  RUS:{L:2336, M:1751, H:1167, lossGC: 2200 },
  GCC:{L:28848,M:21609,H:14370,lossGC: 13410},
};

// ─── Tipping points (Overview Booklet Table 5 + Excel Sheet 5c) ────
// P(T) = Pmax / (1 + exp(-s × (T - Tstar)))
// Tstar = T_mid from booklet, s derived to match P@1.86°C and P@2.49°C
// globalCost and regional are informational (damage already baked into DAM/DAM_CUM)
const TIPS = [
  { name:"Coral Reef Die-off",     Tstar:1.80, s:5.23, Pmax:0.90, globalCost:8000,
    regional:{ ASN:2000, GCC:500 } },
  { name:"Permafrost C Release",   Tstar:2.00, s:4.03, Pmax:0.80, globalCost:3000,
    regional:{ RUS:1000 } },
  { name:"Ice Sheet Commitment",   Tstar:2.20, s:3.05, Pmax:0.65, globalCost:5000,
    regional:{ ASN:1000, NAM:500, EUR:500, CHN:500 } },
  { name:"Amazon Dieback",         Tstar:3.00, s:3.03, Pmax:0.65, globalCost:6000,
    regional:{ LAM:3000 } },
  { name:"AMOC Weakening",         Tstar:3.00, s:2.14, Pmax:0.50, globalCost:4000,
    regional:{ EUR:2000, NAM:1000 } },
];

// ─── Canonical welfare at Grand Coalition (reference, spec) ─────────
const CANONICAL = {
  CHN:{trans:2905,  rent:520,   saved:13883, net:10458},
  IND:{trans:1275,  rent:44,    saved:29692, net:28373},
  EUR:{trans:1468,  rent:0,     saved:5781,  net:4313 },
  NAM:{trans:3865,  rent:0,     saved:5417,  net:1552 },
  ASN:{trans:1750,  rent:0,     saved:22196, net:20446},
  AFR:{trans:6682,  rent:1384,  saved:48039, net:39973},
  LAM:{trans:780,   rent:1096,  saved:11821, net:9945 },
  RUS:{trans:1760,  rent:2200,  saved:1813,  net:-2147},
  GCC:{trans:2408,  rent:13410, saved:2656,  net:-13162},
};
const GLOBAL_CANONICAL = { trans:22893, rent:18654, saved:141298, net:99751 };

// ─── Five-Paths benchmark (from strategic reports) ───────────────────
const PATHS = {
  CHN: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"Unilateral High (28.6%)",      coverage:0.286, T:2.34, net:250,   inCoal:true },
    {label:"China+India (48.8%)",          coverage:0.488, T:2.20, net:2500,  inCoal:true },
    {label:"80% minimum (80.4%)",          coverage:0.804, T:1.99, net:7960,  inCoal:true },
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:10458, inCoal:true },
  ],
  IND: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"80% minimum (80.4%)",          coverage:0.804, T:1.99, net:22820, inCoal:true },
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:28333, inCoal:true },
  ],
  EUR: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"Defect, others 80min",         coverage:0.804, T:1.99, net:4690,  inCoal:false},
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:4290,  inCoal:true },
  ],
  NAM: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"Defect, others High",          coverage:0.888, T:1.91, net:5050,  inCoal:false},
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:1556,  inCoal:true },
  ],
  ASN: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"80% minimum (80.4%)",          coverage:0.804, T:1.99, net:16280, inCoal:true },
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:20446, inCoal:true },
  ],
  AFR: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"80% minimum (80.4%)",          coverage:0.804, T:1.99, net:31080, inCoal:true },
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:39973, inCoal:true },
  ],
  LAM: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"Stay Low, others 80min",       coverage:0.804, T:1.99, net:8700,  inCoal:false},
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:9945,  inCoal:true },
  ],
  RUS: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"Join Grand, no compensation",  coverage:0.999, T:1.86, net:-2147, inCoal:true },
    {label:"Join Grand + side payment",    coverage:0.999, T:1.86, net:0,     inCoal:true },
  ],
  GCC: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"Defect, 7-region",            coverage:0.905, T:1.91, net:-9670, inCoal:false},
    {label:"Join Grand, no compensation",  coverage:0.999, T:1.86, net:-13162,inCoal:true },
    {label:"Join Grand + side payment",    coverage:0.999, T:1.86, net:0,     inCoal:true },
  ],
};

// ─── Ideal World fund allocations $bn (spec 6.3) ────────────────────
// Positive = contributor, negative = recipient
const IDEAL_FUNDS = {
  NAM: { ccf: 2500, af: 1500, ld: 1500, forest: 500  },
  EUR: { ccf: 3000, af: 1500, ld: 1000, forest: 1000 },
  CHN: { ccf: 1000, af: 500,  ld: 0,    forest: 500  },
  IND: { ccf:-2000, af:-500,  ld: 0,    forest: 0    },
  ASN: { ccf:-1500, af:-1000, ld:-500,  forest: 0    },
  AFR: { ccf:-3000, af:-1500, ld:-1500, forest: 0    },
  LAM: { ccf: 0,    af: 0,    ld: 0,    forest:-2000 },
  RUS: { ccf: 0,    af: 0,    ld:-1000, forest:-500  },
  GCC: { ccf: 0,    af: 0,    ld:-10000,forest: 500  },
};

const CG = {
  YEARS, T_BASE, TCRE, T_LOW, T_MED, T_HIGH, T_TARGET,
  CUM_CO2_LOW, CUM_CO2_HIGH, ABATEMENT_MAX,
  FOREST_MAX_GT, FOREST_MAX_BN, PRICE_OIL,
  REGIONS, PROFILE, GDP_CUM_TN, GDP_CUM_TOTAL_TN,
  ENERGY_INCR, RENT_LOSS_GC, DAM_CUM, DAM, TRANS, RENT_CUM,
  TIPS, CANONICAL, GLOBAL_CANONICAL, PATHS, IDEAL_FUNDS,
};

export default CG;
