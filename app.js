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

// Les rivaux : quatre magnats IA, chacun son style, sa cadence, ses cibles
const NPCS = {
  betonneur:   { name: "Jean-Mi Bétonneur",   firstDay: 2, every: 4, prefs: ["commerce", "restaurant"], quote: "Le village a besoin de renouveau.",
                 arrival: "a été aperçu chez le notaire avec un carnet de chèques" },
  vieilargent: { name: "Gérard Vieilargent",  firstDay: 4, every: 5, prefs: ["culture", "artisanat"],   quote: "Le patrimoine ne se discute pas, il s'achète.",
                 arrival: "fait le tour des moulins en berline de collection" },
  kevin:       { name: "Kevin de StartupBro", firstDay: 6, every: 5, prefs: ["cafe", "bar"],            quote: "On va pivoter ce village en hub.",
                 arrival: "a demandé le débit de la fibre au café" },
  baronne:     { name: "La Baronne",          firstDay: 8, every: 6, prefs: ["restaurant", "sport"],    quote: "Tout ceci manquait cruellement de standing.",
                 arrival: "a fait livrer douze malles à l'hôtel particulier" },
};
const NPC_MAX_PROPS = 4;

// Les Rencontres de rue : le « Pokémon » de MAGNAT (mini-jeu de Négociation)
// Communs = faciles, petits enjeux ± · Rares = difficiles, gros enjeux ±
const ENCOUNTER_TYPES = {
  valise: {
    emoji: "💼", name: "La Valise oubliée", weight: 0.45, rarity: "commune",
    desc: "Un attaché-case abandonné sur un banc. Personne ne regarde… sauf son propriétaire, peut-être.",
    zone: 0.30, speed: 3.0,
  },
  client: {
    emoji: "🧐", name: "Le Client Mystère", weight: 0.30, rarity: "commune",
    desc: "Il inspecte la vitrine, carnet en main. Son avis peut tout changer — dans les deux sens.",
    zone: 0.24, speed: 3.4,
  },
  inspecteur: {
    emoji: "👮", name: "L'Inspecteur des Impôts", weight: 0.17, rarity: "peu commune",
    desc: "Il vous a repéré. Négociez bien — ou payez.",
    zone: 0.19, speed: 3.9,
  },
  informateur: {
    emoji: "🕵️", name: "L'Informateur", weight: 0.08, rarity: "RARE",
    desc: "Imperméable, journal troué. « Un tuyau en or. Mais si vous me vexez, la rumeur sortira quand même… »",
    zone: 0.13, speed: 4.5,
  },
};
const npcOf = (id) => S.npcOwners[id] || null;
const npcName = (id) => (NPCS[npcOf(id)] ? NPCS[npcOf(id)].name : "un rival");

// Le vestiaire : avatars du joueur (personnalisation dans EMPIRE)
const AVATARS = {
  loup:       { name: "Le Jeune Loup" },
  magnate:    { name: "La Magnate" },
  heritier:   { name: "L'Héritier" },
  baroudeuse: { name: "La Baroudeuse" },
};

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
  collect: { label: "Encaisser 3 loyers", target: 3, reward: 150 },
  tournee: { label: "Faire la tournée d'un bien (sur place)", target: 1, reward: 150 },
  bourse:  { label: "Passer un ordre en Bourse", target: 1, reward: 150 },
  invest:  { label: "Acheter ou améliorer un bien", target: 1, reward: 200 },
};

// ---------------------------------------------------------------------------
// La cote (bourse) — personnalités issues de la simulation
// ---------------------------------------------------------------------------
const TICKERS = {
  KWA: { name: "KAWA GROUP",          icon: "☕", base: 45,  drift: 0.0006, vol: 0.012, div: 0.0036, desc: "Cafés & torréfacteurs — cyclique du matin" },
  GLU: { name: "GLUTEN & FILS",       icon: "🥖", base: 12,  drift: 0.0004, vol: 0.008, div: 0.0060, desc: "Boulangeries — valeur de bon père de famille" },
  HBL: { name: "HOUBLON HOLDING",     icon: "🍺", base: 28,  drift: 0.0006, vol: 0.014, div: 0.0030, desc: "Bars & brasseries — monte quand il fait soif" },
  FKT: { name: "FOURCHETTE CAPITAL",  icon: "🍽️", base: 65,  drift: 0.0005, vol: 0.013, div: 0.0030, desc: "Restaurants — sensible aux événements" },
  CDD: { name: "CADDIE NATIONAL",     icon: "🛒", base: 8,   drift: 0.0003, vol: 0.006, div: 0.0054, desc: "Commerces — l'action populaire, défensive, sûre" },
  CDV: { name: "CULTURE & DIVIDENDES",icon: "🎭", base: 90,  drift: 0.0004, vol: 0.015, div: 0.0024, desc: "Culture — saisonnière, festivals" },
  TRN: { name: "TRANSIT NATIONAL",    icon: "🚆", base: 150, drift: 0.0002, vol: 0.018, div: 0.0045, desc: "Transports — l'institution. Volatile, grèves comprises" },
  VRT: { name: "VERTLIGNE",           icon: "🌿", base: 22,  drift: 0.0004, vol: 0.016, div: 0.0018, desc: "Sport & plein air — météo-dépendante" },
  SBT: { name: "STARTUPBRO TECH",     icon: "🚀", base: 340, drift: 0.0012, vol: 0.055, div: 0,      desc: "La plus chère de la cote. Jamais rentable. Bonne chance." },
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
  for (const sym in TICKERS) {
    const b = TICKERS[sym].base;
    st[sym] = { price: b, dayOpen: b, shares: 0, hist: [b], halted: 0 };
  }
  return st;
}

// l'horloge du jeu est calée sur l'heure réelle (le jeu « commence » à 9h00,
// donc gameMs est décalé pour que l'heure du jeu == l'heure de la montre)
function initialGameMs() {
  const d = new Date();
  return (((d.getHours() - 9 + 24) % 24) * 60 + d.getMinutes()) * 60_000;
}

function freshState() {
  return {
    cash: ECO.start,
    gameMs: initialGameMs(),
    clockAnchored: true,
    lastSeen: Date.now(),
    startDow: new Date().getDay(),
    owned: {},
    npc: [],           // hérité (v0.6) — migré vers npcOwners
    npcOwners: {},     // placeId -> clé du rival
    npcLast: {},       // clé du rival -> dernier jour d'achat
    npcAnnounced: {},  // rivaux déjà annoncés dans le journal
    tips: {},          // conseils déjà montrés
    spawns: [],        // rencontres de rue actives
    spawnSeq: 0,
    rentRushUntil: 0,
    scouted: {},       // repérage : placeId -> jour
    discounts: {},     // remises d'achat : placeId -> 0..0.15
    walk: { total: 0, day: -1, todayKm: 0, credited: 0 },
    deals: [],         // les « œufs » : dossiers qui se bouclent en km
    dealDay: -1,
    avatar: "loup",    // personnage du joueur
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
    muted: false,
    coteV2: true,
  };
}

let offlineGapMs = 0;
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const st = Object.assign(freshState(), parsed);
      st.stocks = Object.assign(freshStocks(), parsed.stocks || {});
      // migration v0.6 → v0.8 : l'ancien tableau npc devient npcOwners
      if (Array.isArray(st.npc) && st.npc.length && !Object.keys(st.npcOwners).length) {
        st.npc.forEach((id) => (st.npcOwners[id] = "betonneur"));
      }
      // LE correctif du jeu idle : le temps passe aussi quand l'app est
      // fermée (à vitesse réelle ×1, plafonné à 14 jours)
      const nowMs = Date.now();
      if (parsed.lastSeen) {
        offlineGapMs = Math.max(0, Math.min(nowMs - parsed.lastSeen, 14 * DAY));
        st.gameMs += offlineGapMs;
      }
      // les rencontres sont éphémères : on repart propre à chaque session
      st.spawns = [];
      // migration cote v2 : chaque action a désormais son prix de base —
      // les positions existantes sont soldées au cours (aucune perte)
      if (!parsed.coteV2) {
        let refund = 0;
        for (const sym in st.stocks) refund += (st.stocks[sym].shares || 0) * st.stocks[sym].price;
        st.cash += refund;
        st.stocks = freshStocks();
        st.indexHist = [35_420];
        st.indexDayOpen = 35_420;
        st.coteV2 = true;
        st.journal.unshift({
          day: Math.floor(st.gameMs / DAY),
          text: "LA COTE A ÉTÉ REBASÉE — chaque valeur a désormais son propre cours (de CADDIE à 8 ₣ à STARTUPBRO à 340 ₣)." +
            (refund > 0 ? ` Vos positions ont été soldées : +${Math.round(refund).toLocaleString("fr-FR")} ₣ de liquidités.` : ""),
        });
      }
      // migration : caler l'horloge du jeu sur l'heure réelle
      if (!parsed.clockAnchored) {
        const d = new Date();
        const target = ((d.getHours() - 9 + 24) % 24) * 60 + d.getMinutes();
        const cur = Math.floor(st.gameMs / 60_000) % 1440;
        st.gameMs += ((target - cur + 1440) % 1440) * 60_000;
        st.clockAnchored = true;
      }
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
  if (S.gameMs < S.rentRushUntil) m *= 2;
  if (S.gameMs < (o.boostUntil || 0)) m *= 3;   // avis 5 étoiles du Client Mystère
  if (S.gameMs < (o.malusUntil || 0)) m *= 0.5; // avis assassin
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
      .reduce((a, p) => a + priceToPay(p), 0);
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
    sfx("quest");
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
const priceToPay = (p) =>
  (npcOf(p.id) ? p.price * ECO.flip : p.price) * (1 - (S.discounts[p.id] || 0));
const inRange = (p) => player && dist(player.lat, player.lon, p.lat, p.lon) <= ECO.radiusM;

function buy(p) {
  const cost = priceToPay(p);
  if (S.cash < cost || S.owned[p.id]) return;
  const fromNpc = npcOf(p.id);
  S.cash -= cost;
  delete S.npcOwners[p.id];
  delete S.discounts[p.id];
  S.owned[p.id] = { level: 0, lastCollect: S.gameMs, inspectedUntil: S.gameMs + ECO.inspectDurH * HOUR };
  questBump("invest");
  if (fromNpc) {
    const n = NPCS[fromNpc];
    journal(`Vous avez arraché <b>${p.name}</b> à ${n.name} pour ${fmt(cost)}. Il claque la porte du notaire.`);
    toast(`😤 Repris à ${n.name} : ${p.name}`);
    // riposte : le rival vexé rachète plus vite
    S.npcLast[fromNpc] = gameDay() - n.every;
  } else {
    journal(`Acte notarié : <b>${p.name}</b> est à vous pour ${fmt(cost)}. Personne ne vous a rien demandé.`);
    toast(`📜 ${p.name} est à vous !`);
  }
  burst(p, 10);
  sfx("buy");
  tip("buy", "Votre bien produit des loyers en continu. Revenez encaisser la pièce 🪙 — l'accumulation se bloque après 8 h.");
  checkMonopolies(p.cat);
  refreshAllMarkers(); updateHUD(); openSheet(p, true); save();
}

function collect(p) {
  const amount = accrued(p);
  if (amount < 1) return;
  S.cash += amount;
  S.owned[p.id].lastCollect = S.gameMs;
  flyCoin(p, `+${fmt(amount)}`);
  sfx("coin");
  bumpStreak();
  questBump("collect");
  tip("collect", "Passez voir votre bien SUR PLACE : la Tournée du proprio double son loyer pendant 24 h (×3 le week-end).");
  refreshMarker(p); updateHUD(); save();
  if (sheetPlace === p) openSheet(p, true);
}

function collectAll() {
  let total = 0, n = 0;
  for (const id in S.owned) {
    const a = accrued(byId[id]);
    if (a >= 1) { total += a; n += 1; S.owned[id].lastCollect = S.gameMs; }
  }
  if (total >= 1) {
    S.cash += total;
    sfx("coin");
    bumpStreak();
    for (let i = 0; i < n; i++) questBump("collect");
    toast(`🪙 Loyers encaissés : +${fmt(total)}`, "gain");
    refreshAllMarkers(); updateHUD(); save();
  }
}

function inspect(p) {
  S.owned[p.id].inspectedUntil = S.gameMs + ECO.inspectDurH * HOUR;
  toast(`👔 Le proprio est passé — loyer ×${isWeekend() ? 3 : 2} pendant 24 h`);
  questBump("tournee");
  tip("mono", "Visez le Monopole : possédez TOUS les commerces d'une catégorie du village et leurs loyers doublent pour toujours. La jauge en haut vous guide.");
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

function scout(p) {
  if (S.scouted[p.id] === gameDay() || S.owned[p.id]) return;
  S.scouted[p.id] = gameDay();
  const gain = Math.round((30 + Math.random() * 70) / 10) * 10;
  S.cash += gain;
  S.discounts[p.id] = Math.min(0.15, (S.discounts[p.id] || 0) + 0.05);
  sfx("coin");
  toast(`🔍 Repérage : +${fmt(gain)} · dossier −${Math.round(S.discounts[p.id] * 100)} % sur ${p.name}`, "gain");
  updateHUD(); openSheet(p, true); save();
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
  PLACES.filter((p) => p.cat === cat).forEach((p) => burst(p, 14));
  sfx("mono");
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

    // grands événements le lundi ET le jeudi à 10h (chocs étalés sur 2 jours)
    if (hod === 10 && (dow === 1 || dow === 4) && !S.eventNow) {
      const ev = MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
      const shocks = {};
      for (const sym in ev.shocks) shocks[sym] = ev.shocks[sym] / 18;
      S.eventNow = { head: ev.head, shocks, hoursLeft: 18 };
      headline(`<b>${ev.head}</b>`);
      journal(`BOURSE — ${ev.head}`);
    }

    // rumeur de mi-journée (~1 jour sur 2) : petit choc sur une valeur
    if (hod === 13 && !we && !S.eventNow && Math.random() < 0.5) {
      const syms = Object.keys(TICKERS);
      const sym = syms[Math.floor(Math.random() * syms.length)];
      const mag = (0.04 + Math.random() * 0.05) * (Math.random() < 0.5 ? -1 : 1);
      S.eventNow = {
        head: `RUMEUR — ${TICKERS[sym].name} : ${mag > 0 ? "un gros contrat se murmure en coulisses" : "des comptes qui toussent, dit-on"}.`,
        shocks: { [sym]: mag / 3 },
        hoursLeft: 3,
      };
      journal(`BOURSE — ${S.eventNow.head}`);
    }

    if (!we && hod === 9) {
      for (const sym in S.stocks) S.stocks[sym].dayOpen = S.stocks[sym].price;
      S.indexDayOpen = indexValue();
    }

    if (!we && hod >= 9 && hod < 18) {
      for (const sym in S.stocks) {
        const st = S.stocks[sym], t = TICKERS[sym];
        if (st.halted > 0) continue;
        let ret = t.drift / 9 + gauss() * (t.vol / 2.2) + (S.eventNow?.shocks[sym] || 0);
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

// micro-ticks : pendant la séance, les cours frémissent toutes les ~8 s
// réelles (le moteur horaire garde la main sur la tendance de fond)
let lastMicroTick = 0;
function microTick(now) {
  if (now - lastMicroTick < 8000 || !marketOpen()) return;
  lastMicroTick = now;
  for (const sym in S.stocks) {
    const st = S.stocks[sym], t = TICKERS[sym];
    if (st.halted > 0) continue;
    st.price *= 1 + gauss() * (t.vol / 14);
    const r = st.price / st.dayOpen;
    if (r > 1.15) st.price = st.dayOpen * 1.15;
    if (r < 0.85) st.price = st.dayOpen * 0.85;
  }
  S.indexHist.push(Math.round(indexValue()));
  if (S.indexHist.length > 120) S.indexHist.shift();
}

// indice global : moyenne des performances de la cote, en points (base 35 420)
function indexValue() {
  const syms = Object.keys(S.stocks);
  const mean = syms.reduce((a, s) => a + S.stocks[s].price / TICKERS[s].base, 0) / syms.length;
  return mean * 35_420;
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
  updateHUD(); save();
  if (panelTab === "bourse") refreshBourseTexts();
}

// ---------------------------------------------------------------------------
// Rival NPC (fair-play d'onboarding validé par simulation)
// ---------------------------------------------------------------------------
function npcTick() {
  const d = gameDay();
  for (const key in NPCS) {
    const n = NPCS[key];
    // annonce dans le journal la veille de son premier achat
    if (d >= n.firstDay - 1 && !S.npcAnnounced[key]) {
      S.npcAnnounced[key] = true;
      journal(`On murmure que <b>${n.name}</b> ${n.arrival}. Le village retient son souffle.`);
      toast(`👀 ${n.name} rôde dans le village…`);
    }
    if (d < n.firstDay) continue;
    if (d - (S.npcLast[key] ?? 0) < n.every) continue;
    const holdings = Object.values(S.npcOwners).filter((k) => k === key).length;
    if (holdings >= NPC_MAX_PROPS) continue;
    S.npcLast[key] = d;

    let free = PLACES.filter((p) => !S.owned[p.id] && !npcOf(p.id));
    const target = monopolyTarget();
    if (d < 21 && target) free = free.filter((p) => p.cat !== target.cat);
    if (d < 30) {
      free = free.filter((p) => {
        const others = PLACES.filter((q) => q.cat === p.cat && q.id !== p.id);
        return !(others.length >= 1 && others.every((q) => S.owned[q.id]));
      });
    }
    if (!free.length) continue;
    const pref = free.filter((p) => n.prefs.includes(p.cat));
    const pool = pref.length ? pref : free;
    const p = pool[Math.floor(Math.random() * pool.length)];
    S.npcOwners[p.id] = key;
    journal(`${n.name} a racheté <b>${p.name}</b>. « ${n.quote} »`);
    toast(`🏗️ ${n.name} a acheté ${p.name}`);
    tip("rival", "Les rivaux achètent le village. Vous pouvez racheter leurs biens (prix ×1,5) — surtout s'ils bloquent un de vos monopoles.");
    refreshAllMarkers(); save();
  }
}

// ---------------------------------------------------------------------------
// Apparitions sur la carte (façon Pokémon GO) : pièces et coffres mystère
// ---------------------------------------------------------------------------
const SPAWN_TARGET = 3;
const SPAWN_RADIUS_M = 60;

function pickEncounterType() {
  let r = Math.random(), acc = 0;
  for (const k in ENCOUNTER_TYPES) {
    acc += ENCOUNTER_TYPES[k].weight;
    if (r <= acc) return k;
  }
  return "valise";
}

// L'algorithme d'apparition (à la Niantic) : les rencontres arrivent par
// vagues aléatoires — PAS de remplacement instantané. Toutes les 30 s réelles,
// un tirage décide d'une apparition (bonus si le joueur a marché, garantie
// « pity » si rien depuis 6 min). Durée de vie courte : 2 à 4 minutes RÉELLES
// (l'accélérateur de test n'y change rien) — l'urgence fait la rencontre.
let lastSpawnRoll = 0;
let lastRollPos = null;
let lastSpawnAt = Date.now() - 5.5 * 60_000; // première rencontre sous ~1 min

function spawnGroup(n) {
  // TOUT pop autour du JOUEUR (30-120 m) — jamais ailleurs sur la carte.
  // Seul le Client Mystère se colle à une vitrine, si une est à portée.
  const nearPois = PLACES.filter((p) => dist(player.lat, player.lon, p.lat, p.lon) < 140);
  for (let i = 0; i < n; i++) {
    let type = pickEncounterType();
    if (type === "client" && !nearPois.length) type = "valise";
    let baseLat = player.lat, baseLon = player.lon, placeId = null;
    let r = 30 + Math.random() * 90;
    if (type === "client") {
      const anchor = nearPois[Math.floor(Math.random() * nearPois.length)];
      baseLat = anchor.lat; baseLon = anchor.lon;
      placeId = anchor.id;
      r = 8 + Math.random() * 30;
    }
    const ang = Math.random() * 6.283;
    S.spawns.push({
      id: "s" + (++S.spawnSeq),
      type, placeId,
      lat: baseLat + (r / 111320) * Math.sin(ang),
      lon: baseLon + (r / (111320 * Math.cos((baseLat * Math.PI) / 180))) * Math.cos(ang),
      exp: Date.now() + (120 + Math.random() * 120) * 1000,
    });
  }
  updateSpawnSource();
  toast(n > 1
    ? `✨ ${n} rencontres viennent d'apparaître autour de vous !`
    : `${ENCOUNTER_TYPES[S.spawns[S.spawns.length - 1].type].emoji} Une rencontre est apparue près de vous !`);
}

function spawnAlgorithm(now) {
  const before = S.spawns.length;
  S.spawns = S.spawns.filter((s) => (s.exp || 0) > now);
  if (S.spawns.length !== before) updateSpawnSource();
  if (!player || now - lastSpawnRoll < 20_000) return;
  lastSpawnRoll = now;
  // densité dynamique : ~3-4 rencontres possibles PAR commerce alentour —
  // une rue commerçante peut grouiller (jusqu'à 15), la garrigue reste calme
  const nearby = PLACES.filter((p) => dist(player.lat, player.lon, p.lat, p.lon) < 130).length;
  const cap = Math.min(15, 3 + nearby);         // 3 (isolé) → 15 (plein cours)
  if (S.spawns.length >= cap) return;
  const moved = lastRollPos ? dist(player.lat, player.lon, lastRollPos.lat, lastRollPos.lon) : 0;
  lastRollPos = { lat: player.lat, lon: player.lon };
  // c'est la MARCHE qui fait apparaître : presque rien à l'arrêt
  let p = 0.08 + (moved > 50 ? 0.55 : 0) + Math.min(0.2, nearby * 0.025);
  if (now - lastSpawnAt > 6 * 60_000) p = 1;    // pity : jamais bredouille > 6 min
  if (Math.random() > p) return;
  const cluster = Math.random() < (nearby >= 4 ? 0.5 : 0.33);
  const size = cluster
    ? 2 + Math.floor(Math.random() * (nearby >= 6 ? 4 : 2))   // 2-5 en zone dense
    : 1;
  spawnGroup(Math.min(cap - S.spawns.length, size));
  lastSpawnAt = now;
}

function spawnsGeoJSON() {
  return {
    type: "FeatureCollection",
    features: S.spawns.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: { id: s.id, icon: "sp-" + s.type },
    })),
  };
}

function updateSpawnSource() {
  try { map.getSource("spawns")?.setData(spawnsGeoJSON()); } catch (e) {}
}

// choc boursier ponctuel (tuyaux de l'Informateur) — badge visible 30 min
function applyShock(sym, pct) {
  const st = S.stocks[sym];
  st.price *= 1 + pct;
  const r = st.price / st.dayOpen;
  if (r > 1.15) st.price = st.dayOpen * 1.15;
  if (r < 0.85) st.price = st.dayOpen * 0.85;
  st.shock = { pct, at: Date.now() };
}

function openEncounter(id) {
  const s = S.spawns.find((x) => x.id === id);
  if (!s || !player) return;
  let d = dist(player.lat, player.lon, s.lat, s.lon);
  if (d > SPAWN_RADIUS_M && simMode) { setPlayer(s.lat, s.lon); d = 0; }
  if (d > SPAWN_RADIUS_M) {
    toast(`Trop loin — approchez-vous à ${SPAWN_RADIUS_M} m (${Math.round(d)} m)`);
    return;
  }
  startMinigame(s);
}

function resolveEncounter(s, success) {
  S.spawns = S.spawns.filter((x) => x.id !== s.id);
  updateSpawnSource();
  burst(s, success ? 10 : 4);
  const syms = Object.keys(TICKERS);
  const sym = syms[Math.floor(Math.random() * syms.length)];
  const t = TICKERS[sym];

  if (s.type === "valise") {
    if (success) {
      const gain = Math.round((100 + Math.random() * 150) / 10) * 10;
      S.cash += gain;
      sfx("buy");
      toast(`💼 La valise est à vous : +${fmt(gain)}`, "gain");
    } else {
      const perte = Math.min(S.cash, Math.round((50 + Math.random() * 50) / 10) * 10);
      S.cash -= perte;
      toast(`😬 Le propriétaire revient furieux — dédommagement : −${fmt(perte)}`);
    }
  } else if (s.type === "client") {
    const p = s.placeId && byId[s.placeId];
    if (!success) {
      if (p && S.owned[p.id]) {
        S.owned[p.id].malusUntil = S.gameMs + 6 * HOUR;
        toast(`💔 Avis assassin — loyer de ${p.name} ×0,5 pendant 6 h`);
        journal(`Le Client Mystère étrille <b>${p.name}</b> : « service glacial, addition brûlante ». Loyer divisé par deux 6 h.`);
      } else {
        toast("🧐 Le Client Mystère tourne les talons. Rien perdu, rien gagné.");
      }
    } else if (p && S.owned[p.id]) {
      S.owned[p.id].boostUntil = S.gameMs + 6 * HOUR;
      sfx("quest");
      toast(`🌟 Avis 5 étoiles — loyer de ${p.name} ×3 pendant 6 h !`, "gain");
      journal(`Le Client Mystère encense <b>${p.name}</b>. La file d'attente déborde.`);
    } else if (p) {
      S.discounts[p.id] = Math.min(0.15, (S.discounts[p.id] || 0) + 0.10);
      sfx("quest");
      toast(`🧐 Il vous glisse le dossier : −${Math.round(S.discounts[p.id] * 100)} % sur ${p.name}`, "gain");
      if (sheetPlace === p) openSheet(p, true);
    } else {
      S.cash += 300; sfx("coin");
      toast("🧐 Il vous dédommage pour le dérangement : +300 ₣", "gain");
    }
  } else if (s.type === "informateur") {
    if (success) {
      const pct = 0.02 + Math.random() * 0.02;
      applyShock(sym, pct);
      sfx("mono");
      headline(`<b>TUYAU EN OR.</b> ${t.name} bondit de +${(pct * 100).toFixed(1).replace(".", ",")} % sur une rumeur bien informée.`);
      journal(`L'Informateur avait raison : <b>${t.name}</b> +${(pct * 100).toFixed(1).replace(".", ",")} %.`);
    } else {
      const pct = 0.015 + Math.random() * 0.005;
      const frais = Math.min(S.cash, 200);
      S.cash -= frais;
      applyShock(sym, -pct);
      toast(`🕵️ Tuyau percé : −${fmt(frais)}, et ${t.name} −${(pct * 100).toFixed(1).replace(".", ",")} %`);
      journal(`Le tuyau de l'Informateur était percé : <b>${t.name}</b> −${(pct * 100).toFixed(1).replace(".", ",")} % — et il a gardé l'avance.`);
    }
  } else if (s.type === "inspecteur") {
    if (success) {
      S.cash += 150; sfx("quest");
      toast("👮 Contrôle esquivé avec panache : +150 ₣ de frais récupérés", "gain");
    } else {
      const amende = Math.max(50, Math.min(Math.round(S.cash * 0.02), 800));
      S.cash -= amende;
      toast(`👮 Redressement express : −${fmt(amende)}`);
      journal(`L'Inspecteur des Impôts vous a coincé : amende de ${fmt(amende)}.`);
    }
  }
  tip("spawn", "Des rencontres apparaissent autour de vous en marchant — plus nombreuses près des commerces. La jauge : tapez dans la zone dorée.");
  updateHUD(); save();
}

// ---------------------------------------------------------------------------
// Les Affaires & les Indemnités kilométriques (les « œufs » de MAGNAT)
// ---------------------------------------------------------------------------
const DEAL_TIERS = [
  { km: 2,  name: "Petit dossier" },
  { km: 5,  name: "Dossier sérieux" },
  { km: 10, name: "L'Affaire du siècle" },
];

function ensureDeals() {
  const d = gameDay();
  if (S.dealDay === d || S.deals.length >= 2) return;
  S.dealDay = d;
  const r = Math.random();
  const tier = r < 0.05 ? 2 : r < 0.30 ? 1 : 0;
  S.deals.push({ id: "dl" + (++S.spawnSeq), tier, km: DEAL_TIERS[tier].km, done: 0 });
  toast(`🗂️ Un dossier arrive sur votre bureau : « ${DEAL_TIERS[tier].name} » — ${DEAL_TIERS[tier].km} km à pied pour le boucler`);
  tip("deal", "Les Affaires se bouclent en MARCHANT : vos kilomètres font avancer les dossiers (suivi GPS, app ouverte). Récompense à l'arrivée !");
  save();
}

function hatchDeal(deal) {
  S.deals = S.deals.filter((x) => x !== deal);
  const syms = Object.keys(TICKERS);
  const sym = syms[Math.floor(Math.random() * syms.length)];
  sfx("mono");
  if (deal.tier === 0) {
    const gain = Math.round((400 + Math.random() * 500) / 10) * 10;
    S.cash += gain;
    headline(`<b>DOSSIER BOUCLÉ.</b> Vos ${deal.km} km de démarchage paient : +${fmt(gain)}.`);
    journal(`Petit dossier bouclé à la marche : +${fmt(gain)}. Les meilleures affaires se font sur le trottoir.`);
  } else if (deal.tier === 1) {
    const gain = Math.round((1500 + Math.random() * 1500) / 10) * 10;
    S.cash += gain;
    S.stocks[sym].shares += 20;
    headline(`<b>DOSSIER SÉRIEUX SIGNÉ.</b> +${fmt(gain)} — et 20 actions ${TICKERS[sym].name} offertes par un partenaire reconnaissant.`);
    journal(`Dossier sérieux signé après ${deal.km} km : +${fmt(gain)} et 20 actions <b>${TICKERS[sym].name}</b>.`);
  } else {
    const gain = Math.round((5000 + Math.random() * 3000) / 10) * 10;
    S.cash += gain;
    applyShock(sym, 0.03);
    headline(`<b>L'AFFAIRE DU SIÈCLE.</b> ${deal.km} km de semelles usées, +${fmt(gain)} — et votre réseau fait grimper ${TICKERS[sym].name} de +3 %.`);
    journal(`L'Affaire du siècle est signée : +${fmt(gain)}, et <b>${TICKERS[sym].name}</b> +3 % dans la foulée.`);
  }
  updateHUD(); save();
}

// crédite la distance parcourue (segments GPS plausibles uniquement)
function walkCredit(d) {
  const day = gameDay();
  if (S.walk.day !== day) { S.walk.day = day; S.walk.todayKm = 0; S.walk.credited = 0; }
  S.walk.total += d / 1000;
  S.walk.todayKm += d / 1000;
  // indemnités kilométriques : 50 ₣ / km, plafonnées à 20 km / jour
  const kms = Math.floor(Math.min(S.walk.todayKm, 20));
  if (kms > S.walk.credited) {
    const gain = (kms - S.walk.credited) * 50;
    S.walk.credited = kms;
    S.cash += gain;
    sfx("coin");
    toast(`🚶 Indemnités kilométriques : +${fmt(gain)}`, "gain");
  }
  for (const deal of S.deals.slice()) {
    deal.done += d / 1000;
    if (deal.done >= deal.km) hatchDeal(deal);
  }
}

// ---------------------------------------------------------------------------
// Mini-jeu de Négociation (la « pokeball » de MAGNAT)
// ---------------------------------------------------------------------------
let mgSpawn = null, mgRaf = null, mgPos = 0, mgZone = { c: 0.5, w: 0.2 };

function startMinigame(s) {
  mgSpawn = s;
  const T = ENCOUNTER_TYPES[s.type];
  const img = $("#mg-img");
  const fallback = $("#mg-emoji");
  img.style.display = "";
  fallback.style.display = "none";
  img.onerror = () => { img.style.display = "none"; fallback.style.display = ""; };
  img.src = `assets/char-${s.type}.png`;
  fallback.textContent = T.emoji;
  $("#mg-title").textContent = T.name;
  $("#mg-desc").textContent = T.desc;
  mgZone = { c: 0.3 + Math.random() * 0.4, w: T.zone };
  const zoneEl = $("#mg-zone");
  zoneEl.style.left = (mgZone.c - mgZone.w / 2) * 100 + "%";
  zoneEl.style.width = mgZone.w * 100 + "%";
  $("#mg").hidden = false;
  const t0 = performance.now();
  const loop = (tn) => {
    mgPos = (Math.sin(((tn - t0) / 1000) * T.speed) + 1) / 2;
    $("#mg-cursor").style.left = mgPos * 100 + "%";
    mgRaf = requestAnimationFrame(loop);
  };
  mgRaf = requestAnimationFrame(loop);
}

function endMinigame(attempt) {
  cancelAnimationFrame(mgRaf);
  $("#mg").hidden = true;
  const s = mgSpawn;
  mgSpawn = null;
  if (!s) return;
  if (attempt) {
    const success = Math.abs(mgPos - mgZone.c) <= mgZone.w / 2;
    resolveEncounter(s, success);
  }
}


// ---------------------------------------------------------------------------
// Tick principal
// ---------------------------------------------------------------------------
function tick() {
  const now = Date.now();
  const dt = now - lastReal;
  lastReal = now;
  // au-delà de 30 s sans tick (onglet endormi, app en fond), le temps
  // écoulé compte à vitesse réelle — jamais multiplié par l'accélérateur
  S.gameMs += dt > 30_000 ? dt : dt * speed;
  S.lastSeen = now;

  const d = gameDay();
  if (d > S.dayWorthDay) {
    S.dayWorthDay = d;
    S.dayWorth = netWorth();
  }
  ensureQuests();
  ensureDeals();
  if (d > S.lastChargesDay) {
    let charges = 0;
    for (const id in S.owned) charges += placeValue(byId[id]) * ECO.chargesDay;
    if (charges > 0) S.cash -= charges * (d - S.lastChargesDay);
    S.lastChargesDay = d;
  }
  stockTick();
  microTick(now);
  npcTick();
  applyThemeByClock();

  if (now - lastUiRefresh > 2500) {
    lastUiRefresh = now;
    spawnAlgorithm(now);
    refreshAllMarkers();
    updateHUD();
    if (sheetPlace) openSheet(sheetPlace, true);
  }
  save();
}
let lastUiRefresh = 0;
setInterval(tick, 1000);

// ---------------------------------------------------------------------------
// UI : HUD, toasts, gros titres
// ---------------------------------------------------------------------------
const $ = (s) => document.querySelector(s);

// le patrimoine « compte » vers sa nouvelle valeur au lieu de sauter
let worthShown = null;
function animateWorth(to) {
  const el = $("#worth");
  if (worthShown === null || Math.abs(to - worthShown) < 2) {
    worthShown = to; el.textContent = fmt(to); return;
  }
  const from = worthShown;
  worthShown = to;
  const t0 = performance.now();
  const step = (tn) => {
    const k = Math.min(1, (tn - t0) / 500);
    el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function updateHUD() {
  const worth = netWorth();
  animateWorth(worth);
  $("#cash").textContent = fmt(S.cash);
  // variation du jour, comme sur la maquette H3 (« ↗ +2,4 % »)
  const delta = S.dayWorth > 0 ? (worth / S.dayWorth - 1) * 100 : 0;
  const chip = $("#delta");
  chip.hidden = Math.abs(delta) < 0.05;
  chip.textContent = `${delta >= 0 ? "↗ +" : "↘ "}${delta.toFixed(1).replace(".", ",")} %`;
  chip.classList.toggle("down", delta < 0);

  checkTitle();
  ensureQuests();

  const t = monopolyTarget();
  const mono = $("#mono-chip");
  if (t) {
    mono.hidden = false;
    $("#mono-label").textContent = `${CAT_META[t.cat].icon} Monopole ${t.mine}/${t.total}`;
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
    txt = `🪙 +${fmt(pending)} à encaisser !`;
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
    } else if (S.deals.some((dl) => dl.km - dl.done <= 0.5)) {
      const dl = S.deals.find((x) => x.km - x.done <= 0.5);
      txt = `🗂️ Plus que ${Math.max(0, Math.round((dl.km - dl.done) * 1000))} m de marche pour boucler « ${DEAL_TIERS[dl.tier].name} »`;
      coachAction = () => { setTab("empire"); openPanel("empire"); };
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

// ---------------------------------------------------------------------------
// Sons (WebAudio synthétisé — zéro fichier à télécharger)
// ---------------------------------------------------------------------------
let audioCtx = null;
function ensureAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // déverrouillage iOS : jouer un buffer muet dans le geste utilisateur
      const b = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = b;
      src.connect(audioCtx.destination);
      src.start(0);
    }
    if (audioCtx.state !== "running") audioCtx.resume().catch(() => {});
  } catch (e) {}
}
// à CHAQUE tap (iOS suspend le contexte à sa guise — on le réveille sans cesse)
document.addEventListener("pointerdown", ensureAudio);

function note(freq, t0, dur, type = "sine", vol = 0.12) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(t0); o.stop(t0 + dur);
}

function sfx(kind) {
  if (S.muted || !audioCtx) return;
  if (audioCtx.state !== "running") { ensureAudio(); if (audioCtx.state !== "running") return; }
  const t = audioCtx.currentTime;
  try {
    if (kind === "coin") {
      note(880, t, 0.09, "sine", 0.10);
      note(1318, t + 0.07, 0.14, "sine", 0.10);
    } else if (kind === "buy") {
      note(587, t, 0.10, "triangle", 0.14);
      note(880, t + 0.08, 0.12, "triangle", 0.14);
      note(1174, t + 0.16, 0.22, "triangle", 0.12);
    } else if (kind === "mono") {
      [523, 659, 784, 1046, 1318].forEach((f, i) => note(f, t + i * 0.09, 0.25, "square", 0.07));
    } else if (kind === "quest") {
      note(987, t, 0.10, "sine", 0.09);
      note(1479, t + 0.09, 0.18, "sine", 0.09);
    }
  } catch (e) {}
}

// conseil contextuel — montré une seule fois par clé
function tip(key, text) {
  if (S.tips[key]) return;
  S.tips[key] = true; save();
  const el = document.createElement("div");
  el.className = "toast tip";
  el.textContent = "💡 " + text;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 8000);
}

// explosion de pièces (achat, monopole)
function burst(p, n = 9) {
  if (!map) return;
  const px = map.project([p.lon, p.lat]);
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "burst-p";
    el.textContent = ["🪙", "✨", "💸"][i % 3];
    el.style.left = px.x + "px";
    el.style.top = px.y + "px";
    el.style.setProperty("--dx", Math.cos((i / n) * 6.283) * (40 + Math.random() * 45) + "px");
    el.style.setProperty("--dy", Math.sin((i / n) * 6.283) * (32 + Math.random() * 32) - 46 + "px");
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }
}

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
        ${inspected ? `<div class="stat">👔 <b>Tournée ×${isWeekend() ? 3 : 2}</b> — encore ${Math.max(1, Math.ceil((o.inspectedUntil - S.gameMs) / HOUR))} h</div>` : ""}
      </div>
      <div class="btn-row">
        <button class="btn" id="a-collect" ${accrued(p) < 1 ? "disabled" : ""}>
          🪙 Collecter ${fmt(accrued(p))}</button>
      </div>
      <div class="btn-row">
        ${near ? `<button class="btn ghost" id="a-inspect" ${inspected ? "disabled" : ""}>
          ${inspected ? "👔 Tournée déjà faite — revenez demain" : `👔 Tournée du proprio (loyer ×${isWeekend() ? 3 : 2}, 24 h)`}</button>`
        : `<button class="btn ghost" id="a-goto">🚶 S'y rendre</button>`}
        ${nextCost != null ? `
        <button class="btn gold" id="a-upgrade" ${S.cash >= nextCost ? "" : "disabled"}>
          🏗️ ${ECO.upNames[o.level]} · loyer ×${ECO.upMult[o.level]} — ${fmt(nextCost)}</button>` : ""}
      </div>`;
    $("#a-collect")?.addEventListener("click", () => collect(p));
    $("#a-inspect")?.addEventListener("click", () => inspect(p));
    $("#a-upgrade")?.addEventListener("click", () => upgrade(p));
    $("#a-goto")?.addEventListener("click", () => goTo(p));
    if (!near) body.insertAdjacentHTML("beforeend",
      '<div class="hint">👔 La tournée : passez voir votre bien sur place et son loyer double pendant 24 h. C\'est votre raison de sortir marcher.</div>');
  } else {
    const cost = priceToPay(p);
    const npcOwned = npcOf(p.id);
    const afford = S.cash >= cost;
    body.innerHTML = `
      <div class="sheet-row">
        <div class="stat">Prix <b>${fmt(cost)}</b>${npcOwned ? " (rachat ×1,5)" : ""}</div>
        <div class="stat">Rapportera <b>${fmt(p.price * ECO.rentDay)}</b>/jour</div>
        ${S.discounts[p.id] ? `<div class="stat">🔍 Dossier <b>−${Math.round(S.discounts[p.id] * 100)} %</b></div>` : ""}
        ${npcOwned ? `<div class="stat">🏗️ <b>${npcName(p.id)}</b></div>` : ""}
      </div>
      <div class="btn-row">
        ${!near ? '<button class="btn ghost" id="a-goto">🚶 S\'y rendre</button>'
          : `<button class="btn ghost" id="a-scout" ${S.scouted[p.id] === gameDay() ? "disabled" : ""}>
             ${S.scouted[p.id] === gameDay() ? "🔍 Repéré aujourd'hui" : "🔍 Repérage (−5 % au prix)"}</button>`}
        <button class="btn" id="a-buy" ${near && afford ? "" : "disabled"}>
          ${npcOwned ? "😤 Racheter" : "📜 Acheter"} — ${fmt(cost)}</button>
      </div>
      ${near && !afford ? `<div class="hint">Il vous manque ${fmt(cost - S.cash)}. Les loyers tombent, patience.</div>` : ""}`;
    $("#a-buy")?.addEventListener("click", () => buy(p));
    $("#a-goto")?.addEventListener("click", () => goTo(p));
    $("#a-scout")?.addEventListener("click", () => scout(p));
  }
  if (!silent) map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 16), speed: 1.4 });
  $("#coach").hidden = true;
}

$("#sheet-close").addEventListener("click", () => {
  $("#sheet").hidden = true;
  sheetPlace = null;
  updateCoach();
});

// la jauge de monopole est tappable : vole vers la prochaine pièce à acheter
$("#mono-chip").addEventListener("click", () => {
  const t = monopolyTarget();
  if (!t) return;
  const next = PLACES.filter((p) => p.cat === t.cat && !S.owned[p.id])
    .sort((a, b) => priceToPay(a) - priceToPay(b))[0];
  if (next) openSheet(next);
});
$("#mg-btn").addEventListener("click", () => endMinigame(true));
$("#mg-flee").addEventListener("click", () => endMinigame(false));

// respiration de la carte : pièces qui flottent, anneaux qui pulsent
setInterval(() => {
  if (!map) return;
  const t = Date.now() / 1000;
  try {
    if (map.getLayer("place-coin"))
      map.setPaintProperty("place-coin", "icon-translate", [0, Math.sin(t * 2.6) * 4]);
    if (map.getLayer("place-ring"))
      map.setPaintProperty("place-ring", "circle-stroke-opacity", 0.62 + 0.28 * Math.sin(t * 2));
    if (map.getLayer("spawn-icons"))
      map.setPaintProperty("spawn-icons", "icon-translate", [0, Math.sin(t * 2.2 + 1.5) * 5]);
  } catch (e) {}
}, 150);

// ---------------------------------------------------------------------------
// Panneaux : Bourse / Journal / Empire
// ---------------------------------------------------------------------------
let panelTab = null;
let expandedSym = null;

function renderPanel() {
  const c = $("#panel-content");
  const scroll = $("#panel").scrollTop;

  if (panelTab === "bourse") {
    // le squelette est construit UNE fois ; ensuite seuls les chiffres et
    // les courbes bougent (aucun rechargement visible)
    c.classList.toggle("animate", panelJustOpened);
    panelJustOpened = false;
    c.innerHTML = `
      <div class="bourse-top">
        <h2>LA BOURSE</h2>
        <span class="close-chip" id="bourse-chip"></span>
      </div>
      <div class="index-row">
        <span class="index-val" id="idx-val">—</span>
        <span class="index-delta" id="idx-delta"></span>
      </div>
      <div class="panel-hint" style="margin:2px 0 0">Indice MAGNAT — la moyenne des 9 valeurs de la cote.</div>
      <canvas id="index-chart" width="680" height="300"></canvas>
      <div id="bourse-event"></div>
      ${Object.keys(TICKERS).map((sym, i) => {
        const t = TICKERS[sym];
        return `
        <div class="stock-card" data-sym="${sym}" style="animation-delay:${i * 45}ms">
          <div class="sc-top">
            <img class="sc-icon" src="assets/stocks/${sym.toLowerCase()}.png" alt="">
            <div class="sc-name">
              <b>${t.name}</b>
              <span class="sc-pos" data-pos></span>
            </div>
            <div class="sc-right">
              <div class="sc-delta" data-delta></div>
              <div class="sc-price" data-price></div>
            </div>
          </div>
          <canvas class="sc-chart" data-spark="${sym}" width="640" height="96"></canvas>
          <div class="sc-actions">
            <span class="shock-badge" data-shock hidden></span>
            <span class="div-chip">Div ${(t.div * 100).toFixed(1).replace(".", ",")} %/j</span>
            <span class="sc-pnl" data-pnl></span>
            <button class="btn sell mini" data-trade="-10" data-tsym="${sym}">Vendre 10</button>
            <button class="btn mini" data-trade="10" data-tsym="${sym}">Acheter 10</button>
          </div>
        </div>`;
      }).join("")}
      <div class="proto-note">Prototype : bourse déverrouillée d'office (en prod : après le premier monopole).<br>
      Économie simulée — en production, les cours réagiront à l'activité réelle des joueurs.</div>`;

    c.querySelectorAll("[data-trade]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        trade(b.dataset.tsym, parseInt(b.dataset.trade, 10));
      }));

    refreshBourseTexts();
    startBourseLive();
  }

  else if (panelTab === "journal") {
    const iconFor = (txt) => {
      if (/MONOPOLE|monopole/.test(txt)) return "👑";
      if (/BOURSE|RUMEUR|COTE|Cotation|Tuyau|tuyau/.test(txt)) return "📈";
      if (/Bétonneur|Vieilargent|StartupBro|Baronne|rival/.test(txt)) return "🏗️";
      if (/Informateur/.test(txt)) return "🕵️";
      if (/Impôts|amende/.test(txt)) return "👮";
      if (/rang de|PROMOTION/.test(txt)) return "🎩";
      if (/Client Mystère|étrille|encense/.test(txt)) return "🧐";
      if (/Acte notarié|arraché/.test(txt)) return "📜";
      return "🗞️";
    };
    c.innerHTML = `
      <div class="jr-masthead">
        <div class="jr-title">LA PLUS-VALUE</div>
        <div class="jr-tag">Le journal qui possède ses lecteurs — Mouriès, jour ${gameDay() + 1}</div>
      </div>` +
      (S.journal.length
        ? S.journal.map((n, i) => `
          <div class="jr-card" style="animation-delay:${Math.min(i, 8) * 40}ms">
            <div class="jr-medal">${iconFor(n.text)}</div>
            <div class="jr-body">
              <div class="jr-day">JOUR ${n.day + 1}</div>
              <div class="jr-text">${n.text}</div>
            </div>
          </div>`).join("")
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
        &nbsp;<button class="help-link" id="a-help">❓ Comment jouer</button>
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
      <div class="stat-tiles">
        <div class="stile"><span class="stile-ic">💵</span><b>${fmt(S.cash)}</b><span class="stile-lbl">Liquidités</span></div>
        <div class="stile"><span class="stile-ic">🏠</span><b>${fmt(propTotal)}</b><span class="stile-lbl">Immobilier</span></div>
        <div class="stile"><span class="stile-ic">📈</span><b>${fmt(stockValue())}</b><span class="stile-lbl">Actions</span></div>
        <div class="stile gold"><span class="stile-ic">🪙</span><b>+${fmt(rentTotal)}</b><span class="stile-lbl">Loyers / jour</span></div>
      </div>
      ${pending >= 1 ? `<div class="btn-row" style="margin-bottom:12px">
        <button class="btn" id="a-collect-all">🪙 Tout encaisser — ${fmt(pending)}</button></div>` : ""}
      <div class="avatar-row">
        ${Object.keys(AVATARS).map((k) => `
          <button class="avatar-pick ${S.avatar === k ? "on" : ""}" data-avatar="${k}" title="${AVATARS[k].name}">
            <img src="assets/avatars/${k}.png" alt="${AVATARS[k].name}">
          </button>`).join("")}
      </div>
      <div class="walk-line">🚶 <b>${S.walk.total.toFixed(1)} km</b> parcourus · indemnités du jour : ${Math.min(S.walk.todayKm, 20).toFixed(1)}/20 km</div>
      ${S.deals.map((dl) => {
        const T = DEAL_TIERS[dl.tier];
        const pct = Math.min(100, (dl.done / dl.km) * 100);
        return `<div class="deal-card">
          <div class="deal-head">🗂️ <b>${T.name}</b>
            <span class="deal-km">${Math.min(dl.done, dl.km).toFixed(1)} / ${dl.km} km</span>
          </div>
          <div class="deal-bar"><div class="deal-fill" style="width:${pct}%"></div></div>
        </div>`;
      }).join("")}` +
      (ids.length
        ? ids.map((id, i) => {
            const p = byId[id], o = S.owned[id];
            return `<div class="prop-card" data-id="${id}" style="animation-delay:${Math.min(i, 8) * 40}ms">
              <img class="prop-img" src="assets/${sprName(p)}.png" alt="">
              <div class="prop-info">
                <b>${p.name}</b>
                <div class="sub">${o.level ? "🏗️ " + ECO.upNames[o.level - 1] + " · " : ""}${hasMonopoly(p.cat) ? "👑 Monopole · " : ""}${fmt(placeValue(p))}</div>
              </div>
              <div class="val">+${fmt(rentPerDay(p))}<span class="val-day">/jour</span></div>
            </div>`;
          }).join("")
        : `<div class="locked"><div class="big">🏚️</div><p>Vous ne possédez rien. C'est réparable.</p></div>`);
    $("#a-help")?.addEventListener("click", () => openPanel("aide"));
    c.querySelectorAll(".avatar-pick").forEach((b) =>
      b.addEventListener("click", () => { setAvatar(b.dataset.avatar); renderPanel(); }));
    $("#a-collect-all")?.addEventListener("click", () => { collectAll(); renderPanel(); });
    c.querySelectorAll(".prop-card").forEach((row) =>
      row.addEventListener("click", () => {
        closePanel();
        openSheet(byId[row.dataset.id]);
      }));
  }

  else if (panelTab === "aide") {
    const steps = [
      ["🏠", "Achetez les commerces autour de vous", "à moins de 300 m — ou touchez « S'y rendre » en mode balade."],
      ["🪙", "Encaissez les loyers", "vos biens produisent en continu, mais l'accumulation se bloque après 8 h : revenez souvent."],
      ["👔", "Faites la Tournée du proprio", "passez voir un bien sur place : son loyer double pendant 24 h (×3 le week-end)."],
      ["👑", "Décrochez des Monopoles", "possédez TOUS les commerces d'une catégorie du village : loyers ×2 pour toujours."],
      ["🏗️", "Améliorez vos biens", "Ravalement, Gentrification, Flagship : le loyer grimpe à chaque niveau."],
      ["📈", "Spéculez à la Bourse", "séance 9h–18h, dividendes à la clôture, gros événement chaque lundi. Vos loyers financent vos actions."],
      ["⚔️", "Surveillez les rivaux", "quatre magnats achètent le village. Rachetez leurs biens (×1,5) avant qu'ils ne bloquent vos monopoles."],
      ["🎯", "Suivez le guide", "les Défis du jour paient, et la pastille en bas d'écran vous dit toujours la meilleure action."],
    ];
    c.innerHTML = `<h2>Comment jouer</h2>
      <div class="panel-sub">La boucle de MAGNAT en huit gestes.</div>` +
      steps.map(([icon, t, d]) => `
        <div class="help-step">
          <div class="hs-icon">${icon}</div>
          <div><b>${t}</b><div class="hs-sub">${d}</div></div>
        </div>`).join("") +
      `<div class="proto-note">MAGNAT — République du Capital. Acte notarié fourni, scrupules non inclus.</div>`;
  }
  $("#panel").scrollTop = scroll;
}

// courbe vivante d'une carte de valeur : aire dégradée + point doré
function drawSpark(cv, data) {
  if (!cv || data.length < 2) return;
  const ctx = cv.getContext("2d");
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const W = cv.width, Hh = cv.height, pad = 6;
  const X = (i) => pad + (i / (data.length - 1)) * (W - 2 * pad);
  const Y = (v) => Hh - pad - ((v - min) / range) * (Hh - 2.4 * pad);
  ctx.clearRect(0, 0, W, Hh);
  const up = data[data.length - 1] >= data[0];
  const base = up ? (night ? "92,224,161" : "14,155,98") : "226,96,76";
  const grad = ctx.createLinearGradient(0, 0, 0, Hh);
  grad.addColorStop(0, `rgba(${base},0.28)`);
  grad.addColorStop(1, `rgba(${base},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(X(0), Hh - pad);
  data.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
  ctx.lineTo(X(data.length - 1), Hh - pad);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = up ? (night ? "#5CE0A1" : "#0E9B62") : "#E2604C";
  ctx.lineWidth = 3.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  data.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.stroke();
  ctx.fillStyle = "#E9C05C";
  ctx.beginPath(); ctx.arc(X(data.length - 1), Y(data[data.length - 1]), 4, 0, 7); ctx.fill();
}

// mise à jour chirurgicale des textes de la Bourse (aucun re-rendu du DOM)
function refreshBourseTexts() {
  const c = $("#panel-content");
  if (panelTab !== "bourse") return;
  const H = Math.floor(S.gameMs / HOUR), hod = (9 + H) % 24;
  const open = marketOpen();
  const chip = c.querySelector("#bourse-chip");
  if (chip) {
    chip.textContent = open ? `🕐 Clôture dans ${18 - hod} h`
      : isWeekend() ? "🕐 Week-end — fermé"
      : hod < 9 ? "🕐 Ouverture à 9h" : "🕐 Fermé — demain 9h";
  }
  const idx = indexValue();
  const d = S.indexDayOpen > 0 ? (idx / S.indexDayOpen - 1) * 100 : 0;
  const iv = c.querySelector("#idx-val");
  if (iv) iv.textContent = Math.round(idx).toLocaleString("fr-FR") + " pts";
  const idl = c.querySelector("#idx-delta");
  if (idl) {
    idl.textContent = `${d >= 0 ? "↗ +" : "↘ "}${Math.abs(d).toFixed(1).replace(".", ",")} %`;
    idl.className = "index-delta " + (d >= 0 ? "up" : "down");
  }
  const evc = c.querySelector("#bourse-event");
  if (evc) {
    const html = S.eventNow ? `<div class="event-banner">🚨 ${S.eventNow.head}</div>` : "";
    if (evc.innerHTML !== html) evc.innerHTML = html;
  }
  for (const sym in TICKERS) {
    const card = c.querySelector(`.stock-card[data-sym="${sym}"]`);
    if (!card) continue;
    const st = S.stocks[sym];
    const delta = (st.price / st.dayOpen - 1) * 100;
    const cls = st.halted > 0 ? "halt" : delta >= 0 ? "up" : "down";
    const de = card.querySelector("[data-delta]");
    de.textContent = st.halted > 0 ? "⛔" : `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1).replace(".", ",")} %`;
    de.className = "sc-delta " + cls;
    card.querySelector("[data-price]").textContent = st.price.toFixed(2).replace(".", ",") + " ₣";
    card.querySelector("[data-pos]").textContent = st.shares > 0
      ? `Vous : ${st.shares} actions · ${fmt(st.shares * st.price)}`
      : TICKERS[sym].desc;
    const pnl = st.shares * (st.price - st.dayOpen);
    const pe = card.querySelector("[data-pnl]");
    if (st.shares > 0 && Math.abs(pnl) >= 1) {
      pe.textContent = `${pnl >= 0 ? "+" : "−"}${fmt(Math.abs(pnl))} auj.`;
      pe.className = "sc-pnl " + (pnl >= 0 ? "up" : "down");
    } else {
      pe.textContent = "";
    }
    card.querySelectorAll("[data-trade]").forEach((b) => {
      const q = parseInt(b.dataset.trade, 10);
      b.disabled = q > 0 ? S.cash < q * st.price : st.shares <= 0;
    });
    // badge « tuyau de l'Informateur » visible 30 min
    const sb = card.querySelector("[data-shock]");
    if (sb) {
      const fresh = st.shock && Date.now() - st.shock.at < 30 * 60_000;
      sb.hidden = !fresh;
      if (fresh) {
        sb.textContent = `🕵️ ${st.shock.pct >= 0 ? "+" : "−"}${Math.abs(st.shock.pct * 100).toFixed(1).replace(".", ",")} %`;
        sb.className = "shock-badge " + (st.shock.pct >= 0 ? "up" : "down");
      }
    }
  }
}

// animation continue : le graphique « morphe » en douceur vers chaque
// nouveau point, 60 images/seconde, sans jamais reconstruire la page
let liveRaf = null, liveDisp = null, liveFrame = 0;
function startBourseLive() {
  stopBourseLive();
  liveDisp = null;
  liveFrame = 0;
  const loop = () => {
    if (panelTab !== "bourse" || $("#panel").hidden) { liveRaf = null; return; }
    const target = S.indexHist.slice(-60).concat(indexValue());
    if (!liveDisp) liveDisp = target.slice();
    while (liveDisp.length < target.length) liveDisp.push(liveDisp[liveDisp.length - 1] ?? target[target.length - 1]);
    while (liveDisp.length > target.length) liveDisp.shift();
    for (let i = 0; i < target.length; i++) liveDisp[i] += (target[i] - liveDisp[i]) * 0.09;
    drawIndexChart(liveDisp);
    if (liveFrame % 5 === 0) {
      document.querySelectorAll(".sc-chart").forEach((cv) => {
        const st = S.stocks[cv.dataset.spark];
        if (st) drawSpark(cv, st.hist.slice(-30).concat(st.price));
      });
    }
    if (liveFrame++ % 12 === 0) refreshBourseTexts();
    liveRaf = requestAnimationFrame(loop);
  };
  liveRaf = requestAnimationFrame(loop);
}
function stopBourseLive() {
  if (liveRaf) cancelAnimationFrame(liveRaf);
  liveRaf = null;
}

// le grand graphique de l'indice — dégradé lumineux et point doré (maquettes H1/H2)
function drawIndexChart(dataIn) {
  const cv = document.getElementById("index-chart");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  let data = dataIn || S.indexHist.slice(-48).concat(indexValue());
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

  // point final doré avec halo qui pulse
  const tPulse = Date.now() / 1000;
  const lx = X(data.length - 1), ly = Y(data[data.length - 1]);
  ctx.fillStyle = `rgba(233,192,92,${0.22 + 0.14 * Math.sin(tPulse * 3)})`;
  ctx.beginPath(); ctx.arc(lx, ly, 13 + 3 * Math.sin(tPulse * 3), 0, 7); ctx.fill();
  ctx.fillStyle = "#E9C05C";
  ctx.beginPath(); ctx.arc(lx, ly, 6, 0, 7); ctx.fill();
}

let panelJustOpened = false;
function openPanel(tab) {
  stopBourseLive();
  panelTab = tab;
  panelJustOpened = true;
  $("#panel").hidden = false;
  $("#coach").hidden = true;
  if (tab === "journal") { S.journalRead = S.journal.length; save(); updateBadges(); }
  if (tab === "bourse") tip("bourse", "Achetez bas, vendez haut — et détenir paie : dividendes à chaque clôture de 18h. Gros événement chaque lundi matin.");
  renderPanel();
}
function closePanel() {
  stopBourseLive();
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
  // le thème suit l'horloge du JEU (identique à l'heure réelle à vitesse
  // normale ; en accéléré, les nuits simulées s'affichent vraiment)
  const hod = (9 + S.gameMs / HOUR) % 24;
  return hod >= 18.5 || hod < 9;
}

let lastThemeSwitch = 0;
function applyThemeByClock() {
  if (!baseStyle || wantNight() === night) return;
  const now = Date.now();
  if (now - lastThemeSwitch < 20_000) return; // pas plus d'une bascule / 20 s
  lastThemeSwitch = now;
  applyTheme(wantNight());
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

let walkAnimTimer = null;
function setPlayer(lat, lon, fly = false) {
  // podomètre GPS : seuls les déplacements plausibles comptent (3–100 m)
  let movedNow = false;
  if (player) {
    const d = dist(player.lat, player.lon, lat, lon);
    if (d >= 3 && d <= 100) { walkCredit(d); movedNow = true; }
    else if (d >= 1) movedNow = true;
  }
  player = { lat, lon };
  if (!playerMarker) {
    const el = document.createElement("div");
    el.className = "player-marker";
    el.innerHTML = `<img class="player-avatar" src="assets/avatars/${S.avatar}.png" alt=""><div class="player-ring"></div>`;
    playerMarker = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lon, lat]).addTo(map);
  } else {
    playerMarker.setLngLat([lon, lat]);
  }
  // l'avatar « marche » quelques secondes après chaque déplacement
  if (movedNow) {
    const el = playerMarker.getElement();
    el.classList.add("walking");
    clearTimeout(walkAnimTimer);
    walkAnimTimer = setTimeout(() => el.classList.remove("walking"), 2000);
  }
  try { map.getSource("radius")?.setData(radiusGeoJSON()); } catch (e) {}
  if (fly) map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 16) });
  if (sheetPlace) openSheet(sheetPlace, true);
}

function setAvatar(key) {
  if (!AVATARS[key]) return;
  S.avatar = key;
  const img = playerMarker?.getElement()?.querySelector(".player-avatar");
  if (img) img.src = `assets/avatars/${key}.png`;
  sfx("quest");
  toast(`🕴️ Vous êtes désormais « ${AVATARS[key].name} »`);
  save();
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

// pastille de rencontre : bulle blanche + personnage emoji
function encounterIcon(emoji) {
  const c = document.createElement("canvas");
  c.width = c.height = 80;
  const x = c.getContext("2d");
  x.beginPath(); x.arc(40, 36, 30, 0, 7);
  x.fillStyle = "#FFFDF4"; x.fill();
  x.lineWidth = 4; x.strokeStyle = "#E9C05C"; x.stroke();
  x.beginPath();
  x.moveTo(32, 62); x.lineTo(40, 76); x.lineTo(48, 62);
  x.closePath(); x.fillStyle = "#E9C05C"; x.fill();
  x.font = "34px -apple-system, 'Apple Color Emoji', sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(emoji, 40, 38);
  return x.getImageData(0, 0, 80, 80);
}

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

// certaines catégories ont une 2e variante de bâtiment (anti-répétition)
const VARIANT_CATS = ["commerce", "artisanat", "restaurant", "boulangerie"];
const EXTRA_SPRITES = ["culture-b", "culture-lib"];
function sprName(p) {
  if (p.cat === "culture") {
    // la mairie garde son drapeau, la médiathèque ses livres,
    // les ruines sont réservées aux vrais sites archéologiques
    if (p.sub === "townhall") return "culture";
    if (p.sub === "library") return "culture-lib";
    return "culture-b";
  }
  return p.cat + (VARIANT_CATS.includes(p.cat) && parseInt(p.id.slice(1), 10) % 2 ? "-b" : "");
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
  // variantes optionnelles (absentes = retombe sur le sprite de base)
  const extras = VARIANT_CATS.map((c) => c + "-b").concat(EXTRA_SPRITES);
  await Promise.all(extras.flatMap((name) => [
    map.loadImage(`assets/${name}.png`)
      .then((r) => { if (!map.hasImage(`d-${name}`)) map.addImage(`d-${name}`, r.data); })
      .catch(() => {}),
    map.loadImage(`assets/${name}-night.png`)
      .then((r) => { if (!map.hasImage(`n-${name}`)) map.addImage(`n-${name}`, r.data); })
      .catch(() => {}),
  ]));
  if (!map.hasImage("coin")) map.addImage("coin", coinImage());
  // personnages 3D des rencontres (fallback : pastille emoji)
  await Promise.all(Object.keys(ENCOUNTER_TYPES).map((k) =>
    map.loadImage(`assets/char-${k}.png`)
      .then((r) => { if (!map.hasImage("sp-" + k)) map.addImage("sp-" + k, r.data); })
      .catch(() => { if (!map.hasImage("sp-" + k)) map.addImage("sp-" + k, encounterIcon(ENCOUNTER_TYPES[k].emoji)); })
  ));
  spritesReady = true;
}

function placesGeoJSON() {
  return {
    type: "FeatureCollection",
    features: PLACES.map((p) => {
      const o = S.owned[p.id];
      const npc = npcOf(p.id);
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
          id: p.id, cat: p.cat, spr: sprName(p), state, tag,
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
        "icon-image": ["coalesce",
          ["image", ["concat", spritePrefix(), ["get", "spr"]]],
          ["image", ["concat", spritePrefix(), ["get", "cat"]]]],
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
  if (!map.getSource("spawns")) {
    map.addSource("spawns", { type: "geojson", data: spawnsGeoJSON() });
    map.addLayer({
      id: "spawn-icons", type: "symbol", source: "spawns",
      layout: {
        "icon-image": ["get", "icon"],
        // taille réelle : plus petit qu'une maison, mais repérable et tappable
        "icon-size": ["*",
          ["match", ["get", "icon"], "sp-valise", 0.75, 1.0],
          ["interpolate", ["linear"], ["zoom"], 14, 0.08, 16, 0.17, 18, 0.28]],
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  } else {
    map.getSource("spawns").setData(spawnsGeoJSON());
  }
  if (!placesWired) {
    placesWired = true;
    map.on("click", "spawn-icons", (e) => {
      const f = e.features && e.features[0];
      if (f) openEncounter(f.properties.id);
    });
    map.on("mouseenter", "spawn-icons", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "spawn-icons", () => (map.getCanvas().style.cursor = ""));
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
// outils de test accessibles depuis la console : magnat.speed(60), magnat.reset()
window.magnat = {
  speed: (s) => { speed = s || 1; toast(`⏩ ×${speed}`); },
  reset: () => { localStorage.removeItem(SAVE_KEY); location.reload(); },
  theme: () => { themeForced = themeForced === null ? !night : null; applyTheme(wantNight()); },
  mute: () => { S.muted = !S.muted; save(); },
};

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
      // bilan du retour : ce qui s'est accumulé pendant l'absence
      if (offlineGapMs > 2 * HOUR) {
        const pending = Object.keys(S.owned)
          .reduce((a, id) => a + accrued(byId[id]), 0);
        if (pending >= 1) {
          setTimeout(() => toast(`🌙 Pendant votre absence : ${fmt(pending)} de loyers vous attendent`, "gain"), 1200);
        }
      }
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

// PWA : coquille hors-ligne + installation sur l'écran d'accueil
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
