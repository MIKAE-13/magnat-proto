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
  betonneur:   { name: "Jean-Mi Bétonneur",   firstDay: 1, every: 4, prefs: ["commerce", "restaurant"], quote: "Le village a besoin de renouveau.",
                 arrival: "a été aperçu chez le notaire avec un carnet de chèques" },
  vieilargent: { name: "Gérard Vieilargent",  firstDay: 3, every: 5, prefs: ["culture", "artisanat"],   quote: "Le patrimoine ne se discute pas, il s'achète.",
                 arrival: "fait le tour des moulins en berline de collection" },
  kevin:       { name: "Kevin de StartupBro", firstDay: 5, every: 5, prefs: ["cafe", "bar"],            quote: "On va pivoter ce village en hub.",
                 arrival: "a demandé le débit de la fibre au café" },
  baronne:     { name: "La Baronne",          firstDay: 7, every: 6, prefs: ["restaurant", "sport"],    quote: "Tout ceci manquait cruellement de standing.",
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
  // jamais tiré par pickEncounterType (weight 0) : les parchemins ont leur
  // propre tirage (~30 % des apparitions) — mais ils se NÉGOCIENT désormais
  parchemin: {
    emoji: "📜", name: "Le Greffier au Parchemin", weight: 0, rarity: "commune",
    desc: "Un fragment d'acte notarial, scellé à la cire. Le greffier le lâchera — si vous savez lui parler.",
    zone: 0.26, speed: 3.2,
  },
};
const npcOf = (id) => S.npcOwners[id] || null;
const npcName = (id) => (NPCS[npcOf(id)] ? NPCS[npcOf(id)].name : "un rival");

// Le vestiaire : personnages générés (les premium s'achètent à la Boutique)
const AVATARS = {
  loup:       { name: "Le Jeune Loup" },
  magnate:    { name: "La Magnate" },
  heritier:   { name: "L'Héritier" },
  baroudeuse: { name: "La Baroudeuse" },
  banquier:   { name: "Le Banquier",  price: 2500 },
  artiste:    { name: "L'Artiste",    price: 2500 },
  golfeuse:   { name: "La Golfeuse",  price: 2500 },
  rentier:    { name: "Le Rentier",   price: 4000 },
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

// chaque catégorie de terrain pèse sur SA valeur : acheter une boulangerie
// quelque part en France pousse GLUTEN & FILS pour tout le monde
const CAT_TICKER = {
  cafe: "KWA", boulangerie: "GLU", bar: "HBL", restaurant: "FKT",
  commerce: "CDD", culture: "CDV", artisanat: "CDV", sport: "VRT",
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

function seedIntra(sym, price) {
  // pré-remplit la courbe : marche aléatoire à rebours, calée sur la
  // volatilité de la valeur, qui aboutit exactement au cours actuel
  const vol = TICKERS[sym].vol;
  const pts = [price];
  let p = price;
  for (let i = 0; i < 70; i++) {
    p = p / (1 + gauss() * (vol / 3));
    pts.unshift(Math.round(p * 100) / 100);
  }
  return pts;
}

function freshStocks() {
  const st = {};
  for (const sym in TICKERS) {
    const b = TICKERS[sym].base;
    st[sym] = { price: b, dayOpen: b, shares: 0, hist: [b], intra: seedIntra(sym, b), halted: 0 };
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
    frags: {},         // parchemins notariaux : placeId -> fragments réunis
    walk: { total: 0, day: -1, todayKm: 0, credited: 0 },
    deals: [],         // les « œufs » : dossiers qui se bouclent en km
    dealDay: -1,
    avatar: "loup",    // personnage porté
    wardrobe: ["loup", "magnate", "heritier", "baroudeuse"],
    xp: 0,
    level: 1,
    items: { cafe: 2, croissant: 2 },  // consommables de négociation
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
    natDivHour: -1,  // dernière clôture nationale déjà payée en dividendes
    natEvSeen: -1,   // dernier événement national déjà annoncé
    natNoctSeen: -1, // dernière nocturne déjà annoncée
    natV1: false,
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
      if (!Array.isArray(st.deals)) st.deals = [];
      // Strava (retiré le 16/07/2026 — API devenue payante) : on purge les
      // vieux jetons/secrets des sauvegardes existantes
      delete st.strava;
      for (const sym in st.stocks) {
        const stk = st.stocks[sym];
        if (!Array.isArray(stk.intra) || stk.intra.length < 10) stk.intra = seedIntra(sym, stk.price);
      }
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
  saveTimer = setTimeout(saveNow, 300);
}
// sauvegarde synchrone : indispensable juste avant de quitter la page (OAuth)
function saveNow() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
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
// format court pour le HUD : 742 ₣ · 8,4k ₣ · 96k ₣ · 1,2M ₣
function fmtShort(n) {
  n = Math.round(n);
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace(".", ",").replace(",0", "") + "M ₣";
  if (a >= 10_000) return Math.round(n / 1000) + "k ₣";
  if (a >= 1_000) return (n / 1000).toFixed(1).replace(".", ",").replace(",0", "") + "k ₣";
  return n.toLocaleString("fr-FR") + " ₣";
}
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
// LA FRANCE ENTIÈRE : les lieux réels se découvrent en se déplaçant.
// Dès qu'on explore une zone nouvelle, les commerces OpenStreetMap du
// secteur rejoignent le jeu — prix DÉTERMINISTES (même prix pour tous
// les joueurs, dérivés de l'identifiant OSM), donc cadastre partageable.
// ---------------------------------------------------------------------------
const BAKED_IDS = new Set(PLACES.map((p) => p.id)); // le village d'origine
const POI_CACHE_KEY = "magnat-poi-v1";
let poiCenters = [];
let poiFetching = false;
let poiLastTry = 0;

function osmCat(tags) {
  const a = tags.amenity, s = tags.shop, t = tags.tourism, l = tags.leisure, h = tags.historic;
  if (a === "cafe") return "cafe";
  if (a === "bar" || a === "pub" || a === "biergarten") return "bar";
  if (a === "restaurant" || a === "fast_food" || a === "food_court") return "restaurant";
  if (s === "bakery" || s === "pastry") return "boulangerie";
  if (s === "wine" || tags.craft) return "artisanat";
  if (a === "townhall" || a === "library" || a === "arts_centre" || a === "theatre" ||
      a === "cinema" || t === "museum" || t === "attraction" || t === "gallery" || h) return "culture";
  if (l === "sports_centre" || l === "stadium" || l === "fitness_centre" || l === "swimming_pool") return "sport";
  if (s || a === "pharmacy" || a === "bank" || a === "post_office" || a === "marketplace") return "commerce";
  return null;
}

const PRICE_RANGE = {
  cafe: [26000, 42000], bar: [22000, 38000], boulangerie: [20000, 32000],
  restaurant: [42000, 68000], commerce: [22000, 95000],
  artisanat: [55000, 85000], culture: [40000, 90000], sport: [55000, 80000],
};

function poiPrice(id, cat) {
  const [lo, hi] = PRICE_RANGE[cat];
  const r = (natHash("prix|" + id) % 1000) / 1000;
  return Math.round((lo + r * (hi - lo)) / 500) * 500;
}

function addPlaces(list) {
  let added = 0;
  for (const p of list) {
    if (byId[p.id]) continue;
    PLACES.push(p);
    byId[p.id] = p;
    added++;
  }
  if (added) refreshAllMarkers();
  return added;
}

function savePoiCache() {
  try {
    const dyn = PLACES.filter((p) => !BAKED_IDS.has(p.id));
    // jamais évincer un lieu possédé ou en collection de parchemins
    const precious = dyn.filter((p) => S.owned[p.id] || S.frags[p.id]);
    const others = dyn.filter((p) => !S.owned[p.id] && !S.frags[p.id]).slice(-(900 - precious.length));
    localStorage.setItem(POI_CACHE_KEY, JSON.stringify({
      centers: poiCenters.slice(-80), places: precious.concat(others),
    }));
  } catch (e) {}
}
// les lieux déjà découverts reviennent immédiatement au lancement
try {
  const cch = JSON.parse(localStorage.getItem(POI_CACHE_KEY) || "null");
  if (cch) { poiCenters = cch.centers || []; addPlaces(cch.places || []); }
} catch (e) {}

async function discoverAround(lat, lon) {
  const now = Date.now();
  if (poiFetching || now - poiLastTry < 15_000) return;
  if (poiCenters.some((c) => dist(lat, lon, c.lat, c.lon) < 900)) return;
  poiFetching = true;
  poiLastTry = now;
  const around = `around:1300,${lat.toFixed(5)},${lon.toFixed(5)}`;
  const q = `[out:json][timeout:12];(
    nwr(${around})[amenity~"^(cafe|bar|pub|biergarten|restaurant|fast_food|food_court|pharmacy|bank|post_office|marketplace|townhall|library|arts_centre|theatre|cinema)$"][name];
    nwr(${around})[shop][name];
    nwr(${around})[tourism~"^(museum|attraction|gallery)$"][name];
    nwr(${around})[historic~"^(castle|monument|archaeological_site|fort|tower|city_gate)$"][name];
    nwr(${around})[leisure~"^(sports_centre|stadium|fitness_centre|swimming_pool)$"][name];
    nwr(${around})[craft][name];
  );out center 150;`;
  const hosts = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  try {
    let data = null;
    for (const host of hosts) {
      try {
        const r = await fetch(host, {
          method: "POST",
          body: "data=" + encodeURIComponent(q),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        if (r.ok) { data = await r.json(); break; }
      } catch (e) {}
    }
    if (!data) return;
    poiCenters.push({ lat, lon });
    const fresh = [];
    for (const el of data.elements || []) {
      const tags = el.tags || {};
      const cat = osmCat(tags);
      const la = el.lat ?? el.center?.lat;
      const lo2 = el.lon ?? el.center?.lon;
      if (!cat || !tags.name || la == null || lo2 == null) continue;
      const id = el.type[0] + el.id;
      const sub = tags.shop || tags.amenity || tags.tourism || tags.leisure ||
        (tags.craft ? "craft" : "") || (tags.historic ? "archaeological_site" : "") || "";
      fresh.push({ id, name: tags.name.slice(0, 42), cat, sub, lat: la, lon: lo2, price: poiPrice(id, cat) });
    }
    const added = addPlaces(fresh);
    savePoiCache();
    if (added > 0) {
      journal(`EXPANSION — vous découvrez un nouveau secteur : <b>${added} lieu${added > 1 ? "x" : ""} réel${added > 1 ? "s" : ""} à acheter</b> rejoi${added > 1 ? "gnent" : "nt"} la carte (commerces, monuments et adresses du coin). La France entière est à vendre.`);
      tip("decouverte", "La France entière est à vendre : les vrais commerces apparaissent sur la carte en explorant — même prix pour tous les joueurs, cadastre commun.");
      updateHUD();
    }
  } finally {
    poiFetching = false;
  }
}

// ---------------------------------------------------------------------------
// Immobilier
// ---------------------------------------------------------------------------
function placeValue(p) {
  const o = S.owned[p.id];
  const invested = o ? ECO.upCost.slice(0, o.level).reduce((a, b) => a + b, 0) : 0;
  return p.price * (1 + invested);
}

// un monopole se GAGNE (tous les lieux d'une catégorie du quartier) puis se
// GARDE — la découverte de nouveaux lieux ailleurs en France ne le casse pas.
// Il ne se perd qu'en revendant un bien de la catégorie.
function hasMonopoly(cat) {
  return S.monopolies.includes(cat);
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
  for (const id in S.owned) {
    if (!byId[id]) continue;
    w += placeValue(byId[id]) + accrued(byId[id]);
  }
  return w;
}

function monopolyTarget() {
  // le monopole se joue dans le QUARTIER où l'on se trouve (rayon 1,8 km)
  const ref = player || { lat: CENTER[1], lon: CENTER[0] };
  let best = null;
  for (const cat in CAT_META) {
    if (S.monopolies.includes(cat)) continue;
    const group = PLACES.filter((p) =>
      p.cat === cat && dist(ref.lat, ref.lon, p.lat, p.lon) <= 1800);
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
// XP & niveaux : 50 niveaux, courbe et récompenses EXPONENTIELLES
// ---------------------------------------------------------------------------
const LEVEL_CAP = 50;
const xpNeeded = (lv) => Math.max(100, Math.round((80 * Math.pow(1.14, lv)) / 10) * 10);
const levelCash = (lv) => Math.round((300 * Math.pow(1.12, lv)) / 10) * 10;

// paliers de déblocage : chaque tranche de 5 niveaux améliore VRAIMENT le jeu
const PERKS = {
  5:  "3ᵉ dossier d'Affaires simultané",
  10: "Rayon d'action +25 m",
  15: "Indemnités kilométriques : plafond 30 km/jour",
  20: "Les rues attirent +2 rencontres",
  25: "La Tournée du proprio dure 36 h",
  30: "Repérage : remise maximale 20 %",
  35: "Rayon d'action +50 m",
  40: "Dividendes +10 %",
  45: "4 défis par jour",
  50: "Titre « Légende de Mouriès »",
};

// effets des paliers
const playerRadius = () => ECO.radiusM + (S.level >= 10 ? 25 : 0) + (S.level >= 35 ? 50 : 0);
const dealSlots = () => (S.level >= 5 ? 3 : 2);
const kmCap = () => (S.level >= 15 ? 30 : 20);
const inspectHours = () => (S.level >= 25 ? 36 : ECO.inspectDurH);
const maxDiscount = () => (S.level >= 30 ? 0.20 : 0.15);

function addXp(n) {
  if (S.level >= LEVEL_CAP) return false;
  S.xp += n;
  let up = false;
  while (S.level < LEVEL_CAP && S.xp >= xpNeeded(S.level)) {
    S.xp -= xpNeeded(S.level);
    S.level += 1;
    up = true;
    const cash = levelCash(S.level);
    S.cash += cash;
    S.items.cafe += 1;
    S.items.croissant += 1;
    if (S.level % 5 === 0) { S.items.cafe += 2; S.items.croissant += 2; }
    const perk = PERKS[S.level];
    headline(`<b>NIVEAU ${S.level}${S.level === LEVEL_CAP ? " — LÉGENDE DE MOURIÈS" : ""}.</b> +${fmt(cash)} et provisions de négociation${perk ? ` — débloqué : ${perk}` : ""}.`);
    journal(`<b>Niveau ${S.level}</b> : +${fmt(cash)}, +1 ☕ +1 🥐${S.level % 5 === 0 ? " (+2 de chaque en bonus de palier)" : ""}${perk ? ` — <b>${perk}</b>` : ""}.`);
  }
  if (up) sfx("mono");
  updateHUD(); save();
  return up;
}

// ---------------------------------------------------------------------------
// Défis du jour, titres, série
// ---------------------------------------------------------------------------
function ensureQuests() {
  const d = gameDay();
  if (S.quests.day === d) return;
  S.quests = {
    day: d,
    items: ["collect", "tournee", d % 2 ? "bourse" : "invest"]
      .concat(S.level >= 45 ? [d % 2 ? "invest" : "bourse"] : [])
      .map((id) => ({
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
    addXp(25);
    // un défi accompli offre parfois un objet de négociation
    if (Math.random() < 0.5) {
      const it = Math.random() < 0.5 ? "cafe" : "croissant";
      S.items[it] = (S.items[it] || 0) + 1;
    }
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
const inRange = (p) => player && dist(player.lat, player.lon, p.lat, p.lon) <= playerRadius();

function buy(p) {
  const cost = priceToPay(p);
  if (S.cash < cost || S.owned[p.id] || rivalPlayerOf(p.id)) return;
  const fromNpc = npcOf(p.id);
  S.cash -= cost;
  delete S.npcOwners[p.id];
  delete S.discounts[p.id];
  S.owned[p.id] = { level: 0, lastCollect: S.gameMs, inspectedUntil: S.gameMs + inspectHours() * HOUR };
  questBump("invest");
  addXp(40);
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
  checkMonopolies(p.cat, p);
  pushProperty(p.id, "achat");
  pushSignal(CAT_TICKER[p.cat], 0.002, "immo");
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
    if (!byId[id]) continue;
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
  S.owned[p.id].inspectedUntil = S.gameMs + inspectHours() * HOUR;
  toast(`👔 Le proprio est passé — loyer ×${isWeekend() ? 3 : 2} pendant 24 h`);
  questBump("tournee");
  addXp(15);
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
  pushProperty(p.id);
  refreshMarker(p); updateHUD(); openSheet(p, true); save();
}

function scout(p) {
  if (S.scouted[p.id] === gameDay() || S.owned[p.id]) return;
  S.scouted[p.id] = gameDay();
  const gain = Math.round((30 + Math.random() * 70) / 10) * 10;
  S.cash += gain;
  S.discounts[p.id] = Math.min(maxDiscount(), (S.discounts[p.id] || 0) + 0.05);
  sfx("coin");
  toast(`🔍 Repérage : +${fmt(gain)} · dossier −${Math.round(S.discounts[p.id] * 100)} % sur ${p.name}`, "gain");
  updateHUD(); openSheet(p, true); save();
}

function sellPlace(p) {
  if (!S.owned[p.id]) return;
  const gain = Math.round(placeValue(p) * 0.7);
  delete S.owned[p.id];
  S.monopolies = S.monopolies.filter((c) => c !== p.cat);
  S.cash += gain;
  sfx("coin");
  burst(p, 6);
  journal(`Vous cédez <b>${p.name}</b> pour ${fmt(gain)}. Le village jase, le notaire encaisse.`);
  removeProperty(p.id);
  pushSignal(CAT_TICKER[p.cat], -0.002, "immo");
  delete remoteProps[p.id];
  $("#sheet").hidden = true;
  sheetPlace = null;
  refreshAllMarkers(); updateHUD(); updateCoach(); save();
}


function checkMonopolies(cat, around) {
  if (S.monopolies.includes(cat)) return;
  // le quartier du bien qui vient d'être acquis : tous les lieux de la
  // catégorie à moins de 1,5 km doivent être à vous (2 minimum)
  const center = around || PLACES.find((p) => p.cat === cat && S.owned[p.id]);
  if (!center) return;
  const group = PLACES.filter((p) =>
    p.cat === cat && dist(center.lat, center.lon, p.lat, p.lon) <= 1500);
  if (group.length < 2 || !group.every((p) => S.owned[p.id])) return;
  S.monopolies.push(cat);
  if (S.firstMonopolyDay < 0) S.firstMonopolyDay = gameDay();
  group.forEach((p) => burst(p, 14));
  sfx("mono");
  addXp(150);
  const meta = CAT_META[cat];
  headline(`<b>LE MONOPOLE DES ${meta.plural.toUpperCase()} DU QUARTIER EST À VOUS.</b>
    Les loyers de la catégorie doublent. Le prix de tout augmente mystérieusement.`);
  journal(`MONOPOLE — le quartier n'a plus qu'un seul propriétaire de ${meta.plural} : vous. Loyers ×2.`);
  updateHUD();
}

// ---------------------------------------------------------------------------
// LA BOURSE NATIONALE : un seul marché pour toute la France, en temps RÉEL.
// Tous les clients calculent la MÊME courbe (bruit déterministe seedé par
// heure) ; l'activité réelle des joueurs — achats immobiliers, ordres,
// tuyaux d'Informateur — arrive par la table stock_signals et infléchit
// les cours pour tout le monde. Séance : 9h–18h en semaine, heure réelle.
// ---------------------------------------------------------------------------
const BOURSE_EPOCH = new Date(2026, 5, 1, 9, 0, 0).getTime(); // lundi 1er juin 2026, 9h

// signaux agrégés des joueurs : {sym, pct, h} — remplis par le réseau
let natSignalsRaw = [];
let natDirty = true;
let natLastHour = -1;

function natHash(str) {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}
// flottant [0,1) déterministe par clé : même valeur chez tous les joueurs
function natRnd(key) {
  let t = (natHash(key) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function natGaussK(key) {
  const u = Math.max(natRnd(key + "|u"), 1e-9), v = natRnd(key + "|v");
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const natHourNow = () => Math.floor((Date.now() - BOURSE_EPOCH) / HOUR);

function natIndex(P) {
  const syms = Object.keys(TICKERS);
  return (syms.reduce((a, s) => a + P[s] / TICKERS[s].base, 0) / syms.length) * 35_420;
}

// rejoue toute la marche depuis l'origine (≈ quelques milliers d'itérations,
// instantané) : anchors horaires, événements, clôtures, signaux joueurs
function natWalk() {
  const hNow = natHourNow();
  const sig = {};
  for (const g of natSignalsRaw) {
    const k = g.sym + "|" + g.h;
    sig[k] = (sig[k] || 0) + g.pct;
  }
  const P = {}, dayOpen = {}, hist = {}, anchorsToday = {}, halted = {}, pending = {};
  for (const sym in TICKERS) {
    P[sym] = TICKERS[sym].base; dayOpen[sym] = TICKERS[sym].base;
    hist[sym] = []; anchorsToday[sym] = []; halted[sym] = 0; pending[sym] = 0;
  }
  const idxAnchors = [];
  const closes = [];
  let ev = null, evStart = -1, idxDayOpen = 35_420;

  for (let h = 0; h <= hNow; h++) {
    const d = new Date(BOURSE_EPOCH + h * HOUR);
    const hod = d.getHours(), dow = d.getDay();
    const we = dow === 0 || dow === 6;
    const dayKey = Math.floor((BOURSE_EPOCH + h * HOUR) / DAY);

    // les signaux des joueurs s'ACCUMULENT à toute heure — ceux du soir et
    // de la nuit pèsent sur l'ouverture (« le gap d'ouverture intègre la nuit »)
    for (const sym in TICKERS) pending[sym] += sig[sym + "|" + h] || 0;

    if (!we && hod === 9) {
      for (const sym in TICKERS) { dayOpen[sym] = P[sym]; anchorsToday[sym] = [P[sym]]; halted[sym] = 0; }
      idxDayOpen = natIndex(P);
    }
    // grands événements lundi ET jeudi à 10h — choisis par la graine du jour
    if (!we && hod === 10 && (dow === 1 || dow === 4) && !ev) {
      const base = MARKET_EVENTS[natHash("ev|" + dayKey) % MARKET_EVENTS.length];
      const shocks = {};
      for (const sym in base.shocks) shocks[sym] = base.shocks[sym] / 18;
      ev = { head: base.head, shocks, hoursLeft: 18 };
      evStart = h;
    }
    // rumeur de mi-journée (~1 jour sur 2), déterministe elle aussi
    if (!we && hod === 13 && !ev && natRnd("rum|" + dayKey) < 0.65) {
      const syms = Object.keys(TICKERS);
      const sym = syms[natHash("rsym|" + dayKey) % syms.length];
      const mag = (0.04 + natRnd("rmag|" + dayKey) * 0.05) * (natRnd("rdir|" + dayKey) < 0.5 ? -1 : 1);
      ev = {
        head: `RUMEUR — ${TICKERS[sym].name} : ${mag > 0 ? "un gros contrat se murmure en coulisses" : "des comptes qui toussent, dit-on"}.`,
        shocks: { [sym]: mag / 3 }, hoursLeft: 3,
      };
      evStart = h;
    }
    // séance 9h–18h + certains soirs une NOCTURNE 21h–23h (déterministe,
    // ~1 soir sur 7 en semaine : le jeu du canapé a son rendez-vous)
    const noct = !we && natRnd("noct|" + dayKey) < 0.15 && hod >= 21 && hod < 23;
    if ((!we && hod >= 9 && hod < 18) || noct) {
      // secousses de séance (11h et 15h) : une valeur prend ±1–3 % sans
      // prévenir — le marché a ses humeurs, même sans nouvelle
      const symsAll = Object.keys(TICKERS);
      const joltSym = hod === 11 || hod === 15
        ? symsAll[natHash("j|" + hod + "|" + dayKey) % symsAll.length] : null;
      const joltMag = joltSym
        ? (0.01 + natRnd("jm|" + hod + "|" + dayKey) * 0.02) * (natRnd("jd|" + hod + "|" + dayKey) < 0.5 ? -1 : 1) : 0;
      for (const sym in TICKERS) {
        const t = TICKERS[sym];
        if (halted[sym] > 0) continue;
        const push = Math.max(-0.03, Math.min(0.03, pending[sym]));
        pending[sym] = 0;
        P[sym] *= 1 + t.drift / 9 + natGaussK("t|" + sym + "|" + h) * (t.vol / 1.7)
          + (ev?.shocks[sym] || 0) + push + (sym === joltSym ? joltMag : 0);
        const r = P[sym] / dayOpen[sym];
        if (r > 1.15 || r < 0.85) { P[sym] = dayOpen[sym] * (r > 1 ? 1.15 : 0.85); halted[sym] = 1; }
        // un cours ne passe jamais sous 4 % de sa base : il agonise en
        // penny stock, il ne meurt pas (la radiation de la cote viendra)
        if (P[sym] < TICKERS[sym].base * 0.04) P[sym] = TICKERS[sym].base * 0.04;
        anchorsToday[sym].push(Math.round(P[sym] * 100) / 100);
      }
      if (ev && --ev.hoursLeft <= 0) ev = null;
      if (h > hNow - 130) idxAnchors.push(Math.round(natIndex(P)));
    }
    if (!we && hod === 18) {
      closes.push({ h, prices: Object.assign({}, P) });
      for (const sym in TICKERS) {
        hist[sym].push(Math.round(P[sym] * 100) / 100);
        if (hist[sym].length > 120) hist[sym].shift();
      }
    }
  }
  return { hNow, P, dayOpen, hist, anchorsToday, halted, idxAnchors, idxDayOpen, ev, evStart, closes };
}

// applique la marche nationale à l'état local (les parts restent à vous)
function natApply() {
  const w = natWalk();
  const mNow = Math.floor(Date.now() / 8000);
  for (const sym in TICKERS) {
    const st = S.stocks[sym], t = TICKERS[sym];
    st.anchor = w.P[sym];
    st.dayOpen = w.dayOpen[sym];
    st.hist = w.hist[sym].length ? w.hist[sym] : [t.base];
    st.halted = w.halted[sym];
    // séance du jour + micro-bruit récent (déterministe) = courbe pleine
    const tail = [];
    if (marketOpen() && !st.halted) {
      for (let m = mNow - 45; m <= mNow; m++) {
        let p = st.anchor * (1 + natGaussK("m|" + sym + "|" + m) * (t.vol / 9));
        const r = p / st.dayOpen;
        if (r > 1.15) p = st.dayOpen * 1.15;
        if (r < 0.85) p = st.dayOpen * 0.85;
        tail.push(Math.round(p * 100) / 100);
      }
    }
    st.intra = (w.anchorsToday[sym].length ? w.anchorsToday[sym] : st.hist.slice(-20)).concat(tail).slice(-120);
    if (st.intra.length < 2) st.intra = [st.anchor, st.anchor];
    st.price = st.intra[st.intra.length - 1];
  }
  S.indexHist = w.idxAnchors.length ? w.idxAnchors.slice(-120) : [35_420];
  S.indexDayOpen = w.idxDayOpen;

  // bannière d'événement — annoncé en gros titre UNE seule fois
  if (w.ev) {
    S.eventNow = { head: w.ev.head, shocks: {}, hoursLeft: w.ev.hoursLeft };
    if (S.natEvSeen !== w.evStart) {
      S.natEvSeen = w.evStart;
      headline(`<b>${w.ev.head}</b>`);
      journal(`BOURSE — ${w.ev.head}`);
    }
  } else {
    S.eventNow = null;
  }
  // soir de NOCTURNE : annoncé dès 18h, bannière jusqu'à la clôture de 23h
  const dNow = new Date(), hodNow = dNow.getHours();
  const weNow = dNow.getDay() === 0 || dNow.getDay() === 6;
  if (!weNow && nocturneDay(Math.floor(Date.now() / DAY)) && hodNow >= 18 && hodNow < 23) {
    if (!S.eventNow) S.eventNow = {
      head: "🌙 SÉANCE NOCTURNE — le marché rouvre de 21h à 23h. Les insomniaques spéculent.",
      shocks: {}, hoursLeft: 23 - hodNow,
    };
    const dayKeyNow = Math.floor(Date.now() / DAY);
    if (S.natNoctSeen !== dayKeyNow) {
      S.natNoctSeen = dayKeyNow;
      headline("<b>SÉANCE NOCTURNE CE SOIR.</b> Le marché rouvre de 21h à 23h — la France spécule en pyjama.");
      journal("BOURSE — 🌙 Séance NOCTURNE ce soir, 21h–23h. Le gap d'ouverture de demain intégrera aussi l'activité de la nuit.");
    }
  }

  // dividendes des clôtures écoulées (positions × cours de clôture national)
  if (S.natDivHour < 0) S.natDivHour = w.hNow; // migration : pas de rétroactif
  let divTotal = 0;
  for (const c of w.closes) {
    if (c.h <= S.natDivHour) continue;
    for (const sym in TICKERS) {
      const sh = S.stocks[sym].shares || 0;
      if (sh > 0) divTotal += sh * c.prices[sym] * TICKERS[sym].div * (S.level >= 40 ? 1.1 : 1);
    }
  }
  S.natDivHour = w.hNow;
  if (divTotal >= 1) {
    S.cash += divTotal;
    sfx("coin");
    notice(`💰 Dividendes de clôture : +${fmt(divTotal)}`);
    journal(`CLÔTURE — vos dividendes tombent : <b>+${fmt(divTotal)}</b>. L'argent travaille, vous non.`);
    updateHUD();
  }
  if (!S.natV1) {
    S.natV1 = true;
    journal("LA COTE PASSE AU NATIONAL — mêmes cours pour toute la France, en temps réel, poussés par l'activité de tous les magnats. Vos positions sont conservées.");
  }
  save();
}

function stockTick() {
  const h = natHourNow();
  if (h === natLastHour && !natDirty) return;
  natLastHour = h;
  natDirty = false;
  natApply();
  if (panelTab === "bourse") refreshBourseTexts();
}

// la séance nationale suit l'heure RÉELLE (l'accélérateur de test n'agit
// plus sur la bourse : elle est partagée par tous les joueurs)
const nocturneDay = (dayKey) => natRnd("noct|" + dayKey) < 0.15;
function marketOpen() {
  const d = new Date();
  if (d.getDay() === 0 || d.getDay() === 6) return false;
  const h = d.getHours();
  if (h >= 9 && h < 18) return true;
  return h >= 21 && h < 23 && nocturneDay(Math.floor(Date.now() / DAY));
}

// micro-ticks : toutes les ~8 s, frémissement déterministe autour de
// l'anchor horaire — tous les joueurs voient exactement la même courbe
let lastMicroTick = 0;
function microTick(now) {
  if (now - lastMicroTick < 8000 || !marketOpen()) return;
  lastMicroTick = now;
  const m = Math.floor(now / 8000);
  for (const sym in S.stocks) {
    const st = S.stocks[sym], t = TICKERS[sym];
    if (st.halted > 0 || !(st.anchor > 0)) continue;
    let p = st.anchor * (1 + natGaussK("m|" + sym + "|" + m) * (t.vol / 9));
    const r = p / st.dayOpen;
    if (r > 1.15) p = st.dayOpen * 1.15;
    if (r < 0.85) p = st.dayOpen * 0.85;
    st.price = Math.round(p * 100) / 100;
    st.intra.push(st.price);
    if (st.intra.length > 120) st.intra.shift();
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

// « max » = tout ce que les liquidités permettent · « -max » = toute la position
function tradeQty(sym, spec) {
  const st = S.stocks[sym];
  if (spec === "max") return Math.floor(S.cash / st.price);
  if (spec === "-max") return -st.shares;
  return parseInt(spec, 10);
}

function trade(sym, qty) {
  const st = S.stocks[sym];
  if (!qty) return;
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
  // la demande agrégée pèse sur le cours national (±0,05 % par ordre de 10)
  pushSignal(sym, Math.max(-0.005, Math.min(0.005, qty * 0.00005)), "ordre");
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
    // premier achat DÈS firstDay (l'ancien « ?? 0 » repoussait le premier
    // achat de `every` jours — le village semblait sans rivaux)
    const lastBuy = S.npcLast[key];
    if (lastBuy !== undefined && d - lastBuy < n.every) continue;
    const holdings = Object.values(S.npcOwners).filter((k) => k === key).length;
    if (holdings >= NPC_MAX_PROPS) continue;
    S.npcLast[key] = d;

    // les rivaux IA restent des figures LOCALES : ils n'achètent que dans
    // le village d'origine, pas dans les zones découvertes ailleurs
    let free = PLACES.filter((p) => BAKED_IDS.has(p.id) && !S.owned[p.id] && !npcOf(p.id) && !rivalPlayerOf(p.id));
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
// règle d'or : TOUT ce qui pop est touchable — le rayon d'interaction
// couvre la distance maximale d'apparition (~180 m, Client Mystère compris).
// C'est la marche qui fait apparaître, pas la marche qui autorise le tap.
const SPAWN_RADIUS_M = 180;

// ---------------------------------------------------------------------------
// Les Parchemins Notariaux : réunir les fragments d'un acte = posséder le lieu
// (même s'il appartient à quelqu'un — l'OPA hostile par collection)
// ---------------------------------------------------------------------------
const fragsNeeded = (p) => Math.min(12, 3 + Math.floor(p.price / 20000));

function acquireByFrags(p) {
  const victim = npcOf(p.id);
  const rp = rivalPlayerOf(p.id); // capturé AVANT de devenir propriétaire
  delete S.frags[p.id];
  delete S.npcOwners[p.id];
  delete S.discounts[p.id];
  S.owned[p.id] = { level: 0, lastCollect: S.gameMs, inspectedUntil: S.gameMs + inspectHours() * HOUR };
  burst(p, 14);
  sfx("mono");
  addXp(60);
  questBump("invest");
  if (rp) {
    headline(`<b>OPA RÉUSSIE.</b> Les parchemins réunis font de vous le propriétaire légal de ${p.name} — ${esc(rp.owner_pseudo)} l'apprend par huissier.`);
    journal(`Expropriation dans les règles de l'art : l'acte de <b>${p.name}</b> reconstitué parchemin par parchemin — <b>${esc(rp.owner_pseudo)}</b>, magnat bien réel, dépossédé. « C'est du vol légal. » Exactement.`);
  } else if (victim) {
    const n = NPCS[victim];
    headline(`<b>ACTE RECONSTITUÉ.</b> Les parchemins réunis font de vous le propriétaire légal de ${p.name} — ${n.name} l'apprend par huissier.`);
    journal(`Coup de maître : l'acte notarial de <b>${p.name}</b> reconstitué parchemin par parchemin — ${n.name} exproprié dans les règles de l'art. « C'est du vol légal », fulmine-t-il. Exactement.`);
    S.npcLast[victim] = gameDay() - NPCS[victim].every; // il riposte
  } else {
    headline(`<b>ACTE RECONSTITUÉ.</b> Les parchemins réunis font de vous le propriétaire légal de ${p.name} — sans débourser un franc.`);
    journal(`L'acte notarial de <b>${p.name}</b> reconstitué parchemin par parchemin : propriété acquise sans débourser un franc.`);
  }
  checkMonopolies(p.cat, p);
  pushProperty(p.id, "parchemins");
  pushSignal(CAT_TICKER[p.cat], 0.003, "opa");
  refreshAllMarkers(); updateHUD(); save();
}

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
    // ~30 % des apparitions sont des parchemins notariaux.
    // Ciblage : 65 % lieux proches, 25 % n'importe où au village,
    // 10 % un JOYAU (les lieux les plus chers, même très loin —
    // tout le monde peut avoir sa part de Tour Eiffel)
    let fragFor = null;
    if (Math.random() < 0.30) {
      const candidates = PLACES.filter((pl) => !S.owned[pl.id]);
      if (candidates.length) {
        // LA PERSÉVÉRANCE D'ABORD : 60 % des parchemins font avancer une
        // collection DÉJÀ commencée — sinon, avec des centaines de lieux
        // répertoriés, chaque parchemin ouvrirait un acte différent et
        // aucune collection n'aboutirait jamais
        const open = Object.keys(S.frags).filter((id) =>
          byId[id] && !S.owned[id] && S.frags[id] > 0 && S.frags[id] < fragsNeeded(byId[id]));
        let pool = null;
        if (open.length && Math.random() < 0.60) {
          pool = open.map((id) => byId[id]);
        } else {
          const roll = Math.random();
          if (roll < 0.10) {
            const sorted = candidates.slice().sort((a, b) => b.price - a.price);
            pool = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.25)));
          } else if (roll < 0.75) {
            const close = candidates.filter((pl) => dist(player.lat, player.lon, pl.lat, pl.lon) < 350);
            pool = close.length ? close : candidates;
          } else {
            pool = candidates;
          }
        }
        type = "parchemin";
        fragFor = pool[Math.floor(Math.random() * pool.length)].id;
      }
    }
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
      type, placeId, fragFor,
      lat: baseLat + (r / 111320) * Math.sin(ang),
      lon: baseLon + (r / (111320 * Math.cos((baseLat * Math.PI) / 180))) * Math.cos(ang),
      exp: Date.now() + (120 + Math.random() * 120) * 1000,
    });
  }
  updateSpawnSource();
  toast("✨");
}

function spawnAlgorithm(now) {
  const before = S.spawns.length;
  S.spawns = S.spawns.filter((s) => (s.exp || 0) > now);
  if (S.spawns.length !== before) updateSpawnSource();
  if (!player || now - lastSpawnRoll < 12_000) return;
  lastSpawnRoll = now;
  // densité dynamique : ~3-4 rencontres possibles PAR commerce alentour —
  // une rue commerçante peut grouiller (jusqu'à 15), la garrigue reste calme
  const nearby = PLACES.filter((p) => dist(player.lat, player.lon, p.lat, p.lon) < 130).length;
  const cap = Math.min(15, 4 + nearby + (S.level >= 20 ? 2 : 0)); // 4 → 15, +2 dès le nv 20
  if (S.spawns.length >= cap) return;
  const moved = lastRollPos ? dist(player.lat, player.lon, lastRollPos.lat, lastRollPos.lon) : 0;
  lastRollPos = { lat: player.lat, lon: player.lon };
  // c'est la MARCHE qui fait apparaître : presque rien à l'arrêt
  let p = 0.12 + (moved > 40 ? 0.65 : 0) + Math.min(0.25, nearby * 0.03);
  if (now - lastSpawnAt > 3 * 60_000) p = 1;    // pity : jamais bredouille > 3 min
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

// choc boursier (tuyaux de l'Informateur) : désormais un SIGNAL NATIONAL —
// il part dans stock_signals et infléchit la cote de toute la France.
// Badge 🕵️ visible 30 min sur la carte de la valeur.
function applyShock(sym, pct) {
  pushSignal(sym, pct, "tuyau");
  S.stocks[sym].shock = { pct, at: Date.now() };
}

function openEncounter(id) {
  const s = S.spawns.find((x) => x.id === id);
  if (!s || !player) return;
  const d = dist(player.lat, player.lon, s.lat, s.lon);
  if (d > SPAWN_RADIUS_M) {
    notice(`Trop loin — approchez-vous à ${SPAWN_RADIUS_M} m (${Math.round(d)} m)`);
    return;
  }
  startMinigame(s); // parchemins compris : l'acte se NÉGOCIE, il ne se ramasse pas
}

// applique l'issue de la rencontre et RENVOIE les lignes de résultat
function resolveEncounter(s, success) {
  S.spawns = S.spawns.filter((x) => x.id !== s.id);
  updateSpawnSource();
  burst(s, success ? 10 : 4);
  const syms = Object.keys(TICKERS);
  const sym = syms[Math.floor(Math.random() * syms.length)];
  const t = TICKERS[sym];
  const lines = [];

  if (s.type === "valise") {
    if (success) {
      const gain = Math.round((100 + Math.random() * 150) / 10) * 10;
      S.cash += gain;
      sfx("buy");
      lines.push({ ic: "💰", txt: `Le magot est à vous : +${fmt(gain)}`, cls: "up" });
      if (Math.random() < 0.35) {
        const it = Math.random() < 0.5 ? "cafe" : "croissant";
        S.items[it] = (S.items[it] || 0) + 1;
        lines.push({ ic: it === "cafe" ? "☕" : "🥐", txt: `Objet trouvé : ${it === "cafe" ? "Café serré" : "Croissant"}`, cls: "up" });
      }
    } else {
      const perte = Math.min(S.cash, Math.round((50 + Math.random() * 50) / 10) * 10);
      S.cash -= perte;
      lines.push({ ic: "😬", txt: `Le propriétaire revient furieux — dédommagement : −${fmt(perte)}`, cls: "down" });
    }
  } else if (s.type === "client") {
    const p = s.placeId && byId[s.placeId];
    if (!success) {
      if (p && S.owned[p.id]) {
        S.owned[p.id].malusUntil = S.gameMs + 6 * HOUR;
        lines.push({ ic: "💔", txt: `Avis assassin : loyer de ${p.name} ×0,5 pendant 6 h`, cls: "down" });
        journal(`Le Client Mystère étrille <b>${p.name}</b> : « service glacial, addition brûlante ».`);
      } else {
        lines.push({ ic: "🧐", txt: "Il tourne les talons. Rien perdu, rien gagné.", cls: "" });
      }
    } else if (p && S.owned[p.id]) {
      S.owned[p.id].boostUntil = S.gameMs + 6 * HOUR;
      sfx("quest");
      lines.push({ ic: "🌟", txt: `Avis 5 étoiles : loyer de ${p.name} ×3 pendant 6 h`, cls: "up" });
      journal(`Le Client Mystère encense <b>${p.name}</b>. La file déborde.`);
    } else if (p) {
      S.discounts[p.id] = Math.min(maxDiscount(), (S.discounts[p.id] || 0) + 0.10);
      sfx("quest");
      lines.push({ ic: "🔖", txt: `Il vous glisse le dossier : −${Math.round(S.discounts[p.id] * 100)} % sur ${p.name}`, cls: "up" });
    } else {
      S.cash += 300; sfx("coin");
      lines.push({ ic: "💵", txt: "Dédommagement pour le dérangement : +300 ₣", cls: "up" });
    }
  } else if (s.type === "informateur") {
    // le tuyau pèse sur la cote NATIONALE (±0,3–0,8 %, plafonné §7.3) —
    // il faut un compte pour peser sur le marché de toute la France
    if (success) {
      if (me) {
        const pct = 0.003 + Math.random() * 0.005;
        applyShock(sym, pct);
        sfx("mono");
        lines.push({ ic: "📈", txt: `Tuyau en or : ${t.name} +${(pct * 100).toFixed(1).replace(".", ",")} % — pour toute la France`, cls: "up" });
        if (!marketOpen()) lines.push({ ic: "🌙", txt: "Marché fermé : la rumeur pèsera à la prochaine ouverture", cls: "" });
        headline(`<b>TUYAU EN OR.</b> Votre rumeur pousse ${t.name} sur la cote nationale.`);
        journal(`Votre Informateur avait raison : <b>${t.name}</b> poussé de +${(pct * 100).toFixed(1).replace(".", ",")} % sur le marché national.`);
      } else {
        S.cash += 250;
        sfx("coin");
        lines.push({ ic: "💵", txt: "Tuyau revendu sous le manteau : +250 ₣", cls: "up" });
        lines.push({ ic: "🌍", txt: "Avec un compte (EMPIRE), vos tuyaux pèseraient sur la cote nationale", cls: "" });
      }
    } else {
      const frais = Math.min(S.cash, 200);
      S.cash -= frais;
      lines.push({ ic: "🕳️", txt: `Tuyau percé : −${fmt(frais)}`, cls: "down" });
      if (me) {
        const pct = 0.002 + Math.random() * 0.002;
        applyShock(sym, -pct);
        lines.push({ ic: "📉", txt: `La rumeur sort quand même : ${t.name} −${(pct * 100).toFixed(1).replace(".", ",")} %`, cls: "down" });
        journal(`Le tuyau de l'Informateur était percé : <b>${t.name}</b> égratigné sur le marché national.`);
      }
    }
  } else if (s.type === "inspecteur") {
    if (success) {
      S.cash += 150; sfx("quest");
      lines.push({ ic: "😮‍💨", txt: "Contrôle esquivé avec panache : +150 ₣", cls: "up" });
    } else {
      const amende = Math.max(50, Math.min(Math.round(S.cash * 0.02), 800));
      S.cash -= amende;
      lines.push({ ic: "🧾", txt: `Redressement express : −${fmt(amende)}`, cls: "down" });
      journal(`L'Inspecteur des Impôts vous a coincé : amende de ${fmt(amende)}.`);
    }
  } else if (s.type === "parchemin") {
    const p = byId[s.fragFor];
    if (!p) {
      lines.push({ ic: "📜", txt: "L'acte est illisible. Le greffier s'excuse platement.", cls: "" });
    } else if (!success) {
      lines.push({ ic: "💨", txt: `Le greffier remballe le parchemin de ${p.name}. « Repassez avec de meilleures manières. »`, cls: "down" });
    } else if (S.owned[p.id]) {
      S.cash += 250;
      sfx("coin");
      lines.push({ ic: "📜", txt: `Doublon d'archives — ${p.name} est déjà à vous : +250 ₣`, cls: "up" });
    } else {
      S.frags[p.id] = (S.frags[p.id] || 0) + 1;
      const need = fragsNeeded(p);
      sfx("coin");
      lines.push({ ic: "📜", txt: `Fragment obtenu : ${p.name} — ${S.frags[p.id]}/${need}`, cls: "up" });
      tip("frag", "Réunissez TOUS les parchemins d'un lieu pour en devenir propriétaire par acte reconstitué — même s'il appartient déjà à quelqu'un.");
      if (S.frags[p.id] >= need) {
        acquireByFrags(p);
        lines.push({ ic: "👑", txt: `ACTE RECONSTITUÉ — ${p.name} est à vous !`, cls: "up" });
      }
      if (sheetPlace === p) openSheet(p, true);
    }
  }
  updateHUD(); save();
  return lines;
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
  if (S.dealDay === d || S.deals.length >= dealSlots()) return;
  S.dealDay = d;
  const r = Math.random();
  const tier = r < 0.05 ? 2 : r < 0.30 ? 1 : 0;
  S.deals.push({ id: "dl" + (++S.spawnSeq), tier, km: DEAL_TIERS[tier].km, done: 0 });
  journal(`AFFAIRES — un dossier arrive sur votre bureau : « <b>${DEAL_TIERS[tier].name}</b> », ${DEAL_TIERS[tier].km} km à pied pour le boucler. Il vous attend dans l'Empire, section Tournée.`);
  tip("deal", "Les Affaires se bouclent en MARCHANT : vos kilomètres font avancer les dossiers (suivi GPS, app ouverte). Récompense à l'arrivée !");
  save();
}

function hatchDeal(deal) {
  S.deals = S.deals.filter((x) => x !== deal);
  const syms = Object.keys(TICKERS);
  const sym = syms[Math.floor(Math.random() * syms.length)];
  sfx("mono");
  addXp([50, 100, 200][deal.tier]);
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
  const kms = Math.floor(Math.min(S.walk.todayKm, kmCap()));
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
// La Négociation : 3 manches, 2 accords pour conclure, objets, écran de résultat
// ---------------------------------------------------------------------------
const MG_XP_WIN = { valise: 30, client: 40, inspecteur: 50, informateur: 80, parchemin: 25 };
let mg = null;

function startMinigame(s) {
  const T = ENCOUNTER_TYPES[s.type];
  mg = { s, hist: [], pos: 0, zc: 0.5, zw: T.zone, speed: T.speed, itemUsed: false, raf: null, locked: false };
  const img = $("#mg-img"), fb = $("#mg-emoji");
  img.style.display = ""; fb.style.display = "none";
  img.onerror = () => { img.style.display = "none"; fb.style.display = ""; };
  img.src = s.type === "parchemin" ? "assets/ui/parchemin.png" : `assets/char-${s.type}.png`;
  fb.textContent = T.emoji;
  $("#mg-title").textContent = T.name;
  $("#mg-desc").textContent = s.type === "parchemin" && byId[s.fragFor]
    ? `Un fragment de l'acte de « ${byId[s.fragFor].name} ». ${T.desc}`
    : T.desc;
  const stars = { valise: 1, client: 2, inspecteur: 2, informateur: 3, parchemin: 1 }[s.type];
  $("#mg-stars").innerHTML = "★".repeat(stars) + '<span class="dim">' + "★".repeat(3 - stars) + "</span>";
  $("#mg-game").hidden = false;
  $("#mg-result").hidden = true;
  $("#mg").hidden = false;
  startRound();
}

function mgRoundDots() {
  $("#mg-rounds").innerHTML = Array.from({ length: 3 }, (_, i) => {
    if (mg.hist[i] === true) return '<span class="rd ok">🤝</span>';
    if (mg.hist[i] === false) return '<span class="rd ko">✕</span>';
    return '<span class="rd">·</span>';
  }).join("");
}

function mgUpdateItems() {
  const c = $("#mg-n-cafe"), k = $("#mg-n-croissant");
  c.textContent = "×" + (S.items.cafe || 0);
  k.textContent = "×" + (S.items.croissant || 0);
  $("#mg-item-cafe").disabled = mg.itemUsed || !(S.items.cafe > 0);
  $("#mg-item-croissant").disabled = mg.itemUsed || !(S.items.croissant > 0);
}

function startRound() {
  mg.locked = false;
  mg.itemUsed = false;
  const round = mg.hist.length;
  // la pression monte : chaque manche est un peu plus vive
  mg.speedRound = mg.speed * (1 + round * 0.18);
  mg.zwRound = mg.zw * (1 - round * 0.12);
  mg.zc = 0.28 + Math.random() * 0.44;
  mgRoundDots();
  mgUpdateItems();
  mgApplyZone();
  cancelAnimationFrame(mg.raf);
  const t0 = performance.now();
  const loop = (tn) => {
    if (!mg) return;
    mg.pos = (Math.sin(((tn - t0) / 1000) * mg.speedRound) + 1) / 2;
    $("#mg-cursor").style.left = mg.pos * 100 + "%";
    mg.raf = requestAnimationFrame(loop);
  };
  mg.raf = requestAnimationFrame(loop);
}

function mgApplyZone() {
  const z = $("#mg-zone");
  z.style.left = (mg.zc - mg.zwRound / 2) * 100 + "%";
  z.style.width = mg.zwRound * 100 + "%";
}

function mgUseItem(kind) {
  if (!mg || mg.locked || mg.itemUsed || !(S.items[kind] > 0)) return;
  S.items[kind] -= 1;
  mg.itemUsed = true;
  if (kind === "cafe") mg.speedRound *= 0.6;          // le café ralentit la jauge
  if (kind === "croissant") { mg.zwRound = Math.min(0.5, mg.zwRound * 1.6); mgApplyZone(); } // le croissant amadoue
  sfx("coin");
  mgUpdateItems();
  save();
  // relance la boucle à la nouvelle vitesse
  if (kind === "cafe") {
    cancelAnimationFrame(mg.raf);
    const t0 = performance.now() - (Math.asin(mg.pos * 2 - 1) / mg.speedRound) * 1000;
    const loop = (tn) => {
      if (!mg) return;
      mg.pos = (Math.sin(((tn - t0) / 1000) * mg.speedRound) + 1) / 2;
      $("#mg-cursor").style.left = mg.pos * 100 + "%";
      mg.raf = requestAnimationFrame(loop);
    };
    mg.raf = requestAnimationFrame(loop);
  }
}

function mgAttempt() {
  if (!mg || mg.locked) return;
  mg.locked = true;
  cancelAnimationFrame(mg.raf);
  const success = Math.abs(mg.pos - mg.zc) <= mg.zwRound / 2;
  mg.hist.push(success);
  mgRoundDots();
  const card = $("#mg-card");
  card.classList.add(success ? "mg-hit" : "mg-miss");
  sfx(success ? "coin" : "quest");
  setTimeout(() => {
    card.classList.remove("mg-hit", "mg-miss");
    const wins = mg.hist.filter(Boolean).length;
    const fails = mg.hist.length - wins;
    if (wins >= 2) mgFinish(true);
    else if (fails >= 2) mgFinish(false);
    else startRound();
  }, 650);
}

function mgFinish(success) {
  cancelAnimationFrame(mg.raf);
  const s = mg.s;
  const lines = resolveEncounter(s, success);
  const xpGain = success ? MG_XP_WIN[s.type] : 12;
  const lvlBefore = S.level;
  addXp(xpGain);
  const leveled = S.level > lvlBefore;

  $("#mg-game").hidden = true;
  const v = $("#mg-verdict");
  v.textContent = success ? "ACCORD CONCLU" : "NÉGOCIATION ROMPUE";
  v.className = success ? "up" : "down";
  $("#mg-lines").innerHTML = lines.map((l) =>
    `<div class="mg-line ${l.cls}"><span>${l.ic}</span>${l.txt}</div>`).join("") +
    (leveled ? `<div class="mg-line up"><span>🎉</span>NIVEAU ${S.level} ! Récompenses : +${fmt(levelCash(S.level))} et provisions</div>` : "");
  $("#mg-xp-gain").textContent = `+${xpGain} XP`;
  $("#mg-xp-level").textContent = `Nv ${S.level}`;
  const fill = $("#mg-xp-fill");
  fill.style.width = "0%";
  setTimeout(() => { fill.style.width = Math.min(100, (S.xp / xpNeeded(S.level)) * 100) + "%"; }, 80);
  $("#mg-result").hidden = false;
  mg = null;
}

function mgClose(fled) {
  if (mg) cancelAnimationFrame(mg.raf);
  $("#mg").hidden = true;
  mg = null; // en fuyant, la rencontre reste sur la carte
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
    for (const id in S.owned) if (byId[id]) charges += placeValue(byId[id]) * ECO.chargesDay;
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

function updateHUD() {
  // HUD épuré (demande Mika) : les liquidités en abrégé + le niveau, rien d'autre
  $("#cash").textContent = fmtShort(S.cash);
  $("#lvl").textContent = S.level;

  checkTitle();
  ensureQuests();

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
    } else if (Object.keys(S.frags).some((id) => byId[id] && fragsNeeded(byId[id]) - S.frags[id] === 1)) {
      const id = Object.keys(S.frags).find((x) => byId[x] && fragsNeeded(byId[x]) - S.frags[x] === 1);
      txt = `📜 Plus qu'UN parchemin pour posséder ${byId[id].name} !`;
      coachAction = () => openSheet(byId[id]);
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

// Les toasts d'ambiance sont supprimés : le jeu parle par la carte, le
// journal et les gros titres. toast() est un no-op conservé pour compat.
function toast() {}

// notice() : uniquement les messages FONCTIONNELS (trop loin, GPS…)
let noticeCount = 0;
function notice(text) {
  if (noticeCount > 2) return;
  noticeCount++;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  $("#toasts").appendChild(el);
  setTimeout(() => { el.remove(); noticeCount--; }, 2600);
}

let headlineTimer = null;
function headline(html) {
  $("#headline-text").innerHTML = html;
  $("#headline").hidden = false;
  clearTimeout(headlineTimer);
  headlineTimer = setTimeout(() => ($("#headline").hidden = true), 7000);
}

function flyCoin(p, label, icon = "🪙") {
  if (!map) return;
  const px = map.project([p.lon, p.lat]);
  const el = document.createElement("div");
  el.className = "fly-coin";
  el.textContent = icon + " " + label;
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
          ${inspected ? "👔 Tournée déjà faite — revenez demain" : `👔 Tournée du proprio (loyer ×${isWeekend() ? 3 : 2}, ${inspectHours()} h)`}</button>` : ""}
        ${nextCost != null ? `
        <button class="btn gold" id="a-upgrade" ${S.cash >= nextCost ? "" : "disabled"}>
          🏗️ ${ECO.upNames[o.level]} · loyer ×${ECO.upMult[o.level]} — ${fmt(nextCost)}</button>` : ""}
      </div>`;
    $("#a-collect")?.addEventListener("click", () => collect(p));
    $("#a-inspect")?.addEventListener("click", () => inspect(p));
    $("#a-upgrade")?.addEventListener("click", () => upgrade(p));
    if (!near) body.insertAdjacentHTML("beforeend",
      '<div class="hint">👔 La tournée : passez voir votre bien sur place et son loyer double pendant 24 h. C\'est votre raison de sortir marcher.</div>');
    // revente : 70 % de la valeur, avec confirmation en deux temps
    body.insertAdjacentHTML("beforeend",
      `<div class="btn-row"><button class="btn ghost sell-ghost" id="a-sell">💸 Revendre — ${fmt(placeValue(p) * 0.7)}</button></div>`);
    const sellBtn = $("#a-sell");
    let armed = false;
    sellBtn.addEventListener("click", () => {
      if (!armed) {
        armed = true;
        sellBtn.textContent = "⚠️ Confirmer la vente ?";
        sellBtn.classList.add("armed");
        setTimeout(() => {
          if (!sellBtn.isConnected) return;
          armed = false;
          sellBtn.textContent = `💸 Revendre — ${fmt(placeValue(p) * 0.7)}`;
          sellBtn.classList.remove("armed");
        }, 3000);
      } else {
        sellPlace(p);
      }
    });
  } else if (rivalPlayerOf(p.id)) {
    // propriété d'un VRAI joueur : pas de rachat — seule l'OPA par parchemins
    const rp = rivalPlayerOf(p.id);
    const got = S.frags[p.id] || 0, need = fragsNeeded(p);
    body.innerHTML = `
      <div class="sheet-row">
        <div class="stat">🔒 Propriété de <b>${esc(rp.owner_pseudo)}</b>${rp.level ? ` · 🏗️ ${ECO.upNames[rp.level - 1]}` : ""}</div>
        <div class="stat">📜 Parchemins <b>${got}/${need}</b></div>
      </div>
      <div class="deal-card">
        <div class="deal-head">📜 <b>Acte en reconstitution</b><span class="deal-km">${got}/${need}</span></div>
        <div class="deal-bar"><div class="deal-fill" style="width:${(got / need) * 100}%"></div></div>
      </div>
      <div class="hint">Ce lieu appartient à un autre magnat — il ne se rachète pas. Réunissez ses ${need} parchemins notariaux en arpentant le quartier et il change de mains. C'est du vol légal.</div>`;
  } else {
    const cost = priceToPay(p);
    const npcOwned = npcOf(p.id);
    const afford = S.cash >= cost;
    body.innerHTML = `
      <div class="sheet-row">
        <div class="stat">Prix <b>${fmt(cost)}</b>${npcOwned ? " (rachat ×1,5)" : ""}</div>
        <div class="stat">Rapportera <b>${fmt(p.price * ECO.rentDay)}</b>/jour</div>
        ${S.discounts[p.id] ? `<div class="stat">🔍 Dossier <b>−${Math.round(S.discounts[p.id] * 100)} %</b></div>` : ""}
        <div class="stat">📜 Parchemins <b>${S.frags[p.id] || 0}/${fragsNeeded(p)}</b></div>
        ${npcOwned ? `<div class="stat">🏗️ <b>${npcName(p.id)}</b></div>` : ""}
      </div>
      <div class="btn-row">
        ${near ? `<button class="btn ghost" id="a-scout" ${S.scouted[p.id] === gameDay() ? "disabled" : ""}>
             ${S.scouted[p.id] === gameDay() ? "🔍 Repéré aujourd'hui" : "🔍 Repérage (−5 % au prix)"}</button>` : ""}
        <button class="btn" id="a-buy" ${near && afford ? "" : "disabled"}>
          ${npcOwned ? "😤 Racheter" : "📜 Acheter"} — ${fmt(cost)}</button>
      </div>
      ${near && !afford ? `<div class="hint">Il vous manque ${fmt(cost - S.cash)}. Les loyers tombent, patience.</div>` : ""}
      ${!near ? `<div class="hint">🚶 Approchez-vous à ${playerRadius()} m pour repérer et acheter — MAGNAT se joue sur le trottoir.</div>` : ""}`;
    $("#a-buy")?.addEventListener("click", () => buy(p));
    $("#a-scout")?.addEventListener("click", () => scout(p));
  }
  if (!silent) map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 16), speed: 1.4 });
  $("#coach").hidden = true;
}

$("#sheet-close").addEventListener("click", () => {
  $("#sheet").hidden = true;
  sheetPlace = null;
  updateCoach();
  // la fiche a pu emmener la caméra ailleurs : retour au personnage
  if (player) map.easeTo({ center: [player.lon, player.lat], duration: 600 });
});

$("#mg-btn").addEventListener("click", mgAttempt);
$("#mg-flee").addEventListener("click", () => mgClose(true));
$("#mg-close").addEventListener("click", () => mgClose(false));
$("#mg-item-cafe").addEventListener("click", () => mgUseItem("cafe"));
$("#mg-item-croissant").addEventListener("click", () => mgUseItem("croissant"));

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
            <button class="btn sell mini" data-trade="-max" data-tsym="${sym}">Vendre tout</button>
            <button class="btn sell mini" data-trade="-10" data-tsym="${sym}">Vendre 10</button>
            <button class="btn mini" data-trade="10" data-tsym="${sym}">Acheter 10</button>
            <button class="btn mini" data-trade="max" data-tsym="${sym}">Acheter max</button>
          </div>
        </div>`;
      }).join("")}
      <div class="stock-card" style="opacity:.72">
        <div class="sc-top">
          <div class="sc-emoji" style="font-size:26px">🔔</div>
          <div class="sc-name">
            <b>VOTRE IPO — la Bourse des Magnats</b>
            <span class="sc-pos">Introduisez votre propre empire en bourse</span>
          </div>
          <div class="sc-right"><div class="sc-price">🔒 10 M₣</div></div>
        </div>
        <div class="panel-hint" style="margin:6px 0 2px">À 10 000 000 ₣ de patrimoine : vendez 10 à 25 % de votre empire,
        encaissez le capital, versez des dividendes à vos actionnaires — et apprenez à vivre avec leur impatience.
        D'abord : les rivaux cotés (BÉTONNEUR SA, VIEILARGENT & ASSOCIÉS…), bientôt.</div>
      </div>
      <div class="proto-note">Cote NATIONALE en temps réel — les mêmes cours pour tous les joueurs de France,
      poussés par l'activité réelle : achats de commerces, ordres en bourse, tuyaux d'Informateur.<br>
      Prototype : bourse déverrouillée d'office (en prod : après le premier monopole).</div>`;

    c.querySelectorAll("[data-trade]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        trade(b.dataset.tsym, tradeQty(b.dataset.tsym, b.dataset.trade));
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
    const ids = Object.keys(S.owned).filter((id) => byId[id]);
    const rentTotal = ids.reduce((a, id) => a + rentPerDay(byId[id]), 0);
    const propTotal = ids.reduce((a, id) => a + placeValue(byId[id]), 0);
    const pending = ids.reduce((a, id) => a + accrued(byId[id]), 0);
    const monoT = monopolyTarget();
    ensureQuests();
    const xpPct = Math.min(100, (S.xp / xpNeeded(S.level)) * 100);
    const openColl = Object.keys(S.frags).filter((id) => byId[id] && !S.owned[id]).length;
    c.innerHTML = `
      <div class="emp-hero">
        <img class="emp-avatar" src="assets/avatars/${S.avatar}.png" alt="">
        <div class="emp-id">
          <div class="emp-name">${me ? esc(myPseudo()) : "Magnat anonyme"}</div>
          <div class="emp-title"><span class="title-chip">${TITLES[S.titleIdx][0]}</span> · Jour ${gameDay() + 1}${S.streak > 1 ? ` · 🔥 ${S.streak} j` : ""}</div>
          <div class="emp-xp">
            <span class="emp-lvl">⭐ ${S.level}</span>
            <div class="xp-bar big"><div style="width:${xpPct}%"></div></div>
            <span class="emp-lvl dim">${S.level < LEVEL_CAP ? S.level + 1 : "MAX"}</span>
          </div>
          <div class="emp-xp-sub">${Math.round(S.xp)}/${xpNeeded(S.level)} XP${S.level < LEVEL_CAP ? ` · niv. ${S.level + 1} : +${fmtShort(levelCash(S.level + 1))}${PERKS[S.level + 1] ? ` · <b>${PERKS[S.level + 1]}</b>` : ""}` : " · 👑 Légende"}</div>
        </div>
      </div>

      ${pending >= 1 ? `<button class="btn gold" id="a-collect-all" style="width:100%;margin:0 0 14px">🪙 Tout encaisser — ${fmt(pending)}</button>` : ""}

      <div class="stat-tiles">
        <div class="stile"><span class="stile-ic">💵</span><b>${fmtShort(S.cash)}</b><span class="stile-lbl">Liquidités</span></div>
        <div class="stile"><span class="stile-ic">🏠</span><b>${fmtShort(propTotal)}</b><span class="stile-lbl">Immobilier</span></div>
        <div class="stile"><span class="stile-ic">📈</span><b>${fmtShort(stockValue())}</b><span class="stile-lbl">Actions</span></div>
        <div class="stile gold"><span class="stile-ic">🪙</span><b>+${fmtShort(rentTotal)}</b><span class="stile-lbl">Loyers / jour</span></div>
      </div>

      <div class="menu-grid">
        <button class="menu-card" id="a-perso"><span class="mc-ic">🕴️</span>Personnage</button>
        <button class="menu-card" id="a-collections"><span class="mc-ic">📜</span>Collections${openColl ? `<span class="mc-badge">${openColl}</span>` : ""}</button>
        <button class="menu-card" id="a-help"><span class="mc-ic">❓</span>Aide</button>
      </div>

      ${monoT ? `<button class="mono-line" id="a-mono">👑&nbsp;<b>Monopole des ${CAT_META[monoT.cat].plural}</b>&nbsp;— ${monoT.mine}/${monoT.total} · ~${fmtShort(monoT.cost)}<span class="chev">›</span></button>` : ""}

      <div class="cust-label" style="margin:16px 0 8px">🎯 DÉFIS DU JOUR</div>
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

      <div class="cust-label" style="margin:16px 0 8px">🚶 LA TOURNÉE — ${S.walk.total.toFixed(1)} KM PARCOURUS</div>
      <div class="walk-line">Indemnités du jour : <b>${Math.min(S.walk.todayKm, kmCap()).toFixed(1)}/${kmCap()} km</b> · ☕ ×${S.items.cafe || 0} · 🥐 ×${S.items.croissant || 0}</div>
      ${S.deals.length ? S.deals.map((dl) => {
        const T = DEAL_TIERS[dl.tier] || DEAL_TIERS[0];
        const km = dl.km || T.km;
        const pct = Math.min(100, (dl.done / km) * 100);
        return `<div class="deal-card">
          <div class="deal-head">🗂️ <b>${T.name}</b>
            <span class="deal-km">${Math.min(dl.done, km).toFixed(1)} / ${km} km</span>
          </div>
          <div class="deal-bar"><div class="deal-fill" style="width:${pct}%"></div></div>
        </div>`;
      }).join("") : `<div class="walk-line">Aucun dossier en cours (0/${dealSlots()}) — le prochain arrive ${S.dealDay === gameDay() ? "demain" : "d'ici peu"}.</div>`}

      <div class="cust-label" style="margin:16px 0 8px">🏠 VOS PROPRIÉTÉS${ids.length ? ` (${ids.length}${S.monopolies.length ? ` · ${S.monopolies.length} monopole${S.monopolies.length > 1 ? "s" : ""}` : ""})` : ""}</div>` +
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
        : `<div class="locked"><div class="big">🏚️</div><p>Vous ne possédez rien. C'est réparable.</p></div>`) +
      `<div class="cust-label" style="margin:16px 0 8px">🌍 LE MONDE — CLASSEMENT DES MAGNATS</div>
      ${me ? `
        ${leaderboard.length ? `<div class="lb">${leaderboard.map((r, i) => `
          <div class="lb-row ${me && r.id === me.id ? "me" : ""}">
            <span class="lb-rank">${["🥇", "🥈", "🥉"][i] || i + 1}</span>
            <span class="lb-name">${esc(r.pseudo)}</span>
            <span class="lb-lvl">⭐ ${r.level}</span>
            <span class="lb-worth">${fmtShort(r.worth)}</span>
          </div>`).join("")}</div>` : `<div class="walk-line">Le classement se remplit dès que les magnats prospèrent…</div>`}
      ` : `
        <div class="walk-line">Un compte, et le monde vous voit : votre nom sur vos propriétés, le classement national — et l'expropriation par parchemins des vrais joueurs.</div>
        <div class="btn-row" style="margin-bottom:12px">
          <button class="btn" id="a-world">🌍 Rejoindre le monde commun</button>
        </div>
      `}`;
    $("#a-help")?.addEventListener("click", () => openPanel("aide"));
    $("#a-perso")?.addEventListener("click", () => openPanel("perso"));
    $("#a-world")?.addEventListener("click", () => { closePanel(); $("#login").hidden = false; });
    $("#a-mono")?.addEventListener("click", () => {
      const t = monopolyTarget();
      if (!t) return;
      const next = PLACES.filter((p) => p.cat === t.cat && !S.owned[p.id] && !rivalPlayerOf(p.id))
        .sort((a, b) => priceToPay(a) - priceToPay(b))[0];
      if (next) { closePanel(); openSheet(next); }
    });
    $("#a-collections")?.addEventListener("click", () => openPanel("collections"));
    $("#a-collect-all")?.addEventListener("click", () => { collectAll(); renderPanel(); });
    c.querySelectorAll(".prop-card").forEach((row) =>
      row.addEventListener("click", () => {
        closePanel();
        openSheet(byId[row.dataset.id]);
      }));
  }

  else if (panelTab === "perso") {
    c.innerHTML = `<h2>Votre personnage</h2>
      <div class="panel-sub">Choisissez votre allure. Les tenues 🔒 s'achètent ici ou à la Boutique.</div>
      <div class="ward-grid">${Object.keys(AVATARS).map((k) => {
        const a = AVATARS[k];
        const owned = !a.price || S.wardrobe.includes(k);
        return `<button class="ward-card ${S.avatar === k ? "on" : ""} ${owned ? "" : "locked"}" data-ward="${k}">
          <img src="assets/avatars/${k}.png" alt="${a.name}">
          <b>${a.name}</b>
          ${S.avatar === k ? '<span class="ward-tag">✓ Porté</span>'
            : owned ? '<span class="ward-tag ghost">Choisir</span>'
            : `<span class="ward-tag gold">🔒 ${fmt(a.price)}</span>`}
        </button>`;
      }).join("")}</div>`;
    c.querySelectorAll("[data-ward]").forEach((b) =>
      b.addEventListener("click", () => {
        const k = b.dataset.ward, a = AVATARS[k];
        if (a.price && !S.wardrobe.includes(k)) {
          if (S.cash >= a.price) buyAvatar(k);
          else notice(`Il vous manque ${fmt(a.price - S.cash)} pour « ${a.name} »`);
        } else {
          setAvatar(k);
        }
        renderPanel();
      }));
  }

  else if (panelTab === "boutique") {
    c.innerHTML = `<h2>La Boutique</h2>
      <div class="panel-sub">Tout s'achète — c'est un peu le concept. 💵 <b>${fmt(S.cash)}</b> disponibles.</div>
      <div class="cust-label" style="margin-bottom:8px">CONSOMMABLES DE NÉGOCIATION</div>
      <button class="shop-card" data-shop="cafe">
        <span class="shop-ic">☕</span>
        <span class="shop-info"><b>Café serré</b><span class="shop-desc">Ralentit la jauge d'une manche · vous en avez ×${S.items.cafe || 0}</span></span>
        <span class="shop-price">150 ₣</span>
      </button>
      <button class="shop-card" data-shop="croissant">
        <span class="shop-ic">🥐</span>
        <span class="shop-info"><b>Croissant</b><span class="shop-desc">Élargit la zone d'accord · vous en avez ×${S.items.croissant || 0}</span></span>
        <span class="shop-price">150 ₣</span>
      </button>
      <button class="shop-card" data-shop="pack">
        <span class="shop-ic">🧺</span>
        <span class="shop-info"><b>Panier du Négociateur</b><span class="shop-desc">4 cafés + 4 croissants — l'arsenal complet</span></span>
        <span class="shop-price">990 ₣</span>
      </button>
      <div class="cust-label" style="margin:16px 0 8px">LE VESTIAIRE PREMIUM</div>
      <div class="ward-grid">${Object.keys(AVATARS).filter((k) => AVATARS[k].price).map((k) => {
        const a = AVATARS[k];
        const owned = S.wardrobe.includes(k);
        return `<button class="ward-card ${owned ? "" : "locked"}" data-buyward="${k}">
          <img src="assets/avatars/${k}.png" alt="${a.name}">
          <b>${a.name}</b>
          ${owned ? '<span class="ward-tag">✓ Acquis</span>' : `<span class="ward-tag gold">${fmt(a.price)}</span>`}
        </button>`;
      }).join("")}</div>
      <div class="proto-note">Les ₣ ne s'achètent pas avec de vrais euros. Jamais. Règle de la maison —<br>on est des rentiers, pas des monstres.</div>`;
    c.querySelectorAll("[data-shop]").forEach((b) =>
      b.addEventListener("click", () => {
        const kind = b.dataset.shop;
        const cost = kind === "pack" ? 990 : 150;
        if (S.cash < cost) { notice(`Il vous manque ${fmt(cost - S.cash)}`); return; }
        S.cash -= cost;
        if (kind === "pack") { S.items.cafe += 4; S.items.croissant += 4; }
        else S.items[kind] += 1;
        sfx("buy");
        updateHUD(); save(); renderPanel();
      }));
    c.querySelectorAll("[data-buyward]").forEach((b) =>
      b.addEventListener("click", () => {
        const k = b.dataset.buyward;
        if (S.wardrobe.includes(k)) { openPanel("perso"); return; }
        if (S.cash < AVATARS[k].price) { notice(`Il vous manque ${fmt(AVATARS[k].price - S.cash)}`); return; }
        buyAvatar(k);
        renderPanel();
      }));
  }

  else if (panelTab === "collections") {
    const ids = Object.keys(S.frags)
      .filter((id) => byId[id] && !S.owned[id])
      .sort((a, b) => (S.frags[b] / fragsNeeded(byId[b])) - (S.frags[a] / fragsNeeded(byId[a])));
    c.innerHTML = `<h2>📜 Collections</h2>
      <div class="panel-sub">${ids.length} acte${ids.length > 1 ? "s" : ""} en cours de reconstitution ·
        ${Object.keys(S.owned).length} lieu${Object.keys(S.owned).length > 1 ? "x" : ""} possédé${Object.keys(S.owned).length > 1 ? "s" : ""} · ${PLACES.length} répertoriés</div>` +
      (ids.length
        ? ids.map((id) => {
            const p = byId[id], need = fragsNeeded(p);
            return `<div class="deal-card frag-card" data-id="${id}">
              <div class="deal-head">📜 <b>${p.name}</b>
                <span class="deal-km">${S.frags[id]}/${need}</span>
              </div>
              <div class="deal-bar"><div class="deal-fill" style="width:${(S.frags[id] / need) * 100}%"></div></div>
            </div>`;
          }).join("")
        : `<div class="locked"><div class="big">📜</div><p>Aucun acte en cours. Ramassez des parchemins scellés dans les rues — chaque fragment vous rapproche d'une propriété gratuite.</p></div>`) +
      `<div class="proto-note">Les parchemins visent surtout les lieux que vous longez — mais les joyaux du secteur circulent aussi, où que vous soyez.<br>La France entière se découvre en explorant : chaque lieu réel a le même prix pour tous les joueurs.</div>`;
    c.querySelectorAll(".frag-card").forEach((row) =>
      row.addEventListener("click", () => {
        closePanel();
        openSheet(byId[row.dataset.id]);
      }));
  }

  else if (panelTab === "aide") {
    const steps = [
      ["🏠", "Achetez les commerces autour de vous", "marchez à moins de 300 m d'un lieu pour l'acheter. Partout en France : les vrais commerces apparaissent sur la carte en explorant."],
      ["🪙", "Encaissez les loyers", "vos biens produisent en continu, mais l'accumulation se bloque après 8 h : revenez souvent."],
      ["👔", "Faites la Tournée du proprio", "passez voir un bien sur place : son loyer double pendant 24 h (×3 le week-end)."],
      ["👑", "Décrochez des Monopoles", "possédez TOUS les commerces d'une catégorie du quartier : loyers ×2 pour toujours."],
      ["🏗️", "Améliorez vos biens", "Ravalement, Gentrification, Flagship : le loyer grimpe à chaque niveau."],
      ["📈", "Spéculez à la Bourse NATIONALE", "mêmes cours pour toute la France (séance 9h–18h, heure réelle), poussés par l'activité de tous les joueurs. Dividendes à la clôture — et certains soirs, séance NOCTURNE 21h–23h. L'activité de la nuit pèse sur l'ouverture."],
      ["⚔️", "Surveillez les rivaux", "des magnats IA achètent le village — et de VRAIS joueurs possèdent leurs quartiers. Réunissez les parchemins d'un lieu pour l'exproprier."],
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
function drawSpark(cv, data, openVal) {
  if (!cv || data.length < 2) return;
  const ctx = cv.getContext("2d");
  let min = Math.min(...data), max = Math.max(...data);
  if (openVal != null) { min = Math.min(min, openVal); max = Math.max(max, openVal); }
  const range = max - min || 1;
  const W = cv.width, Hh = cv.height, pad = 6;
  const X = (i) => pad + (i / (data.length - 1)) * (W - 2 * pad);
  const Y = (v) => Hh - pad - ((v - min) / range) * (Hh - 2.4 * pad);
  ctx.clearRect(0, 0, W, Hh);
  // repère : le cours d'ouverture du jour, en pointillés
  if (openVal != null) {
    ctx.strokeStyle = night ? "rgba(255,255,255,0.18)" : "rgba(34,38,46,0.16)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(pad, Y(openVal));
    ctx.lineTo(W - pad, Y(openVal));
    ctx.stroke();
    ctx.setLineDash([]);
  }
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
  ctx.lineWidth = 2.5;
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
  // la séance nationale vit à l'heure RÉELLE
  const d0 = new Date(), hod = d0.getHours();
  const weR = d0.getDay() === 0 || d0.getDay() === 6;
  const open = marketOpen();
  const chip = c.querySelector("#bourse-chip");
  if (chip) {
    const noct = !weR && nocturneDay(Math.floor(Date.now() / DAY));
    chip.textContent = open ? (hod >= 21 ? "🌙 Nocturne — clôture 23h" : `🕐 Clôture dans ${18 - hod} h`)
      : weR ? "🕐 Week-end — fermé"
      : hod < 9 ? "🕐 Ouverture à 9h"
      : noct && hod < 21 ? "🌙 NOCTURNE ce soir — 21h à 23h"
      : "🕐 Fermé — demain 9h";
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
      const q = tradeQty(sym, b.dataset.trade);
      b.disabled = b.dataset.trade.startsWith("-") ? st.shares <= 0 : q < 1 || S.cash < q * st.price;
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
        if (!st) return;
        const data = st.hist.slice(-15).concat(st.intra.slice(-70), st.price);
        drawSpark(cv, data, st.dayOpen);
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
  tagNpc: "#C24A38", tagPlayer: "#7C3AED", tagHalo: "#FFFFFF",
};
const NIGHT_PAL = {
  bg: "#161B26", water: "#1D2734", green: "#1E2822", building: "#242C3C",
  road: "#C9BFA3", roadMinor: "#3B4254", text: "#98A0B0", halo: "#161B26",
  ring: "#5CE0A1", tagAfford: "#E9C05C", tagFar: "#6E7686",
  tagNpc: "#F07A6A", tagPlayer: "#B79CFF", tagHalo: "#12151E",
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
// Position du joueur (GPS)
// ---------------------------------------------------------------------------
let player = null;
let playerMarker = null;

function radiusGeoJSON() {
  if (!player) return { type: "FeatureCollection", features: [] };
  const pts = [], n = 48;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const dLat = (playerRadius() / 111320) * Math.sin(a);
    const dLon = (playerRadius() / (111320 * Math.cos((player.lat * Math.PI) / 180))) * Math.cos(a);
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
  // le personnage marche quelques secondes après chaque déplacement
  if (movedNow) {
    const el = playerMarker.getElement();
    el.classList.add("walking");
    clearTimeout(walkAnimTimer);
    walkAnimTimer = setTimeout(() => el.classList.remove("walking"), 2000);
  }
  try { map.getSource("radius")?.setData(radiusGeoJSON()); } catch (e) {}
  if (fly) map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 16) });
  else if (follow) map.easeTo({ center: [lon, lat], duration: 750 });
  if (sheetPlace) openSheet(sheetPlace, true);
  // zone inconnue ? le notaire répertorie les affaires du coin (OSM)
  discoverAround(lat, lon);
}

// la caméra suit le personnage ; déplacer la carte la libère, 🎯 recentre
let follow = true;
$("#btn-recenter").addEventListener("click", () => {
  follow = true;
  $("#btn-recenter").hidden = true;
  if (player) map.easeTo({ center: [player.lon, player.lat], zoom: Math.max(map.getZoom(), 16) });
});

function setAvatar(key) {
  const a = AVATARS[key];
  if (!a) return;
  if (a.price && !S.wardrobe.includes(key)) return; // pas encore acheté
  S.avatar = key;
  const img = playerMarker?.getElement()?.querySelector(".player-avatar");
  if (img) img.src = `assets/avatars/${key}.png`;
  sfx("quest");
  save();
}

function buyAvatar(key) {
  const a = AVATARS[key];
  if (!a || !a.price || S.wardrobe.includes(key) || S.cash < a.price) return;
  S.cash -= a.price;
  S.wardrobe.push(key);
  sfx("buy");
  journal(`Nouvelle allure : « <b>${a.name}</b> » rejoint votre vestiaire pour ${fmt(a.price)}.`);
  setAvatar(key);
  updateHUD(); save();
}

// GPS uniquement : le jeu se joue là où vous êtes (France entière — les
// lieux du secteur se découvrent tout seuls). Pas de téléportation.
function startGPS() {
  if (!navigator.geolocation) {
    notice("📍 Localisation indisponible sur cet appareil — MAGNAT se joue dehors.");
    return;
  }
  navigator.geolocation.watchPosition(
    (pos) => setPlayer(pos.coords.latitude, pos.coords.longitude),
    () => notice("📍 GPS indisponible — autorisez la localisation pour jouer."),
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
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
  // le parchemin notarial (image générée, sinon dessin canvas)
  await map.loadImage("assets/ui/parchemin.png")
    .then((r) => { if (!map.hasImage("sp-parchemin")) map.addImage("sp-parchemin", r.data); })
    .catch(() => { if (!map.hasImage("sp-parchemin")) map.addImage("sp-parchemin", encounterIcon("📜")); });
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
      const rp = rivalPlayerOf(p.id);
      const state = o ? "owned" : rp ? "player" : npc ? "npc" : S.cash >= priceToPay(p) ? "afford" : "far";
      let tag;
      if (o) {
        tag = hasMonopoly(p.cat) ? "MONOPOLE ×2" : o.level > 0 ? "NIV. " + o.level : "";
      } else if (rp) {
        tag = rp.owner_pseudo.toUpperCase();
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
          "npc", P.tagNpc, "owned", P.ring, "far", P.tagFar,
          "player", P.tagPlayer, P.tagAfford],
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
  try {
    if (!map.getSource("spawns")) {
      map.addSource("spawns", { type: "geojson", data: spawnsGeoJSON() });
      map.addLayer({
        id: "spawn-icons", type: "symbol", source: "spawns",
        layout: {
          "icon-image": ["get", "icon"],
          // taille réelle, plus petit qu'une maison — l'expression de zoom
          // DOIT être au niveau racine (contrainte MapLibre)
          "icon-size": ["interpolate", ["linear"], ["zoom"],
            14, ["match", ["get", "icon"], "sp-valise", 0.06, 0.08],
            16, ["match", ["get", "icon"], "sp-valise", 0.13, 0.17],
            18, ["match", ["get", "icon"], "sp-valise", 0.21, 0.28]],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
    } else {
      map.getSource("spawns").setData(spawnsGeoJSON());
    }
  } catch (e) { /* la couche des rencontres ne doit jamais bloquer le reste */ }
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
// outils de test accessibles depuis la console : magnat.speed(60), magnat.reset()
window.magnat = {
  speed: (s) => { speed = s || 1; toast(`⏩ ×${speed}`); },
  // le reset efface aussi la sauvegarde cloud, sinon elle serait restaurée
  reset: () => {
    const wipe = () => { localStorage.removeItem(SAVE_KEY); location.reload(); };
    if (sb && me) sb.from("saves").delete().eq("id", me.id).then(wipe, wipe);
    else wipe();
  },
  // diagnostic Affaires/Tournée : à lire via Safari > Développement > iPhone
  diag: () => ({
    jour: gameDay(), dealDay: S.dealDay, slots: dealSlots(),
    deals: JSON.parse(JSON.stringify(S.deals)),
    walk: Object.assign({}, S.walk),
  }),
  theme: () => { themeForced = themeForced === null ? !night : null; applyTheme(wantNight()); },
  mute: () => { S.muted = !S.muted; save(); },
  logout: () => sb?.auth.signOut().then(() => location.reload()),
};

// ---------------------------------------------------------------------------
// Onboarding + démarrage
// ---------------------------------------------------------------------------
function dismissOnboard() {
  $("#onboard").style.display = "none";
  S.onboarded = true; save();
}
$("#ob-gps").addEventListener("click", () => { dismissOnboard(); startGPS(); });

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
      minZoom: 13,     // dézoom limité à l'échelle du quartier, comme Pokémon GO
      maxZoom: 18.5,
      pitch: 55,
      attributionControl: { compact: true },
    });
    map.on("load", () => {
      addGameLayers();
      updateHUD();
      if (S.onboarded) { $("#onboard").style.display = "none"; startGPS(); }
      // bilan du retour : ce qui s'est accumulé pendant l'absence
      if (offlineGapMs > 2 * HOUR) {
        const pending = Object.keys(S.owned).filter((id) => byId[id])
          .reduce((a, id) => a + accrued(byId[id]), 0);
        if (pending >= 1) {
          setTimeout(() => toast(`🌙 Pendant votre absence : ${fmt(pending)} de loyers vous attendent`, "gain"), 1200);
        }
      }
    });
    // caméra à la Pokémon GO : rivée au personnage — on ne se promène pas
    // à la main. UN doigt = tourner autour du personnage (horizontal) et
    // incliner la vue (vertical). DEUX doigts = zoom uniquement.
    map.dragPan.disable();
    map.keyboard.disable();
    map.touchZoomRotate.disableRotation();
    map.touchPitch.disable();
    map.dragRotate.disable();
    const canvas = map.getCanvas();
    let camPtr = null, ptrCount = 0;
    canvas.addEventListener("pointerdown", (e) => {
      ptrCount++;
      camPtr = ptrCount === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 } : null;
    });
    window.addEventListener("pointermove", (e) => {
      if (!camPtr || e.pointerId !== camPtr.id || ptrCount > 1) return;
      const dx = e.clientX - camPtr.x, dy = e.clientY - camPtr.y;
      camPtr.x = e.clientX; camPtr.y = e.clientY;
      camPtr.moved += Math.abs(dx) + Math.abs(dy);
      if (camPtr.moved < 6) return; // un tap reste un tap
      map.jumpTo({
        bearing: map.getBearing() - dx * 0.45,
        pitch: Math.max(15, Math.min(70, map.getPitch() - dy * 0.25)),
        center: player ? [player.lon, player.lat] : map.getCenter(),
      });
    });
    const endPtr = (e) => {
      ptrCount = Math.max(0, ptrCount - 1);
      if (camPtr && e.pointerId === camPtr.id) camPtr = null;
    };
    window.addEventListener("pointerup", endPtr);
    window.addEventListener("pointercancel", endPtr);
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

// ═══════════════════════════════════════════════════════════════════
// LE MONDE COMMUN (Supabase) : comptes, cadastre partagé, classement
// ═══════════════════════════════════════════════════════════════════
const SUPA_URL = "https://ereqnkzbwjqrbwetvswc.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZXFua3pid2pxcmJ3ZXR2c3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTYwOTcsImV4cCI6MjA5OTY5MjA5N30.PaN-zGTAW0bSkfT6hONm2V7swfpEoDk0NP0xR9zK3KM";

let sb = null;
let me = null;                 // utilisateur connecté (ou null)
let remoteProps = {};          // cadastre mondial : place_id -> ligne
let leaderboard = [];

const myPseudo = () =>
  (localStorage.getItem("magnat-pseudo") || "Magnat anonyme").slice(0, 20);

// les pseudos viennent d'autres joueurs : toujours échappés avant innerHTML
function esc(s) {
  return String(s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function initNet() {
  if (!window.supabase) return;
  try {
    sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    // le monde est VISIBLE sans compte : cadastre, classement, signaux de
    // bourse (le compte ne sert qu'à posséder et à peser sur la cote)
    fetchWorld();
    fetchSignals();
    sb.channel("monde")
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, (payload) => {
        if (payload.eventType === "DELETE") delete remoteProps[payload.old.place_id];
        else remoteProps[payload.new.place_id] = payload.new;
        refreshAllMarkers();
        if (sheetPlace) openSheet(sheetPlace, true);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stock_signals" }, (payload) => {
        const g = payload.new;
        natSignalsRaw.push({ sym: g.sym, pct: g.pct, h: sigHour(g.created_at) });
        natDirty = true; // la cote de tout le monde frémit au prochain tick
      })
      .subscribe();
    sb.auth.onAuthStateChange((_event, session) => {
      const was = !!me;
      me = session?.user || null;
      if (me && !was) onLogin();
    });
  } catch (e) { sb = null; }
}

const sigHour = (iso) => Math.floor((new Date(iso).getTime() - BOURSE_EPOCH) / HOUR);

async function onLogin() {
  try {
    // le profil : créé/actualisé à chaque connexion
    await sb.from("profiles").upsert({
      id: me.id, pseudo: myPseudo(), avatar: S.avatar,
      level: S.level, worth: Math.round(netWorth()),
    });
    // la sauvegarde cloud d'abord : si elle est plus avancée, la page
    // repart dessus et le reste de la connexion se rejouera après reload
    await cloudRestore();
    // lire le cadastre AVANT de publier : on ne s'approprie jamais par
    // simple connexion un lieu déjà tenu par un autre magnat
    await fetchWorld();
    for (const id in S.owned) {
      const r = remoteProps[id];
      if (!r || r.owner === me.id) pushProperty(id, "achat");
    }
    setInterval(snapshot, 60_000);
    tip("monde", "Vous êtes dans le monde commun : vos propriétés portent votre nom, celles des autres magnats apparaissent sur la carte — et leurs parchemins circulent…");
  } catch (e) { /* mode solo si le réseau flanche */ }
}

// --- la bourse nationale : signaux agrégés des joueurs
async function fetchSignals() {
  try {
    const since = new Date(Date.now() - 21 * DAY).toISOString();
    const { data } = await sb.from("stock_signals")
      .select("sym, pct, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(8000);
    natSignalsRaw = (data || []).map((g) => ({ sym: g.sym, pct: g.pct, h: sigHour(g.created_at) }));
    natDirty = true;
  } catch (e) {}
}

function pushSignal(sym, pct, reason) {
  if (!sb || !me || !sym || !pct) return;
  pct = Math.max(-0.01, Math.min(0.01, pct));
  sb.from("stock_signals")
    .insert({ sym, pct, reason: reason || "", author: me.id })
    .then(() => {}); // l'écho realtime l'appliquera chez tout le monde, nous compris
}

async function fetchWorld() {
  try {
    const { data: props } = await sb.from("properties").select("*");
    remoteProps = {};
    (props || []).forEach((r) => (remoteProps[r.place_id] = r));
    const { data: lb } = await sb.from("profiles")
      .select("id, pseudo, level, worth")
      .order("worth", { ascending: false })
      .limit(10);
    leaderboard = lb || [];
    refreshAllMarkers();
    if (panelTab === "empire") renderPanel();
  } catch (e) {}
}

function pushProperty(placeId, via) {
  if (!sb || !me) return;
  sb.from("properties").upsert({
    place_id: placeId, owner: me.id, owner_pseudo: myPseudo(),
    level: S.owned[placeId]?.level || 0,
    taken_via: via || remoteProps[placeId]?.taken_via || "achat",
    updated_at: new Date().toISOString(),
  }).then(() => {});
}

function removeProperty(placeId) {
  if (!sb || !me) return;
  sb.from("properties").delete().eq("place_id", placeId).eq("owner", me.id).then(() => {});
}

function snapshot() {
  if (!sb || !me) return;
  sb.from("profiles").upsert({
    id: me.id, pseudo: myPseudo(), avatar: S.avatar,
    level: S.level, worth: Math.round(netWorth()),
    updated_at: new Date().toISOString(),
  }).then(() => {});
  cloudPush();
}

// --- la sauvegarde cloud : l'empire survit au navigateur -------------------
// Le blob complet de S part dans public.saves (RLS : visible du seul joueur).
// Règle de conflit (prototype) : gameMs ne fait que croître, donc la
// sauvegarde la plus AVANCÉE fait foi — le cloud ne restaure que s'il a
// nettement plus de temps de jeu que le local (navigateur vidé, nouveau
// téléphone, navigation privée).
let cloudReady = false; // jamais d'écriture cloud avant la décision de restauration
let cloudLast = "";

async function cloudRestore() {
  try {
    const { data } = await sb.from("saves").select("data").eq("id", me.id).maybeSingle();
    const remote = data?.data;
    if (remote && (remote.gameMs || 0) > S.gameMs + 60_000) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(remote));
      location.reload(); // la page repart sur la sauvegarde restaurée (migrations comprises)
      return;
    }
  } catch (e) { /* réseau muet : on joue local, on repoussera plus tard */ }
  cloudReady = true;
  cloudPush();
}

function cloudPush() {
  if (!sb || !me || !cloudReady) return;
  try {
    const blob = JSON.stringify(S);
    if (blob === cloudLast) return; // rien de neuf, pas d'upsert
    cloudLast = blob;
    sb.from("saves").upsert({
      id: me.id, data: JSON.parse(blob),
      updated_at: new Date().toISOString(),
    }).then(() => {});
  } catch (e) {}
}

// un lieu tenu par un AUTRE joueur du monde ?
function rivalPlayerOf(placeId) {
  const r = remoteProps[placeId];
  if (!r || S.owned[placeId]) return null;
  if (me && r.owner === me.id) return null;
  return r;
}

// --- interface de connexion
$("#login-close").addEventListener("click", () => ($("#login").hidden = true));
$("#login-send").addEventListener("click", async () => {
  const pseudo = $("#login-pseudo").value.trim();
  const email = $("#login-email").value.trim();
  const msg = $("#login-msg");
  if (pseudo.length < 2) { msg.textContent = "Un nom de magnat digne de ce nom (2 caractères min.)"; return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = "Cet e-mail ne semble pas valide."; return; }
  localStorage.setItem("magnat-pseudo", pseudo);
  msg.textContent = "Envoi du lien…";
  try {
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    msg.textContent = error
      ? "Échec de l'envoi : " + error.message
      : "📬 C'est parti ! Ouvrez le lien reçu par e-mail pour entrer dans le monde.";
  } catch (e) { msg.textContent = "Le monde est injoignable pour l'instant."; }
});

initNet();
