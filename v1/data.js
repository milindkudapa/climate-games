// Canonical data extracted from Climate Game Master Data workbook + Strategic Reports
// Every number below is either directly from the workbook or a canonical delegation-report figure.
// Anchoring: welfare = damages_avoided − transition_cost_increment − rent_loss (all per canonical table).
const CG = {};

CG.YEARS = [2025, 2030, 2035, 2040, 2045, 2050, 2055, 2060, 2065];

// Baseline climate
CG.T_BASE   = 1.50;  // °C at 2025
CG.TCRE     = 0.56;  // °C per 1000 GtCO2
CG.T_LOW    = 2.49;  // canonical all-Low 2065 temperature
CG.T_MED    = 2.17;  // all-Medium
CG.T_HIGH   = 1.86;  // Grand Coalition all-High
CG.T_TARGET = 1.86;  // target

CG.PRICE_OIL = 75;   // $/bbl

// ─── Regions ─────────────────────────────────────────────────────────────
CG.REGIONS = [
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

// ─── Structural profile ─────────────────────────────────────────────────
// abShare = share of global abatement (sums to ~1.0); used for coalition-coverage arithmetic.
// tempContrib = °C contribution if this bloc defects from Grand Coalition (from reports §4.1).
CG.PROFILE = {
  CHN:{wacc:0.08, abShare:0.286, tempContrib:0.15, gdp25:38, gdp65:97, pop25:1416, pop65:1172},
  IND:{wacc:0.10, abShare:0.202, tempContrib:0.14, gdp25:19, gdp65:91, pop25:1464, pop65:1699},
  EUR:{wacc:0.055,abShare:0.022, tempContrib:0.02, gdp25:25, gdp65:47, pop25:518,  pop65:495 },
  NAM:{wacc:0.08, abShare:0.111, tempContrib:0.05, gdp25:30, gdp65:51, pop25:387,  pop65:456 },
  ASN:{wacc:0.09, abShare:0.080, tempContrib:0.08, gdp25:14, gdp65:50, pop25:699,  pop65:790 },
  AFR:{wacc:0.14, abShare:0.139, tempContrib:0.08, gdp25:13, gdp65:126,pop25:1550, pop65:2990},
  LAM:{wacc:0.08, abShare:0.071, tempContrib:0.06, gdp25:12, gdp65:43, pop25:668,  pop65:735 },
  RUS:{wacc:0.09, abShare:0.036, tempContrib:0.03, gdp25:7,  gdp65:12, pop25:144,  pop65:126 },
  GCC:{wacc:0.07, abShare:0.023, tempContrib:0.02, gdp25:5,  gdp65:9,  pop25:61,   pop65:80  },
};
// (ab-shares derived from report §4.1: temperature increments / 0.63°C total span).

// ─── GDP trajectory (cumulative 2025–65, $bn) from Sheet 17 ─────────────
CG.GDP_CUM = {
  CHN:43174, IND:93436, EUR:14069, NAM:15807, ASN:63541,
  AFR:138911, LAM:31655, RUS:4257,  GCC:8159,
};

// ─── Total transition cost A+B+C ($bn/yr) — Sheet 9 (4e Total Transition) ──
CG.TRANS = {
  CHN:{L:[608,667,816,978,1109,1119,1104,1106,1051],
       M:[608,677,838,1013,1153,1159,1135,1125,1057],
       H:[608,693,886,1067,1213,1229,1193,1173,1092]},
  IND:{L:[185,279,484,768,1033,1183,1309,1486,1582],
       M:[185,277,490,783,1046,1178,1300,1462,1542],
       H:[185,282,510,810,1087,1238,1352,1508,1582]},
  EUR:{L:[165,196,275,357,419,429,425,428,417],
       M:[165,201,289,379,449,462,456,456,442],
       H:[165,210,307,400,470,482,471,468,450]},
  NAM:{L:[184,207,280,361,421,434,441,461,464],
       M:[184,218,307,406,485,508,516,537,541],
       H:[184,231,350,459,547,577,572,582,572]},
  ASN:{L:[109,152,242,357,453,497,532,583,604],
       M:[109,151,241,365,474,523,557,607,620],
       H:[109,156,262,397,513,567,597,644,653]},
  AFR:{L:[53,101,222,441,701,922,1173,1538,1875],
       M:[53,110,265,528,842,1115,1401,1809,2175],
       H:[53,113,276,547,871,1147,1446,1867,2240]},
  LAM:{L:[90,123,191,281,359,398,424,459,473],
       M:[90,126,199,292,373,416,444,481,494],
       H:[90,129,205,300,383,424,451,487,500]},
  RUS:{L:[78,101,152,216,264,281,291,312,317],
       M:[78,104,161,231,284,303,316,339,343],
       H:[78,112,179,258,321,344,352,374,375]},
  GCC:{L:[45,61,93,138,177,198,220,254,276],
       M:[45,64,104,160,212,243,270,312,340],
       H:[45,71,128,193,251,287,308,343,361]},
};
// Trapezoidal cumulative totals (reference, from Sheet 9 col J):
// CHN L=38643 M=39663 H=41520 (incr H−L = 2878 ≈ 2905 canonical)
// IND L=37128 M=36998 H=38353 (incr ≈ 1225)
// EUR L=14100 M=14978 H=15578 (incr ≈ 1478)
// NAM L=14645 M=16698 H=18480 (incr ≈ 3835)
// ASN L=15863 M=16413 H=17585 (incr ≈ 1723)
// AFR L=30310 M=35920 H=37068 (incr ≈ 6758)
// LAM L=12583 M=13115 H=13370 (incr ≈ 788)
// RUS L=9073  M=9743  H=10833 (incr ≈ 1760)
// GCC L=6508  M=7788  H=8920  (incr ≈ 2413 ≈ 2408 canonical)

// ─── Total climate damages ($bn/yr) — Sheet 10 (5a Total Damages) ──────
// Low trajectory (all-Low, 2.49°C at 2065)
CG.DAM = {
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
// Cumulative damages (Sheet 10 col J), reference:
// CHN L=43174 M=35108 H=29291    (saved H−L = −13883) ✓
// IND L=93436 M=76121 H=63744    (saved = −29692) ✓
// EUR L=14069 M=10508 H=8288     (saved = −5781) ✓
// NAM L=15807 M=12643 H=10390    (saved = −5417) ✓
// ASN L=63541 M=51699 H=41345    (saved = −22196) ✓
// AFR L=138911 M=110839 H=90872  (saved = −48039) ✓
// LAM L=31655 M=24469 H=19834    (saved = −11821) ✓
// RUS L=4257  M=3231  H=2444     (saved = −1813)  ✓
// GCC L=8159  M=6710  H=5503     (saved = −2656)  ✓

// ─── Fossil-fuel rent retained (cumulative $bn) — Sheet 8 ─────────────
// Cols: Low retained | Medium retained | High retained | Rent Loss at Grand Coalition
CG.RENT_CUM = {
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

// ─── Unilateral rent loss (only own bloc at High) — Sheet 17 col 3 ────
CG.RENT_UNI = {
  CHN: 0,  IND: 0,  EUR: 0, NAM: 0, ASN: 0,
  AFR: 64, LAM: 25, RUS: 71, GCC: 652,
};

// ─── Canonical welfare table (Sheet 17, cols G-I cumulative) ──────────
// Grand Coalition: cols = [Trans_incr, Rent_loss, Trans+Rent, GDP_cum, Dam_Low, Dam_High, ..., Dam_Saved, Net_Welfare]
CG.CANONICAL = {
  // [TransIncr, RentLoss, DamSaved, NetWelfare]    — all $bn cumulative 2025–65
  // Values below are the exact Sheet 17 Grand Coalition numbers.
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
CG.GLOBAL_CANONICAL = { trans:22893, rent:18654, saved:141298, net:99751 };

// ─── Five-paths benchmark table (from each strategic report §3) ───────
// Each row: [coverage, T_2065, net_welfare_for_own_bloc_in_$bn]
CG.PATHS = {
  CHN: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"Unilateral High (28.6%)",      coverage:0.286, T:2.34, net:250,   inCoal:true },
    {label:"China+India (48.8%)",          coverage:0.488, T:2.20, net:2500,  inCoal:true },
    {label:"80% minimum (80.4%)",          coverage:0.804, T:1.99, net:7960,  inCoal:true },
    {label:"No USA (8-region, 88.8%)",     coverage:0.888, T:1.91, net:9590,  inCoal:true },
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:10458, inCoal:true },
  ],
  IND: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"80% minimum (80.4%)",          coverage:0.804, T:1.99, net:22820, inCoal:true },
    {label:"No USA (8-region, 88.8%)",     coverage:0.888, T:1.91, net:26400, inCoal:true },
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:28333, inCoal:true },
  ],
  EUR: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"Defect, others form 80min",    coverage:0.804, T:1.99, net:4690,  inCoal:false},
    {label:"80% min + (86.7%)",            coverage:0.867, T:1.94, net:3890,  inCoal:true },
    {label:"No USA (8-region, 88.8%)",     coverage:0.888, T:1.91, net:3910,  inCoal:true },
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:4290,  inCoal:true },
  ],
  NAM: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"Defect, others High",          coverage:0.888, T:1.91, net:5050,  inCoal:false},
    {label:"80% minimum (80.4%)",          coverage:0.804, T:1.99, net:560,   inCoal:true },
    {label:"No GCC + Russia (90.5%)",      coverage:0.905, T:1.91, net:1190,  inCoal:true },
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:1556,  inCoal:true },
  ],
  ASN: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"80% minimum (80.4%)",          coverage:0.804, T:1.99, net:16280, inCoal:true },
    {label:"No USA (8-region, 88.8%)",     coverage:0.888, T:1.91, net:18960, inCoal:true },
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:20446, inCoal:true },
  ],
  AFR: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"80% minimum (80.4%)",          coverage:0.804, T:1.99, net:31080, inCoal:true },
    {label:"No USA (8-region, 88.8%)",     coverage:0.888, T:1.91, net:36770, inCoal:true },
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:39973, inCoal:true },
  ],
  LAM: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,     inCoal:false},
    {label:"Stay Low, others 80min",       coverage:0.804, T:1.99, net:8700,  inCoal:false},
    {label:"No USA (8-region, 88.8%)",     coverage:0.888, T:1.91, net:9250,  inCoal:true },
    {label:"Grand Coalition (99.9%)",      coverage:0.999, T:1.86, net:9945,  inCoal:true },
  ],
  RUS: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,      inCoal:false},
    {label:"Defect, others form 7-region", coverage:0.905, T:1.91, net:-310,   inCoal:false},
    {label:"Join Grand, no compensation",  coverage:0.999, T:1.86, net:-2147,  inCoal:true },
    {label:"Join Grand + side payment",    coverage:0.999, T:1.86, net:0,      inCoal:true },
    {label:"No USA (8-region, 88.8%)",     coverage:0.888, T:1.91, net:-2020,  inCoal:true },
  ],
  GCC: [
    {label:"All Low (no coalition)",       coverage:0.000, T:2.49, net:0,      inCoal:false},
    {label:"Defect, others form 7-region", coverage:0.905, T:1.91, net:-9670,  inCoal:false},
    {label:"Join Grand, no compensation",  coverage:0.999, T:1.86, net:-13162, inCoal:true },
    {label:"Join Grand + side payment",    coverage:0.999, T:1.86, net:0,      inCoal:true },
    {label:"No USA (8-region, 88.8%)",     coverage:0.888, T:1.91, net:-11850, inCoal:true },
  ],
};

// ─── Canonical "others at Medium while own at High" (Sheet 17 R20-R28) ──
// Used for sensitivity comparisons: net welfare when own=H, others=M
CG.OWN_HIGH_OTHERS_MED = {
  CHN:31784, IND:21585, EUR:5981, NAM:9374, ASN:10435,
  AFR:4320,  LAM:3668,  RUS:4462, GCC:2192,
};

// ─── Canonical "unilateral" — own=H others=L (Sheet 17 R6-R14) ─────────
CG.OWN_HIGH_OTHERS_LOW = {
  CHN:1072, IND:4515, EUR:-1090, NAM:-3284, ASN:104,
  AFR:-2237, LAM:-318, RUS:-1757, GCC:-2971,
};

// ─── Damage parameters (display only — canonical damages already include these) ───
CG.DAM_PARAMS = {
  CHN:{beta:0.18, phi:0.18, alpha:0.02},
  IND:{beta:0.28, phi:0.25, alpha:0.03},
  EUR:{beta:0.12, phi:0.15, alpha:0.02},
  NAM:{beta:0.13, phi:0.16, alpha:0.02},
  ASN:{beta:0.24, phi:0.22, alpha:0.03},
  AFR:{beta:0.35, phi:0.30, alpha:0.04},
  LAM:{beta:0.22, phi:0.20, alpha:0.03},
  RUS:{beta:0.10, phi:0.14, alpha:0.02},
  GCC:{beta:0.20, phi:0.22, alpha:0.03},
};

// ─── Funds (defaults; user edits in the fund tab) ──────────────────────
CG.FUNDS_DEFAULT = {
  CCF:  { NAM:450, EUR:550, CHN:250, GCC:100, ASN:50, RUS:0, LAM:0, IND:0, AFR:0 },
  LDF:  { NAM:200, EUR:250, CHN:100, GCC:80,  ASN:20, RUS:0, LAM:0, IND:0, AFR:0 },
  ADAPT:{ NAM:150, EUR:200, CHN:50,  GCC:30,  ASN:20, RUS:0, LAM:0, IND:0, AFR:0 },
  FOREST:{ NAM:80, EUR:100, CHN:30,  GCC:20,  ASN:10, RUS:0, LAM:0, IND:0, AFR:0 },
};

// ─── Tipping points (for display only — already folded into canonical damages) ─
CG.TIPS = [
  {name:"Coral reefs",    T_mid:1.8, Pmax:0.90},
  {name:"Permafrost",     T_mid:2.0, Pmax:0.80},
  {name:"Ice sheet",      T_mid:2.2, Pmax:0.65},
  {name:"Amazon",         T_mid:3.0, Pmax:0.65},
  {name:"AMOC",           T_mid:3.0, Pmax:0.50},
];

export default CG;
