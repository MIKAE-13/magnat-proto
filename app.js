/* MAGNAT — prototype jouable v0.2 (Mouriès)
   Économie v0.3 validée par simulation (sim/RESULTS.md).
   v0.2 : bourse jouable, bâtiments 3D renforcés, « S'y rendre », liquidités HUD. */

"use strict";

// ---------------------------------------------------------------------------
// Économie (constantes v0.3)
// ---------------------------------------------------------------------------
const ECO = {
  start: 50_000,
  rentDay: 0.015,
  capH: 8,
  inspectMult: 2,
  inspectWeekendMult: 3,
  inspectDurH: 24,
  upCost: [0.4, 1.2, 3.0],
  upMult: [1.5, 2.2, 3.2],
  upNames: ["Ravalement", "Gentrification", "Flagship"],
  monoMult: 2,
  chargesDay: 0.001,
  flip: 1.5,
  radiusM: 300,
  questDay: 300,
  npcGraceD: 5,
  npcEveryD: 4,
};

const CAT_META = {
  cafe:        { label: "Café",             plural: "cafés",              icon: "☕" },
  bar:         { label: "Bar",              plural: "bars",               icon: "🍷" },
  boulangerie: { label: "Boulangerie",      plural: "boulangeries",       icon: "🥖" },
  restaurant:  { label: "Restaurant",       plural: "restaurants",        icon: "🍽️" },
  commerce:    { label: "Commerce",         plural: "commerces",          icon: "🛍️" },
  artisanat:   { label: "Moulin & Domaine", plural: "moulins & domaines", icon: "🫒" },
  culture:     { label: "Culture",          plural: "hauts lieux",        icon: "🏛️" },
  sport:       { label: "Sport",            plural: "arènes & stades",    icon: "🏟️" },
};

const HOUR = 3_600_000, DAY = 24 * HOUR;
const NPC_NAME = "Jean-Mi Bétonneur";

// Titres de progression (satire oblige)
const TITLES = [
  ["Petit Porteur", 0],
  ["Multipropriétaire", 75_000],
  ["Marchand de Sommeil", 150_000],
  ["Baron", 300_000],
  ["Magnat", 600_000],
  ["Oligarque", 1_200_000],
  ["Trop Gros Pour Faire Faillite", 2_500_000],
];

// Défis du jour (3 par jour, récompenses réelles — plus de rente magique)
const QUEST_DEFS = {
  collect: { label: "Encaisser 5 loyers", target: 5, reward: 150 },
  tournee: { label: "Faire la tournée d'un bien (sur place)", target: 1, reward: 150 },
  bourse:  { label: "Passer un ordre en Bourse", target: 1, reward: 150 },
  invest:  { label: "Acheter ou améliorer un bien", target: 1, reward: 200 },
};

// ---------------------------------------------------------------------------
// La cote (bourse) — personnalités issues de la simulation
// ---------------------------------------------------------------------------
const TICKERS = {
  KWA: { name: "KAWA GROUP",          icon: "☕", drift: 0.0006, vol: 0.012, div: 0.0036, desc: "Cafés & torréfacteurs — cyclique du matin" },
  GLU: { name: "GLUTEN & FILS",       icon: "🥖", drift: 0.0004, vol: 0.008, div: 0.0060, desc: "Boulangeries — valeur de bon père de famille" },
  HBL: { name: "HOUBLON HOLDING",     icon: "🍺", drift: 0.0006, vol: 0.014, div: 0.0030, desc: "Bars & brasseries — monte quand il fait soif" },
  FKT: { name: "FOURCHETTE CAPITAL",  icon: "🍽️", drift: 0.0005, vol: 0.013, div: 0.0030, desc: "Restaurants — sensible aux événements" },
  CDD: { name: "CADDIE NATIONAL",     icon: "🛒", drift: 0.0003, vol: 0.006, div: 0.0054, desc: "Commerces — défensive, ennuyeuse, sûre" },
  CDV: { name: "CULTURE & DIVIDENDES",icon: "🎭", drift: 0.0004, vol: 0.015, div: 0.0024, desc: "Culture — saisonnière, festivals" },
  TRN: { name: "TRANSIT NATIONAL",    icon: "🚆", drift: 0.0002, vol: 0.018, div: 0.0045, desc: "Transports — volatile, grèves comprises" },
  VRT: { name: "VERTLIGNE",           icon: "🌿", drift: 0.0004, vol: 0.016, div: 0.0018, desc: "Sport & plein air — météo-dépendante" },
  SBT: { name: "STARTUPBRO TECH",     icon: "🚀", drift: 0.0012, vol: 0.055, div: 0,      desc: "Jamais rentable. Pure spéculation. Bonne chance." },
};

const MARKET_EVENTS = [
  { head: "GRÈVE DES TRANSPORTS — Transit National dévisse, les bars trinquent (dans le bon sens).", shocks: { TRN: -0.20, HBL: +0.06 } },
  { head: "CANICULE — Vertligne et Houblon s'envolent, plus personne ne boit de café chaud.",       shocks: { VRT: +0.15, HBL: +0.10, KWA: -0.08 } },
  { head: "SCANDALE CHEZ GLUTEN & FILS — « c'était de la farine de chantier ».",                    shocks: { GLU: -0.22, FKT: -0.08 } },
  { head: "FESTIVAL RÉGIONAL — la culture rapporte. Pour une fois.",                                shocks: { CDV: +0.18, FKT: +0.08, KWA: +0.05 } },
  { head: "STARTUPBRO LÈVE ENCORE — personne ne sait ce qu'ils vendent, tout le monde achète.",     shocks: { SBT: +0.90 } },
  { head: "LE PIVOT DE TROP — la bulle StartupBro éclate.",                                         shocks: { SBT: -0.55 } },
  { head: "PÉNURIE DE BEURRE — les fournils au bord de la crise de nerfs, les cours montent.",      shocks: { GLU: +0.12, KWA: +0.04 } },
];

// ---------------------------------------------------------------------------
// État persistant
// ---------------------------------------------------------------------------
const SAVE_KEY = "magnat-proto-v1";

function freshStocks() {
  const st = {};
  for (const sym in TICKERS) st[sym] = { price: 100, dayOpen: 100, shares: 0, hist: [100], halted: 0 };
  return st;
}

function freshState() {
  return {
    cash: ECO.start,
    gameMs: 0,
    startDow: new Date().getDay(),
    owned: {},
    npc: [],
    lastNpcDay: 0,
    lastChargesDay: 0,
    lastQuestDay: -1,
    firstMonopolyDay: -1,
    monopolies: [],
    journal: [],
    onboarded: false,
    stocks: freshStocks(),
    stockHour: 0,
    eventNow: null,
    dayWorthDay: -1,
    dayWorth: ECO.start,
    quests: { day: -1, items: [] },
    titleIdx: 0,
    streak: 0,
    streakDay: -1,
    journalRead: 0,
    indexHist: [35_420],
    indexDayOpen: 35_420,
  };
}

let S = load();
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const st = Object.assign(freshState(), parsed);
      st.stocks = Object.assign(freshStocks(), parsed.stocks || {});
      return st;
    }
  } catch (e) { /* état neuf */ }
  return freshState();
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  }, 300);
}

// ---------------------------------------------------------------------------
// Temps de jeu & helpers
// ---------------------------------------------------------------------------
let speed = 1;
let lastReal = Date.now();

const gameDay = () => Math.floor(S.gameMs / DAY);
const isWeekend = () => {
  const dow = (S.startDow + gameDay()) % 7;
  return dow === 0 || dow === 6;
};
const fmt = (n) => Math.round(n).toLocaleString("fr-FR") + " ₣";
const byId = {};
PLACES.forEach((p) => (byId[p.id] = p));

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function dist(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------------------------------------------------------------------------
// Immobilier
// ---------------------------------------------------------------------------
function placeValue(p) {
  const o = S.owned[p.id];
  const invested = o ? ECO.upCost.slice(0, o.level).reduce((a, b) => a + b, 0) : 0;
  return p.price * (1 + invested);
}

function hasMonopoly(cat) {
  const group = PLACES.filter((p) => p.cat === cat);
  return group.length >= 2 && group.every((p) => S.owned[p.id]);
}

function rentMult(p) {
  const o = S.owned[p.id];
  let m = o.level > 0 ? ECO.upMult[o.level - 1] : 1;
  if (S.gameMs < (o.inspectedUntil || 0)) {
    m *= isWeekend() ? ECO.inspectWeekendMult : ECO.inspectMult;
  }
  if (hasMonopoly(p.cat)) m *= ECO.monoMult;
  return m;
}

const rentPerDay = (p) => p.price * ECO.rentDay * rentMult(p);

function accrued(p) {
  const o = S.owned[p.id];
  const hours = Math.min((S.gameMs - o.lastCollect) / HOUR, ECO.capH);
  return (rentPerDay(p) / 24) * Math.max(0, hours);
}

function stockValue() {
  let v = 0;
  for (const sym in S.stocks) v += S.stocks[sym].shares * S.stocks[sym].price;
  return v;
}

function netWorth() {
  let w = S.cash + stockValue();
  for (const id in S.owned) w += placeValue(byId[id]) + accrued(byId[id]);
  return w;
}

function monopolyTarget() {
  let best = null;
  for (const cat in CAT_META) {
    const group = PLACES.filter((p) => p.cat === cat);
    if (group.length < 2) continue;
    const mine = group.filter((p) => S.owned[p.id]).length;
    if (mine === 0 || mine === group.length) continue;
    const cost = group.filter((p) => !S.owned[p.id])
      .reduce((a, p) => a + p.price * (S.npc.includes(p.id) ? ECO.flip : 1), 0);
    if (!best || cost < best.cost) best = { cat, mine, total: group.length, cost };
  }
  return best;
}

function journal(text) {
  S.journal.unshift({ day: gameDay(), text });
  S.journal = S.journal.slice(0, 80);
  save();
}

// ---------------------------------------------------------------------------
// Défis du jour, titres, série
// ---------------------------------------------------------------------------
function ensureQuests() {
  const d = gameDay();
  if (S.quests.day === d) return;
  S.quests = {
    day: d,
    items: ["collect", "tournee", d % 2 ? "bourse" : "invest"].map((id) => ({
      id, progress: 0, done: false,
    })),
  };
}

function questBump(id) {
  ensureQuests();
  const q = S.quests.items.find((x) => x.id === id && !x.done);
  if (!q) return;
  q.progress += 1;
  const def = QUEST_DEFS[q.id];
  if (q.progress >= def.target) {
    q.done = true;
    S.cash += def.reward;
    toast(`🎯 Défi accompli : ${def.label} — +${fmt(def.reward)}`, "gain");
  }
  updateHUD(); save();
}

function bumpStreak() {
  const d = gameDay();
  if (S.streakDay === d) return;
  S.streak = S.streakDay === d - 1 ? S.streak + 1 : 1;
  S.streakDay = d;
}

function checkTitle() {
  const w = netWorth();
  let idx = 0;
  TITLES.forEach(([_, min], i) => { if (w >= min) idx = i; });
  if (idx > S.titleIdx) {
    S.titleIdx = idx;
    const name = TITLES[idx][0];
    headline(`<b>PROMOTION SOCIALE.</b> Vous êtes désormais « ${name} ». Vos anciens amis ne vous reconnaissent plus. Tant mieux, dites-vous.`);
    journal(`Vous accédez au rang de <b>${name}</b>.`);
  }
}

// ---------------------------------------------------------------------------
// Actions immobilières
// ---------------------------------------------------------------------------
const priceToPay = (p) => (S.npc.includes(p.id) ? p.price * ECO.flip : p.price);
const inRange = (p) => player && dist(player.lat, player.lon, p.lat, p.lon) <= ECO.radiusM;

function buy(p) {
  const cost = priceToPay(p);
  if (S.cash < cost || S.owned[p.id]) return;
  const fromNpc = S.npc.includes(p.id);
  S.cash -= cost;
  S.npc = S.npc.filter((id) => id !== p.id);
  S.owned[p.id] = { level: 0, lastCollect: S.gameMs, inspectedUntil: S.gameMs + ECO.inspectDurH * HOUR };
  questBump("invest");
  journal(fromNpc
    ? `Vous avez arraché <b>${p.name}</b> à ${NPC_NAME} pour ${fmt(cost)}. Il boude.`
    : `Acte notarié : <b>${p.name}</b> est à vous pour ${fmt(cost)}. Personne ne vous a rien demandé.`);
  toast(fromNpc ? `😤 Repris à Bétonneur : ${p.name}` : `📜 ${p.name} est à vous !`);
  checkMonopolies(p.cat);
  refreshAllMarkers(); updateHUD(); openSheet(p, true); save();
}

function collect(p) {
  const amount = accrued(p);
  if (amount < 1) return;
  S.cash += amount;
  S.owned[p.id].lastCollect = S.gameMs;
  flyCoin(p, `+${fmt(amount)}`);
  bumpStreak();
  questBump("collect");
  refreshMarker(p); updateHUD(); save();
  if (sheetPlace === p) openSheet(p, true);
}

function collectAll() {
  let total = 0;
  for (const id in S.owned) {
    const a = accrued(byId[id]);
    if (a >= 1) { total += a; S.owned[id].lastCollect = S.gameMs; refreshMarker(byId[id]); }
  }
  if (total >= 1) {
    S.cash += total;
    toast(`🪙 Loyers encaissés : +${fmt(total)}`, "gain");
    updateHUD(); save();
  }
}

function inspect(p) {
  S.owned[p.id].inspectedUntil = S.gameMs + ECO.inspectDurH * HOUR;
  toast(`👔 Le proprio est passé — loyer ×${isWeekend() ? 3 : 2} pendant 24 h`);
  questBump("tournee");
  refreshMarker(p); openSheet(p, true); save();
}

function upgrade(p) {
  const o = S.owned[p.id];
  if (o.level >= 3) return;
  const cost = p.price * ECO.upCost[o.level];
  if (S.cash < cost) return;
  S.cash -= cost;
  o.level += 1;
  journal(`<b>${p.name}</b> passe en « ${ECO.upNames[o.level - 1]} ». Le quartier murmure.`);
  toast(`🏗️ ${ECO.upNames[o.level - 1]} : loyer ×${ECO.upMult[o.level - 1]}`);
  questBump("invest");
  refreshMarker(p); updateHUD(); openSheet(p, true); save();
}

function goTo(p) {
  if (!simMode) enableSim(true);
  setPlayer(p.lat, p.lon, true);
  toast(`🚶 Vous voilà devant ${p.name}`);
  openSheet(p, true);
}

function checkMonopolies(cat) {
  if (!hasMonopoly(cat) || S.monopolies.includes(cat)) return;
  S.monopolies.push(cat);
  if (S.firstMonopolyDay < 0) S.firstMonopolyDay = gameDay();
  const meta = CAT_META[cat];
  headline(`<b>LE MONOPOLE DES ${meta.plural.toUpperCase()} DE MOURIÈS EST À VOUS.</b>
    Les loyers de la catégorie doublent. Le prix de tout augmente mystérieusement.`);
  journal(`MONOPOLE — Mouriès n'a plus qu'un seul propriétaire de ${meta.plural} : vous. Loyers ×2.`);
  updateHUD();
}

// ---------------------------------------------------------------------------
// Bourse : moteur (tick par heure de jeu, séance 9h–18h)
// ---------------------------------------------------------------------------
// L'horloge du jeu démarre à 9h00 : hourOfDay(H) = (9 + H) % 24
function stockTick() {
  const H = Math.floor(S.gameMs / HOUR);
  if (H <= S.stockHour) return;
  let from = S.stockHour + 1;
  if (H - from > 2400) from = H - 2400; // borne anti-rattrapage infini
  let divTotal = 0;

  for (let h = from; h <= H; h++) {
    const hod = (9 + h) % 24;
    const dayI = Math.floor((9 + h) / 24);
    const dow = (S.startDow + dayI) % 7;
    const we = dow === 0 || dow === 6;

    // événement du lundi 10h (choc étalé sur 18 h de séance = 2 jours)
    if (hod === 10 && dow === 1 && !S.eventNow) {
      const ev = MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
      const shocks = {};
      for (const sym in ev.shocks) shocks[sym] = ev.shocks[sym] / 18;
      S.eventNow = { head: ev.head, shocks, hoursLeft: 18 };
      headline(`<b>${ev.head}</b>`);
      journal(`BOURSE — ${ev.head}`);
    }

    if (!we && hod === 9) {
      for (const sym in S.stocks) S.stocks[sym].dayOpen = S.stocks[sym].price;
      S.indexDayOpen = indexValue();
    }

    if (!we && hod >= 9 && hod < 18) {
      for (const sym in S.stocks) {
        const st = S.stocks[sym], t = TICKERS[sym];
        if (st.halted > 0) continue;
        let ret = t.drift / 9 + gauss() * (t.vol / 3) + (S.eventNow?.shocks[sym] || 0);
        st.price *= 1 + ret;
        const r = st.price / st.dayOpen;
        if (r > 1.15 || r < 0.85) {
          st.price = st.dayOpen * (r > 1 ? 1.15 : 0.85);
          st.halted = 1;
          journal(`⛔ Cotation de <b>${t.name}</b> suspendue (±15 % en une séance). Restez calme, vendez tout.`);
        }
      }
      if (S.eventNow && --S.eventNow.hoursLeft <= 0) S.eventNow = null;
      S.indexHist.push(Math.round(indexValue()));
      if (S.indexHist.length > 96) S.indexHist.shift();
    }

    if (!we && hod === 18) {
      for (const sym in S.stocks) {
        const st = S.stocks[sym];
        st.hist.push(Math.round(st.price * 100) / 100);
        if (st.hist.length > 120) st.hist.shift();
        divTotal += st.shares * st.price * TICKERS[sym].div;
        if (st.halted > 0) st.halted -= 1;
      }
    }
  }
  S.stockHour = H;
  if (divTotal >= 1) {
    S.cash += divTotal;
    toast(`💰 Dividendes de clôture : +${fmt(divTotal)}`, "gain");
    updateHUD();
  }
}

function marketOpen() {
  const H = Math.floor(S.gameMs / HOUR);
  const hod = (9 + H) % 24;
  return !isWeekend() && hod >= 9 && hod < 18;
}

// indice global : moyenne de la cote, exprimée en points (base 35 420)
function indexValue() {
  const syms = Object.keys(S.stocks);
  const mean = syms.reduce((a, s) => a + S.stocks[s].price, 0) / syms.length;
  return mean * 354.2;
}

function trade(sym, qty) {
  const st = S.stocks[sym];
  if (qty > 0) {
    const cost = qty * st.price;
    if (S.cash < cost) return;
    S.cash -= cost;
    st.shares += qty;
    toast(`📈 ${qty} actions ${TICKERS[sym].name} — ${fmt(cost)}`);
  } else {
    const n = Math.min(-qty, st.shares);
    if (n <= 0) return;
    S.cash += n * st.price;
    st.shares -= n;
    toast(`📉 Vendu ${n} ${TICKERS[sym].name} — +${fmt(n * st.price)}`, "gain");
  }
  questBump("bourse");
  updateHUD(); save(); renderPanel();
}

// ---------------------------------------------------------------------------
// Rival NPC (fair-play d'onboarding validé par simulation)
// ---------------------------------------------------------------------------
function npcTick() {
  const d = gameDay();
  if (d < ECO.npcGraceD || d - S.lastNpcDay < ECO.npcEveryD) return;
  S.lastNpcDay = d;

  let free = PLACES.filter((p) => !S.owned[p.id] && !S.npc.includes(p.id));
  const target = monopolyTarget();
  if (d < 21 && target) free = free.filter((p) => p.cat !== target.cat);
  if (d < 30) {
    free = free.filter((p) => {
      const others = PLACES.filter((q) => q.cat === p.cat && q.id !== p.id);
      return !(others.length >= 1 && others.every((q) => S.owned[q.id]));
    });
  }
  if (!free.length) return;
  const p = free[Math.floor(Math.random() * free.length)];
  S.npc.push(p.id);
  journal(`${NPC_NAME} a racheté <b>${p.name}</b>. « Le village a besoin de renouveau », dit-il.`);
  toast(`🏗️ ${NPC_NAME} a acheté ${p.name}`);
  refreshMarker(p); save();
}

// ---------------------------------------------------------------------------
// Tick principal
// ---------------------------------------------------------------------------
function tick() {
  const now = Date.now();
  S.gameMs += (now - lastReal) * speed;
  lastReal = now;

  const d = gameDay();
  if (d > S.dayWorthDay) {
    S.dayWorthDay = d;
    S.dayWorth = netWorth();
  }
  ensureQuests();
  if (d > S.lastChargesDay) {
    let charges = 0;
    for (const id in S.owned) charges += placeValue(byId[id]) * ECO.chargesDay;
    if (charges > 0) S.cash -= charges * (d - S.lastChargesDay);
    S.lastChargesDay = d;
  }
  stockTick();
  npcTick();
  applyThemeByClock();

  if (now - lastUiRefresh > 2500) {
    lastUiRefresh = now;
    refreshAllMarkers();
    updateHUD();
    if (sheetPlace) openSheet(sheetPlace, true);
    if (!$("#panel").hidden && panelTab === "bourse") renderPanel();
  }
  save();
}
let lastUiRefresh = 0;
setInterval(tick, 1000);

// ---------------------------------------------------------------------------
// UI : HUD, toasts, gros titres
// ---------------------------------------------------------------------------
const $ = (s) => document.querySelector(s);

function updateHUD() {
  const worth = netWorth();
  $("#worth").textContent = fmt(worth);
  $("#cash").textContent = fmt(S.cash);
  // variation du jour, comme sur la maquette H3 (« ↗ +2,4 % »)
  const delta = S.dayWorth > 0 ? (worth / S.dayWorth - 1) * 100 : 0;
  const chip = $("#delta");
  chip.hidden = Math.abs(delta) < 0.05;
  chip.textContent = `${delta >= 0 ? "↗ +" : "↘ "}${delta.toFixed(1).replace(".", ",")} %`;
  chip.classList.toggle("down", delta < 0);

  checkTitle();
  ensureQuests();
  const done = S.quests.items.filter((q) => q.done).length;
  $("#quest-count").textContent = `${done}/${S.quests.items.length}`;
  $("#quest-chip").classList.toggle("done", done === S.quests.items.length);

  const t = monopolyTarget();
  const mono = $("#mono-chip");
  if (t) {
    mono.hidden = false;
    $("#mono-label").textContent =
      `${CAT_META[t.cat].icon} Monopole des ${CAT_META[t.cat].plural} — ${t.mine}/${t.total}`;
    const segs = $("#mono-segs");
    if (segs.childElementCount !== t.total) {
      segs.innerHTML = Array.from({ length: t.total }, () => '<div class="seg"></div>').join("");
    }
    [...segs.children].forEach((s, i) => s.classList.toggle("on", i < t.mine));
  } else {
    mono.hidden = true;
  }
  updateBadges();
  updateCoach();
}

// pastilles d'alerte sur les onglets : « il se passe quelque chose ici »
function setDot(tab, on) {
  const t = document.querySelector(`.tab[data-tab="${tab}"]`);
  if (!t) return;
  let d = t.querySelector(".dot");
  if (on && !d) { d = document.createElement("span"); d.className = "dot"; t.appendChild(d); }
  if (!on && d) d.remove();
}
function updateBadges() {
  setDot("journal", S.journal.length > (S.journalRead || 0));
  setDot("empire", S.quests.items.some((q) => !q.done));
  setDot("bourse", !!S.eventNow);
}

// le guide d'action : dit toujours la meilleure chose à faire maintenant
let coachAction = null;
function updateCoach() {
  const el = $("#coach");
  if (!S.onboarded || !$("#sheet").hidden || !$("#panel").hidden) { el.hidden = true; return; }
  const ids = Object.keys(S.owned);
  const pending = ids.reduce((a, id) => a + accrued(byId[id]), 0);
  let txt = null, cls = "";

  if (pending >= 1) {
    txt = `🪙 Encaisser les loyers — +${fmt(pending)}`;
    cls = "gain";
    coachAction = collectAll;
  } else if (!ids.length) {
    const target = PLACES.filter((p) => !S.owned[p.id] && S.cash >= priceToPay(p))
      .sort((a, b) => priceToPay(a) - priceToPay(b))[0];
    if (target) {
      txt = `🏠 Achetez votre premier commerce — dès ${fmt(priceToPay(target))}`;
      coachAction = () => openSheet(target);
    }
  } else {
    const t = monopolyTarget();
    const next = t && PLACES.filter((p) => p.cat === t.cat && !S.owned[p.id])
      .sort((a, b) => priceToPay(a) - priceToPay(b))[0];
    if (next && S.cash >= priceToPay(next)) {
      txt = `🎯 Le monopole des ${CAT_META[t.cat].plural} est à portée — ${next.name}`;
      coachAction = () => openSheet(next);
    } else if (S.eventNow) {
      txt = "📈 Ça s'agite à la Bourse — allez voir";
      coachAction = () => { setTab("bourse"); openPanel("bourse"); };
    } else if (t) {
      txt = `🎯 Monopole des ${CAT_META[t.cat].plural} : plus que ${t.total - t.mine} — économisez ${fmt(priceToPay(next))}`;
      coachAction = next ? () => openSheet(next) : null;
    }
  }

  if (txt) {
    el.hidden = false;
    el.textContent = txt;
    el.className = cls;
  } else {
    el.hidden = true;
  }
}
$("#coach").addEventListener("click", () => { if (coachAction) coachAction(); });

let toastCount = 0;
function toast(text, cls = "") {
  if (toastCount > 4) return; // anti-spam en temps accéléré
  toastCount++;
  const el = document.createElement("div");
  el.className = "toast " + cls;
  el.textContent = text;
  $("#toasts").appendChild(el);
  setTimeout(() => { el.remove(); toastCount--; }, 3200);
}

let headlineTimer = null;
function headline(html) {
  $("#headline-text").innerHTML = html;
  $("#headline").hidden = false;
  clearTimeout(headlineTimer);
  headlineTimer = setTimeout(() => ($("#headline").hidden = true), 7000);
}

function flyCoin(p, label) {
  if (!map) return;
  const px = map.project([p.lon, p.lat]);
  const el = document.createElement("div");
  el.className = "fly-coin";
  el.textContent = "🪙 " + label;
  el.style.left = px.x - 20 + "px";
  el.style.top = px.y - 20 + "px";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ---------------------------------------------------------------------------
// Fiche lieu
// ---------------------------------------------------------------------------
let sheetPlace = null;

function openSheet(p, silent = false) {
  sheetPlace = p;
  $("#sheet").hidden = false;
  const o = S.owned[p.id];
  const meta = CAT_META[p.cat];
  $("#sheet-title").textContent = p.name;

  const d = player ? Math.round(dist(player.lat, player.lon, p.lat, p.lon)) : null;
  const near = inRange(p);
  $("#sheet-sub").textContent =
    `${meta.icon} ${meta.label}` +
    (d != null ? ` · à ${d >= 1000 ? (d / 1000).toFixed(1) + " km" : d + " m"}` : "");

  const body = $("#sheet-body");
  if (o) {
    const inspected = S.gameMs < (o.inspectedUntil || 0);
    const nextCost = o.level < 3 ? p.price * ECO.upCost[o.level] : null;
    body.innerHTML = `
      <div class="sheet-row">
        <div class="stat">Rapporte <b>${fmt(rentPerDay(p))}</b>/jour</div>
        ${o.level ? `<div class="stat">🏗️ <b>${ECO.upNames[o.level - 1]}</b></div>` : ""}
        ${hasMonopoly(p.cat) ? '<div class="stat">👑 <b>Monopole ×2</b></div>' : ""}
        ${inspected ? '<div class="stat">👔 <b>Tournée faite</b></div>' : ""}
      </div>
      <div class="btn-row">
        <button class="btn" id="a-collect" ${accrued(p) < 1 ? "disabled" : ""}>
          🪙 Collecter ${fmt(accrued(p))}</button>
      </div>
      <div class="btn-row">
        ${near ? `<button class="btn ghost" id="a-inspect" ${inspected ? "disabled" : ""}>
          👔 Tournée du proprio (loyer ×${isWeekend() ? 3 : 2}, 24 h)</button>`
        : `<button class="btn ghost" id="a-goto">🚶 S'y rendre</button>`}
        ${nextCost != null ? `
        <button class="btn gold" id="a-upgrade" ${S.cash >= nextCost ? "" : "disabled"}>
          🏗️ ${ECO.upNames[o.level]} — ${fmt(nextCost)}</button>` : ""}
      </div>`;
    $("#a-collect")?.addEventListener("click", () => collect(p));
    $("#a-inspect")?.addEventListener("click", () => inspect(p));
    $("#a-upgrade")?.addEventListener("click", () => upgrade(p));
    $("#a-goto")?.addEventListener("click", () => goTo(p));
    if (!near) body.insertAdjacentHTML("beforeend",
      '<div class="hint">👔 La tournée : passez voir votre bien sur place et son loyer double pendant 24 h. C\'est votre raison de sortir marcher.</div>');
  } else {
    const cost = priceToPay(p);
    const npcOwned = S.npc.includes(p.id);
    const afford = S.cash >= cost;
    body.innerHTML = `
      <div class="sheet-row">
        <div class="stat">Prix <b>${fmt(cost)}</b>${npcOwned ? " (rachat ×1,5)" : ""}</div>
        <div class="stat">Rapportera <b>${fmt(p.price * ECO.rentDay)}</b>/jour</div>
        ${npcOwned ? `<div class="stat">🏗️ <b>${NPC_NAME}</b></div>` : ""}
      </div>
      <div class="btn-row">
        ${!near ? '<button class="btn ghost" id="a-goto">🚶 S\'y rendre</button>' : ""}
        <button class="btn" id="a-buy" ${near && afford ? "" : "disabled"}>
          ${npcOwned ? "😤 Racheter" : "📜 Acheter"} — ${fmt(cost)}</button>
      </div>
      ${near && !afford ? `<div class="hint">Il vous manque ${fmt(cost - S.cash)}. Les loyers tombent, patience.</div>` : ""}`;
    $("#a-buy")?.addEventListener("click", () => buy(p));
    $("#a-goto")?.addEventListener("click", () => goTo(p));
  }
  if (!silent) map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 16), speed: 1.4 });
  $("#coach").hidden = true;
}

$("#sheet-close").addEventListener("click", () => {
  $("#sheet").hidden = true;
  sheetPlace = null;
  updateCoach();
});

$("#quest-chip").addEventListener("click", () => {
  setTab("empire");
  openPanel("empire");
});

// ---------------------------------------------------------------------------
// Panneaux : Bourse / Journal / Empire
// ---------------------------------------------------------------------------
let panelTab = null;
let expandedSym = null;

function renderPanel() {
  const c = $("#panel-content");
  const scroll = $("#panel").scrollTop;

  if (panelTab === "bourse") {
    const H = Math.floor(S.gameMs / HOUR);
    const hod = (9 + H) % 24;
    const open = marketOpen();
    const chipTxt = open
      ? `🕐 Clôture dans ${18 - hod} h`
      : isWeekend() ? "🕐 Week-end — fermé"
      : hod < 9 ? "🕐 Ouverture à 9h" : "🕐 Fermé — demain 9h";
    const idx = indexValue();
    const idxD = S.indexDayOpen > 0 ? (idx / S.indexDayOpen - 1) * 100 : 0;
    const pts = Math.round(idx).toLocaleString("fr-FR");

    c.innerHTML = `
      <div class="bourse-top">
        <h2>LA BOURSE</h2>
        <span class="close-chip">${chipTxt}</span>
      </div>
      <div class="index-row">
        <span class="index-val">${pts} pts</span>
        <span class="index-delta ${idxD >= 0 ? "up" : "down"}">${idxD >= 0 ? "↗ +" : "↘ "}${Math.abs(idxD).toFixed(1).replace(".", ",")} %</span>
      </div>
      <canvas id="index-chart" width="680" height="300"></canvas>
      ${S.eventNow ? `<div class="event-banner">🚨 ${S.eventNow.head}</div>` : ""}
      ${Object.keys(TICKERS).map((sym) => {
        const st = S.stocks[sym], t = TICKERS[sym];
        const delta = (st.price / st.dayOpen - 1) * 100;
        const cls = st.halted > 0 ? "halt" : delta >= 0 ? "up" : "down";
        const dTxt = st.halted > 0 ? "⛔" : `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1).replace(".", ",")} %`;
        const pnl = st.shares * (st.price - st.dayOpen);
        return `
        <div class="stock-card" data-sym="${sym}">
          <div class="sc-top">
            <img class="sc-icon" src="assets/stocks/${sym.toLowerCase()}.png" alt="">
            <div class="sc-name">
              <b>${t.name}</b>
              <span class="sc-pos">${st.shares > 0
                ? `Vous : ${st.shares} actions · ${fmt(st.shares * st.price)}`
                : t.desc}</span>
            </div>
            <div class="sc-right">
              <div class="sc-delta ${cls}">${dTxt}</div>
              <div class="sc-price">${st.price.toFixed(2).replace(".", ",")} ₣</div>
            </div>
          </div>
          <div class="sc-bottom">
            <canvas class="sc-spark" data-spark="${sym}" width="184" height="56"></canvas>
            <span class="div-chip">Div ${(t.div * 100).toFixed(1).replace(".", ",")} %/j</span>
            ${st.shares > 0 && Math.abs(pnl) >= 1
              ? `<span class="sc-pnl ${pnl >= 0 ? "up" : "down"}">${pnl >= 0 ? "+" : "−"}${fmt(Math.abs(pnl))} auj.</span>`
              : ""}
          </div>
          ${expandedSym === sym ? `
          <div class="sc-detail">
            <div class="meta">${t.desc} — dividendes versés à la clôture de 18h.</div>
            <div class="trade-row">
              <button class="btn" data-trade="10"  ${S.cash >= 10 * st.price ? "" : "disabled"}>Acheter ×10</button>
              <button class="btn" data-trade="100" ${S.cash >= 100 * st.price ? "" : "disabled"}>×100</button>
              <button class="btn sell" data-trade="-10" ${st.shares > 0 ? "" : "disabled"}>Vendre ×10</button>
              <button class="btn sell" data-trade="${-st.shares}" ${st.shares > 0 ? "" : "disabled"}>Tout</button>
            </div>
          </div>` : ""}
        </div>`;
      }).join("")}
      <div class="proto-note">Prototype : bourse déverrouillée d'office (en prod : après le premier monopole).<br>
      Économie simulée — en production, les cours réagiront à l'activité réelle des joueurs.</div>`;

    c.querySelectorAll(".stock-card").forEach((card) =>
      card.addEventListener("click", () => {
        expandedSym = expandedSym === card.dataset.sym ? null : card.dataset.sym;
        renderPanel();
      }));
    c.querySelectorAll("[data-trade]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        trade(expandedSym, parseInt(b.dataset.trade, 10));
      }));

    drawIndexChart();
    c.querySelectorAll(".sc-spark").forEach((cv) => {
      const st = S.stocks[cv.dataset.spark];
      drawSpark(cv, st.hist.slice(-30).concat(st.price));
    });
  }

  else if (panelTab === "journal") {
    c.innerHTML = `<h2>La Plus-Value</h2>
      <div class="panel-sub">Le journal qui possède ses lecteurs — Mouriès, jour ${gameDay() + 1}</div>` +
      (S.journal.length
        ? S.journal.map((n) => `<div class="news-item"><div class="date">JOUR ${n.day + 1}</div>${n.text}</div>`).join("")
        : `<div class="locked"><div class="big">🗞️</div><p>Rien à signaler. Achetez quelque chose, que le village ait de quoi jaser.</p></div>`);
  }

  else if (panelTab === "empire") {
    const ids = Object.keys(S.owned);
    const rentTotal = ids.reduce((a, id) => a + rentPerDay(byId[id]), 0);
    const propTotal = ids.reduce((a, id) => a + placeValue(byId[id]), 0);
    const pending = ids.reduce((a, id) => a + accrued(byId[id]), 0);
    ensureQuests();
    c.innerHTML = `<h2>Votre Empire</h2>
      <div class="panel-sub">
        <span class="title-chip">${TITLES[S.titleIdx][0]}</span>
        &nbsp;Jour ${gameDay() + 1} · ${ids.length} propriété${ids.length > 1 ? "s" : ""} · ${S.monopolies.length} monopole${S.monopolies.length > 1 ? "s" : ""}${S.streak > 1 ? ` · 🔥 ${S.streak} j` : ""}
      </div>
      <div class="quest-list">
        ${S.quests.items.map((q) => {
          const def = QUEST_DEFS[q.id];
          return `<div class="quest-item ${q.done ? "done" : ""}">
            <span class="check">${q.done ? "✅" : "⬜️"}</span>
            <span class="q-label">${def.label}
              ${def.target > 1 ? `<span class="q-progress">${Math.min(q.progress, def.target)}/${def.target}</span>` : ""}
            </span>
            <span class="q-reward">+${fmt(def.reward)}</span>
          </div>`;
        }).join("")}
      </div>
      <div class="sheet-row" style="margin-bottom:10px">
        <div class="stat">Liquidités <b>${fmt(S.cash)}</b></div>
        <div class="stat">Immobilier <b>${fmt(propTotal)}</b></div>
        <div class="stat">Actions <b>${fmt(stockValue())}</b></div>
        <div class="stat">Loyers <b>${fmt(rentTotal)}</b>/j</div>
      </div>
      ${pending >= 1 ? `<div class="btn-row" style="margin-bottom:6px">
        <button class="btn" id="a-collect-all">🪙 Tout collecter — ${fmt(pending)}</button></div>` : ""}` +
      (ids.length
        ? ids.map((id) => {
            const p = byId[id], o = S.owned[id];
            return `<div class="prop-row" data-id="${id}">
              <div>${CAT_META[p.cat].icon} <b>${p.name}</b>
                <div class="sub">${o.level ? ECO.upNames[o.level - 1] + " · " : ""}${hasMonopoly(p.cat) ? "👑 monopole · " : ""}${fmt(placeValue(p))}</div>
              </div>
              <div class="val">+${fmt(rentPerDay(p))}/j</div></div>`;
          }).join("")
        : `<div class="locked"><div class="big">🏚️</div><p>Vous ne possédez rien. C'est réparable.</p></div>`);
    $("#a-collect-all")?.addEventListener("click", () => { collectAll(); renderPanel(); });
    c.querySelectorAll(".prop-row").forEach((row) =>
      row.addEventListener("click", () => {
        closePanel();
        openSheet(byId[row.dataset.id]);
      }));
  }
  $("#panel").scrollTop = scroll;
}

// petite courbe d'une carte de valeur
function drawSpark(cv, data) {
  if (!cv || data.length < 2) return;
  const ctx = cv.getContext("2d");
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const W = cv.width, Hh = cv.height, pad = 5;
  ctx.clearRect(0, 0, W, Hh);
  const up = data[data.length - 1] >= data[0];
  ctx.strokeStyle = up ? "#0E9B62" : "#E2604C";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - 2 * pad);
    const y = Hh - pad - ((v - min) / range) * (Hh - 2 * pad);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}

// le grand graphique de l'indice — dégradé lumineux et point doré (maquettes H1/H2)
function drawIndexChart() {
  const cv = document.getElementById("index-chart");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  let data = S.indexHist.slice(-48).concat(indexValue());
  if (data.length < 2) data = [data[0] || 35_420, data[0] || 35_420];
  const min = Math.min(...data), max = Math.max(...data);
  const range = (max - min) || max * 0.01 || 1;
  const W = cv.width, Hh = cv.height, pad = 14;
  const X = (i) => pad + (i / (data.length - 1)) * (W - 2 * pad);
  const Y = (v) => Hh - pad - ((v - min) / range) * (Hh - 2.6 * pad);
  ctx.clearRect(0, 0, W, Hh);

  // grille discrète
  ctx.strokeStyle = night ? "rgba(255,255,255,0.07)" : "rgba(34,38,46,0.08)";
  ctx.lineWidth = 1;
  for (let g = 1; g <= 3; g++) {
    const gy = (Hh / 4) * g;
    ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(W - pad, gy); ctx.stroke();
  }

  // aire en dégradé menthe
  const up = data[data.length - 1] >= data[0];
  const base = up ? (night ? "92,224,161" : "14,155,98") : "226,96,76";
  const grad = ctx.createLinearGradient(0, 0, 0, Hh);
  grad.addColorStop(0, `rgba(${base},0.35)`);
  grad.addColorStop(1, `rgba(${base},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(X(0), Hh - pad);
  data.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
  ctx.lineTo(X(data.length - 1), Hh - pad);
  ctx.closePath();
  ctx.fill();

  // ligne lumineuse menthe → or
  const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
  lineGrad.addColorStop(0, up ? "#5CE0A1" : "#E2604C");
  lineGrad.addColorStop(1, "#E9C05C");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.shadowColor = up ? `rgba(${base},0.7)` : "rgba(226,96,76,0.7)";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  data.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.stroke();
  ctx.shadowBlur = 0;

  // point final doré avec halo
  const lx = X(data.length - 1), ly = Y(data[data.length - 1]);
  ctx.fillStyle = "rgba(233,192,92,0.3)";
  ctx.beginPath(); ctx.arc(lx, ly, 14, 0, 7); ctx.fill();
  ctx.fillStyle = "#E9C05C";
  ctx.beginPath(); ctx.arc(lx, ly, 6, 0, 7); ctx.fill();
}

function openPanel(tab) {
  panelTab = tab;
  $("#panel").hidden = false;
  $("#coach").hidden = true;
  if (tab === "journal") { S.journalRead = S.journal.length; save(); updateBadges(); }
  renderPanel();
}
function closePanel() {
  $("#panel").hidden = true;
  panelTab = null;
  setTab("carte");
  updateCoach();
}
$("#panel-close").addEventListener("click", closePanel);

function setTab(name) {
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === name));
}
document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => {
    const tab = t.dataset.tab;
    setTab(tab);
    if (tab === "carte") { $("#panel").hidden = true; panelTab = null; }
    else openPanel(tab);
  }));

// ---------------------------------------------------------------------------
// Carte : style Riviera (jour) / Terminal (nuit)
// ---------------------------------------------------------------------------
const CENTER = [4.8703, 43.6907];

const DAY_PAL = {
  bg: "#F3EEDF", water: "#B9D8D0", green: "#D9E3C4", building: "#E7DFC9",
  road: "#FFFFFF", roadMinor: "#F9F5E9", text: "#6B7280", halo: "#F3EEDF",
  ring: "#0E9B62", tagAfford: "#22262E", tagFar: "#96988A",
  tagNpc: "#C24A38", tagHalo: "#FFFFFF",
};
const NIGHT_PAL = {
  bg: "#161B26", water: "#1D2734", green: "#1E2822", building: "#242C3C",
  road: "#C9BFA3", roadMinor: "#3B4254", text: "#98A0B0", halo: "#161B26",
  ring: "#5CE0A1", tagAfford: "#E9C05C", tagFar: "#6E7686",
  tagNpc: "#F07A6A", tagHalo: "#12151E",
};
const pal = () => (night ? NIGHT_PAL : DAY_PAL);

function recolor(style, p) {
  const s = JSON.parse(JSON.stringify(style));
  for (const l of s.layers) {
    const id = l.id.toLowerCase();
    l.paint = l.paint || {};
    try {
      if (l.type === "background") l.paint["background-color"] = p.bg;
      else if (l.type === "fill") {
        if (/water|ocean|river/.test(id)) l.paint["fill-color"] = p.water;
        else if (/park|green|wood|grass|landcover|landuse|vegetation|cemetery|pitch/.test(id)) l.paint["fill-color"] = p.green;
        else if (/building/.test(id)) { l.paint["fill-color"] = p.building; l.paint["fill-opacity"] = 0.6; }
        else l.paint["fill-color"] = p.bg;
        delete l.paint["fill-pattern"];
      } else if (l.type === "line") {
        if (/water|river/.test(id)) l.paint["line-color"] = p.water;
        else if (/minor|service|path|track|footway/.test(id)) l.paint["line-color"] = p.roadMinor;
        else if (/boundary|admin/.test(id)) l.paint["line-color"] = "rgba(0,0,0,0)";
        else l.paint["line-color"] = p.road;
      } else if (l.type === "symbol") {
        if (/poi/.test(id)) { l.layout = l.layout || {}; l.layout.visibility = "none"; }
        else if (l.paint["text-color"] !== undefined || l.layout?.["text-field"]) {
          l.paint["text-color"] = p.text;
          l.paint["text-halo-color"] = p.halo;
        }
      }
    } catch (e) { /* couche récalcitrante */ }
  }
  return s;
}

let map, baseStyle = null, night = null, themeForced = null;

function wantNight() {
  if (themeForced !== null) return themeForced;
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return h >= 18.5 || h < 9;
}

function applyThemeByClock() {
  if (baseStyle && wantNight() !== night) applyTheme(wantNight());
}

function applyTheme(toNight) {
  night = toNight;
  document.body.classList.toggle("night", night);
  document.querySelector('meta[name="theme-color"]').content = night ? "#14171D" : "#F6F1E4";
  if (map && baseStyle) {
    map.setStyle(recolor(baseStyle, pal()));
    map.once("idle", addGameLayers);
  }
}

async function addGameLayers() {
  // Le bâti ordinaire reste plat et discret : seuls les lieux achetables
  // sont en 3D (les sprites) — c'est eux, les héros de la carte.
  try {
    if (!map.getSource("radius")) {
      map.addSource("radius", { type: "geojson", data: radiusGeoJSON() });
      map.addLayer({
        id: "radius-fill", type: "fill", source: "radius",
        paint: { "fill-color": "#2E7CF6", "fill-opacity": 0.07 },
      });
      map.addLayer({
        id: "radius-line", type: "line", source: "radius",
        paint: { "line-color": "#2E7CF6", "line-opacity": 0.4, "line-width": 1.5, "line-dasharray": [2, 2] },
      });
    } else {
      map.getSource("radius").setData(radiusGeoJSON());
    }
  } catch (e) {}
  // sprites + couches des lieux (recréés à chaque changement de thème)
  try {
    await loadSprites();
    buildPlaceLayers();
  } catch (e) { /* réessaiera au prochain thème */ }
}

// ---------------------------------------------------------------------------
// Position du joueur (GPS ou balade)
// ---------------------------------------------------------------------------
let player = null;
let simMode = false;
let playerMarker = null;
let gpsChecked = false;

function radiusGeoJSON() {
  if (!player) return { type: "FeatureCollection", features: [] };
  const pts = [], n = 48;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const dLat = (ECO.radiusM / 111320) * Math.sin(a);
    const dLon = (ECO.radiusM / (111320 * Math.cos((player.lat * Math.PI) / 180))) * Math.cos(a);
    pts.push([player.lon + dLon, player.lat + dLat]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [pts] } };
}

function setPlayer(lat, lon, fly = false) {
  player = { lat, lon };
  if (!playerMarker) {
    const el = document.createElement("div");
    el.className = "player-dot";
    playerMarker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
  } else {
    playerMarker.setLngLat([lon, lat]);
  }
  try { map.getSource("radius")?.setData(radiusGeoJSON()); } catch (e) {}
  if (fly) map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 16) });
  if (sheetPlace) openSheet(sheetPlace, true);
}

function startGPS() {
  if (!navigator.geolocation) { enableSim(); return; }
  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      if (!gpsChecked) {
        gpsChecked = true;
        if (dist(lat, lon, CENTER[1], CENTER[0]) > 2500) {
          toast("📍 Vous êtes loin de Mouriès — mode balade activé");
          enableSim(true);
          return;
        }
      }
      if (!simMode) setPlayer(lat, lon);
    },
    () => { toast("GPS indisponible — mode balade activé"); enableSim(); },
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
}

function enableSim(silent = false) {
  simMode = true;
  $("#btn-sim").classList.add("on");
  if (!player) setPlayer(CENTER[1], CENTER[0]);
  if (!silent) toast("🚶 Touchez la carte pour vous déplacer");
}

// ---------------------------------------------------------------------------
// Marqueurs
// ---------------------------------------------------------------------------
// Les lieux sont rendus en couches GPU natives de la carte : ancrage parfait
// pendant le déplacement (zéro décalage), échelle liée au zoom, étiquettes
// intégrées — le rendu des maquettes H3/H4.

let spritesReady = false;
let nightSprites = false;
let placesWired = false;

const spritePrefix = () => (night && nightSprites ? "n-" : "d-");

function coinImage() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  x.beginPath(); x.arc(32, 32, 27, 0, 7);
  x.fillStyle = "#E9C05C"; x.fill();
  x.lineWidth = 6; x.strokeStyle = "#B8862F"; x.stroke();
  x.fillStyle = "#7A5A1C";
  x.font = "bold 32px -apple-system, Helvetica, sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText("₣", 32, 34);
  return x.getImageData(0, 0, 64, 64);
}

async function loadSprites() {
  await Promise.all(Object.keys(CAT_META).map(async (cat) => {
    const r = await map.loadImage(`assets/${cat}.png`);
    if (!map.hasImage("d-" + cat)) map.addImage("d-" + cat, r.data);
  }));
  nightSprites = true;
  await Promise.all(Object.keys(CAT_META).map(async (cat) => {
    try {
      const r = await map.loadImage(`assets/${cat}-night.png`);
      if (!map.hasImage("n-" + cat)) map.addImage("n-" + cat, r.data);
    } catch (e) { nightSprites = false; }
  }));
  if (!map.hasImage("coin")) map.addImage("coin", coinImage());
  spritesReady = true;
}

function placesGeoJSON() {
  return {
    type: "FeatureCollection",
    features: PLACES.map((p) => {
      const o = S.owned[p.id];
      const npc = S.npc.includes(p.id);
      const state = o ? "owned" : npc ? "npc" : S.cash >= priceToPay(p) ? "afford" : "far";
      let tag;
      if (o) {
        tag = hasMonopoly(p.cat) ? "MONOPOLE ×2" : o.level > 0 ? "NIV. " + o.level : "";
      } else {
        tag = fmt(priceToPay(p));
      }
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: {
          id: p.id, cat: p.cat, state, tag,
          coin: !!(o && accrued(p) >= 1),
          sort: -p.lat,
        },
      };
    }),
  };
}

function buildPlaceLayers() {
  const P = pal();
  if (!map.getSource("places")) {
    map.addSource("places", { type: "geojson", data: placesGeoJSON() });
  }
  if (!map.getLayer("place-ring")) {
    map.addLayer({
      id: "place-ring", type: "circle", source: "places",
      filter: ["==", ["get", "state"], "owned"],
      paint: {
        "circle-pitch-alignment": "map",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 7, 16, 18, 18, 42],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 3,
        "circle-stroke-color": P.ring,
        "circle-stroke-opacity": 0.9,
      },
    });
  }
  if (!map.getLayer("place-bld")) {
    map.addLayer({
      id: "place-bld", type: "symbol", source: "places",
      layout: {
        "icon-image": ["concat", spritePrefix(), ["get", "cat"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.10, 15, 0.20, 16, 0.30, 17.5, 0.46],
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "symbol-sort-key": ["get", "sort"],
        "text-field": ["get", "tag"],
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 14, 9, 16, 12, 18, 14],
        "text-anchor": "top",
        "text-offset": [0, 0.3],
        "text-optional": true,
      },
      paint: {
        "text-color": ["match", ["get", "state"],
          "npc", P.tagNpc, "owned", P.ring, "far", P.tagFar, P.tagAfford],
        "text-halo-color": P.tagHalo,
        "text-halo-width": 1.6,
      },
    });
  }
  if (!map.getLayer("place-coin")) {
    map.addLayer({
      id: "place-coin", type: "symbol", source: "places",
      filter: ["==", ["get", "coin"], true],
      layout: {
        "icon-image": "coin",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.22, 16, 0.38, 18, 0.55],
        "icon-anchor": "bottom",
        "icon-offset": [55, -210],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  }
  if (!placesWired) {
    placesWired = true;
    map.on("click", "place-bld", (e) => {
      const f = e.features && e.features[0];
      if (!f) return;
      const p = byId[f.properties.id];
      if (!p) return;
      if (S.owned[p.id] && accrued(p) >= 1) collect(p);
      openSheet(p);
    });
    map.on("mouseenter", "place-bld", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "place-bld", () => (map.getCanvas().style.cursor = ""));
  }
}

function refreshAllMarkers() {
  try { map.getSource("places")?.setData(placesGeoJSON()); } catch (e) {}
}
const refreshMarker = () => refreshAllMarkers();

// ---------------------------------------------------------------------------
// Panneau dev
// ---------------------------------------------------------------------------
$("#btn-sim").addEventListener("click", () => {
  simMode = !simMode;
  $("#btn-sim").classList.toggle("on", simMode);
  if (simMode) toast("🚶 Touchez la carte pour vous déplacer");
});
const SPEEDS = [1, 60, 720];
$("#btn-speed").addEventListener("click", () => {
  speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  $("#btn-speed").textContent = `⏩ ×${speed}`;
  $("#btn-speed").classList.toggle("on", speed > 1);
  toast(speed > 1 ? `⏩ Temps accéléré ×${speed} (test)` : "🕰️ Temps réel");
});
$("#btn-theme").addEventListener("click", () => {
  themeForced = themeForced === null ? !night : (themeForced ? null : true);
  if (themeForced === null) toast("🌗 Thème automatique (nuit après 18h30)");
  applyTheme(wantNight());
});
$("#btn-reset").addEventListener("click", () => {
  if (confirm("Tout recommencer ? Votre empire sera dissous.")) {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
});

// ---------------------------------------------------------------------------
// Onboarding + démarrage
// ---------------------------------------------------------------------------
function dismissOnboard() {
  $("#onboard").style.display = "none";
  S.onboarded = true; save();
}
$("#ob-gps").addEventListener("click", () => { dismissOnboard(); startGPS(); });
$("#ob-sim").addEventListener("click", () => { dismissOnboard(); enableSim(); });

fetch("https://tiles.openfreemap.org/styles/positron")
  .then((r) => r.json())
  .then((style) => {
    baseStyle = style;
    night = wantNight();
    document.body.classList.toggle("night", night);
    map = new maplibregl.Map({
      container: "map",
      style: recolor(style, pal()),
      center: CENTER,
      zoom: 15.6,
      pitch: 55,
      attributionControl: { compact: true },
    });
    map.on("load", () => {
      addGameLayers();
      updateHUD();
      if (S.onboarded) { $("#onboard").style.display = "none"; startGPS(); }
    });
    map.on("click", (e) => {
      if (simMode) setPlayer(e.lngLat.lat, e.lngLat.lng);
    });
  })
  .catch(() => {
    document.body.innerHTML =
      '<div style="padding:40px;text-align:center;font-family:sans-serif">' +
      "<h2>MAGNAT</h2><p>Impossible de charger la carte (connexion ?).<br>Réessayez.</p></div>";
  });
