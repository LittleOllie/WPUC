import { loadPlayerBySlug, savePlayerBySlug } from "./firebase.js";

// ——— Core constants ———
const SESSION_USER_KEY = "vr-username";
const CHARGE_REGEN_MS = 5 * 60 * 1000;
const SCOUT_COST = 3;
const MOVE_COST = 2;
const MAX_DEFENSE_SLOTS = 3;
const SEASON_DAYS = 30;
const BACKPACK_UPGRADE_ID = "backpack-upgrade";

const ECON = {
  starterLollies: 800,
  travelEventChance: 0.42,
};

/** Raids: Charge-only cost, big wins, small funny losses. */
const RAID_ECON = {
  stealPctMin: 0.05,
  stealPctMax: 0.15,
  megaChance: 0.14,
  megaMult: 1.75,
  failLossMin: 22,
  failLossMax: 52,
  failChargeChance: 0.28,
  failChargeLoss: 2,
  xpWin: 15,
  xpMega: 25,
  xpLoss: 4,
  raidEventChance: 0.38,
};

const SNACK_CAPACITY_TIERS = [
  { space: 100, upgradeCost: null },
  { space: 130, upgradeCost: 400 },
  { space: 160, upgradeCost: 900 },
  { space: 190, upgradeCost: 1800 },
  { space: 220, upgradeCost: 3200 },
];

const GEAR_PACK_TIERS = [
  { slots: 12, upgradeCost: null },
  { slots: 18, upgradeCost: 350 },
  { slots: 24, upgradeCost: 800 },
  { slots: 30, upgradeCost: 1600 },
  { slots: 36, upgradeCost: 3000 },
];

const LOCATIONS = [
  "Splash Park",
  "Skate Zone",
  "Water Park",
  "Candy Alley",
  "Treehouse",
  "Bike Track",
  "Schoolyard",
  "Arcade Plaza",
];

/** Kid-safe tradable snacks — min/max prices, backpack space, volatility. */
const SNACKS = {
  "ice-cream": { name: "Ice Cream", min: 10, max: 120, space: 1, volatility: 0.4 },
  chocolate: { name: "Chocolate Bar", min: 8, max: 90, space: 1, volatility: 0.35 },
  gummies: { name: "Gummies", min: 6, max: 70, space: 1, volatility: 0.45 },
  "sour-candy": { name: "Sour Candy", min: 5, max: 55, space: 1, volatility: 0.4 },
  bubblegum: { name: "Bubblegum", min: 2, max: 20, space: 1, volatility: 0.5 },
  lollipops: { name: "Lollipops", min: 4, max: 45, space: 1, volatility: 0.38 },
  soda: { name: "Soda Cans", min: 12, max: 95, space: 2, volatility: 0.35 },
  cookies: { name: "Cookies", min: 7, max: 65, space: 1, volatility: 0.32 },
  donuts: { name: "Donuts", min: 9, max: 80, space: 1, volatility: 0.36 },
  popcorn: { name: "Popcorn", min: 5, max: 60, space: 1, volatility: 0.42 },
  "jelly-beans": { name: "Jelly Beans", min: 4, max: 50, space: 1, volatility: 0.44 },
  chips: { name: "Chips", min: 6, max: 58, space: 1, volatility: 0.38 },
};

/** Location price bias (<1 = cheaper, >1 = pricier). */
const LOC_BIAS = {
  "Splash Park": { "ice-cream": 0.72, soda: 0.85, popcorn: 0.9 },
  "Skate Zone": { "sour-candy": 0.7, chips: 0.75, bubblegum: 0.8 },
  "Water Park": { "ice-cream": 0.68, soda: 0.7, gummies: 0.88 },
  "Candy Alley": { gummies: 0.55, lollipops: 0.58, chocolate: 0.62, bubblegum: 0.6 },
  Treehouse: { cookies: 0.7, donuts: 0.72, "jelly-beans": 0.74 },
  "Bike Track": { chips: 0.72, soda: 0.78, popcorn: 0.8 },
  Schoolyard: { chocolate: 0.65, lollipops: 0.68, cookies: 0.7 },
  "Arcade Plaza": { popcorn: 0.6, soda: 0.65, chips: 0.68, bubblegum: 0.75 },
};

const MARKET_EVENTS = [
  { msg: "Heatwave! Ice Cream prices skyrocketed!", snackId: "ice-cream", mult: 1.9 },
  { msg: "Candy truck arrived! Gummies are super cheap!", snackId: "gummies", mult: 0.42 },
  { msg: "School fair! Soda demand is exploding!", snackId: "soda", mult: 1.75 },
  { msg: "Movie night! Popcorn prices doubled!", snackId: "popcorn", mult: 1.85 },
  { msg: "Bubblegum blow-out sale at the park!", snackId: "bubblegum", mult: 0.38 },
  { msg: "Chocolate festival — bars cost a fortune!", snackId: "chocolate", mult: 1.7 },
  { msg: "Sports carnival! Soda and chips flying off shelves!", snackId: "soda", mult: 1.6 },
  { msg: "Donut day! Everyone wants donuts!", snackId: "donuts", mult: 1.65 },
  { msg: "Sour candy shipment crashed — prices tanked!", snackId: "sour-candy", mult: 0.4 },
  { msg: "Lollipop parade! Sticks are pricey today!", snackId: "lollipops", mult: 1.55 },
  { msg: "Cookie crumble sale — cheap cookies!", snackId: "cookies", mult: 0.45 },
  { msg: "Jelly bean jackpot! Prices way up!", snackId: "jelly-beans", mult: 1.8 },
];

const GEAR = {
  "water-balloon": { name: "Water Balloon", cost: 120, slot: "attack", attack: 2 },
  "water-pistol": { name: "Water Pistol", cost: 350, slot: "attack", attack: 5 },
  "super-soaker": { name: "Super Soaker", cost: 850, slot: "attack", attack: 12 },
  "mega-soaker": { name: "Mega Soaker", cost: 2200, slot: "attack", attack: 20 },
  "vault-lock": { name: "Vault Lock", cost: 280, slot: "defense", defense: 4, playerDefense: 2 },
  "alarm-bell": { name: "Alarm Bell", cost: 600, slot: "defense", defense: 8, playerDefense: 4 },
  "decoy-box": { name: "Decoy Box", cost: 750, slot: "defense", decoy: 6, playerDefense: 2 },
  "motion-sensor": { name: "Motion Sensor", cost: 480, slot: "defense", defense: 5, scout: 3 },
  skateboard: { name: "Skateboard", cost: 380, slot: "utility", scout: 2 },
  scooter: { name: "Scooter", cost: 220, slot: "utility", evasion: 3 },
};

const RAID_EVENTS = [
  { msg: "Target left their stash exposed!", mult: 1.4, bonus: 12 },
  { msg: "Security distracted at the park!", bonus: 10 },
  { msg: "Rival guild protection is down!", mult: 1.25, bonus: 8 },
  { msg: "You caught them off-guard!", mult: 1.3, bonus: 14 },
  { msg: "Splash Park chaos — easy raid window!", bonus: 11 },
];

const NPCS = [
  {
    id: "npc-tunnel",
    username: "TunnelOllie",
    level: 9,
    exposed: 2800,
    vault: 1200,
    defense: 5,
    risk: "easy",
    raidCost: 10,
  },
  {
    id: "npc-jack",
    username: "ScooterJack",
    level: 11,
    exposed: 3400,
    vault: 900,
    defense: 7,
    risk: "easy",
    raidCost: 10,
  },
  {
    id: "npc-ollie",
    username: "OllieSplash",
    level: 12,
    exposed: 4200,
    vault: 2000,
    defense: 6,
    risk: "medium",
    raidCost: 10,
  },
  {
    id: "npc-bandit",
    username: "BlueBandit",
    level: 15,
    exposed: 5800,
    vault: 2400,
    defense: 9,
    risk: "hard",
    raidCost: 15,
  },
  {
    id: "npc-rat",
    username: "VaultRat",
    level: 18,
    exposed: 9200,
    vault: 5000,
    defense: 11,
    risk: "boss",
    raidCost: 20,
  },
];

const DEFAULT_USER = {
  lollies: ECON.starterLollies,
  vault: 0,
  charge: 40,
  maxCharge: 100,
  xp: 0,
  attack: 1,
  defense: 1,
  location: "Splash Park",
  gameDay: 1,
  snacks: {},
  snackPrices: {},
  marketEvent: null,
  gear: {},
  loadout: { attack: null, defense: [], utility: null },
  snackTier: 0,
  gearTier: 0,
  raidsWon: 0,
  raidsLost: 0,
};

// ——— State ———
let player = null;
let events = [];
let scoutIntel = {};
let raidEvents = {};
let busy = false;
let chargeTimerId = null;
let gameMode = "trade";
let selectedSnackId = null;
let selectedStashId = null;
let selectedGearId = null;
let selectedTargetId = null;
let firebaseSaveTimer = null;

const $ = (sel) => document.querySelector(sel);

function on(sel, type, handler) {
  const el = $(sel);
  if (el) el.addEventListener(type, handler);
}

// ——— Helpers ———
function fmt(n) {
  const x = Number(n) || 0;
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 10_000) return `${(x / 1_000).toFixed(1)}K`;
  if (x >= 1000) return `${(x / 1_000).toFixed(1)}K`;
  return String(Math.round(x));
}

function slug(username) {
  return String(username)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 32) || "player";
}

function logEvent(text) {
  events.unshift({ text, at: Date.now() });
  if (events.length > 30) events.pop();
  renderEvents();
}

function snackSpaceUsed(stash) {
  let n = 0;
  for (const [id, row] of Object.entries(stash || {})) {
    const s = SNACKS[id];
    if (s && row?.qty > 0) n += s.space * row.qty;
  }
  return n;
}

function maxSnackSpace(p) {
  const t = Math.min(Math.max(0, p?.snackTier | 0), SNACK_CAPACITY_TIERS.length - 1);
  return SNACK_CAPACITY_TIERS[t].space;
}

function maxGearSlots(p) {
  const t = Math.min(Math.max(0, p?.gearTier | 0), GEAR_PACK_TIERS.length - 1);
  return GEAR_PACK_TIERS[t].slots;
}

function gearCount(gear) {
  return Object.values(gear || {}).reduce((s, n) => s + (n > 0 ? n : 0), 0);
}

function nextSnackUpgrade(p) {
  const i = Math.min(p.snackTier | 0, SNACK_CAPACITY_TIERS.length - 1);
  if (i >= SNACK_CAPACITY_TIERS.length - 1) return null;
  return SNACK_CAPACITY_TIERS[i + 1];
}

function nextGearUpgrade(p) {
  const i = Math.min(p.gearTier | 0, GEAR_PACK_TIERS.length - 1);
  if (i >= GEAR_PACK_TIERS.length - 1) return null;
  return GEAR_PACK_TIERS[i + 1];
}

function rollPrice(snackId, location, marketEvent) {
  const s = SNACKS[snackId];
  if (!s) return s?.min || 1;
  const bias = LOC_BIAS[location]?.[snackId] ?? 1;
  const roll = Math.random();
  const jitter = (Math.random() - 0.5) * s.volatility;
  let norm = 0.35 + roll * 0.55 * bias + jitter;
  norm = Math.max(0.05, Math.min(0.98, norm));
  let price = Math.round(s.min + (s.max - s.min) * norm);
  if (marketEvent?.snackId === snackId) {
    price = Math.round(price * marketEvent.mult);
  }
  return Math.max(s.min, Math.min(s.max, price));
}

function generateMarketPrices(location, marketEvent) {
  const prices = {};
  for (const id of Object.keys(SNACKS)) {
    prices[id] = rollPrice(id, location, marketEvent);
  }
  return prices;
}

function rollMarketEvent() {
  if (Math.random() > ECON.travelEventChance) return null;
  const ev = MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
  return { ...ev, turnsLeft: 2 };
}

function normalizePlayer(p) {
  if (!p.snacks && p.inventory) {
    p.gear = { ...p.inventory };
    delete p.inventory;
  }
  if (!p.snacks) p.snacks = {};
  if (!p.gear) p.gear = {};
  if (p.backpackTier != null && p.snackTier == null) {
    p.snackTier = Math.min(p.backpackTier, SNACK_CAPACITY_TIERS.length - 1);
    p.gearTier = Math.min(p.backpackTier, GEAR_PACK_TIERS.length - 1);
    delete p.backpackTier;
  }
  if (p.snackTier == null) p.snackTier = 0;
  if (p.gearTier == null) p.gearTier = 0;
  if (p.gameDay == null) p.gameDay = 1;
  if (!p.snackPrices || Object.keys(p.snackPrices).length < 3) {
    p.snackPrices = generateMarketPrices(p.location || "Splash Park", p.marketEvent);
  }
  if (!p.loadout) p.loadout = { attack: null, defense: [], utility: null };
  if (!Array.isArray(p.loadout.defense)) p.loadout.defense = [];
  migrateOwnedGear(p);
  return p;
}

/** One copy of each gear; loadout references owned items. */
function migrateOwnedGear(p) {
  for (const [id, qty] of Object.entries(p.gear || {})) {
    if (qty > 0) p.gear[id] = 1;
    else delete p.gear[id];
  }
  const atk = p.loadout.attack;
  if (atk && !p.gear[atk]) p.loadout.attack = null;
  p.loadout.defense = (p.loadout.defense || []).filter((id) => p.gear[id]);
  if (p.loadout.utility && !p.gear[p.loadout.utility]) p.loadout.utility = null;
}

function applyChargeRegen(p, now = Date.now()) {
  const max = p.maxCharge || 100;
  let charge = p.charge ?? 0;
  const last = typeof p.lastChargeUpdate === "number" ? p.lastChargeUpdate : now;
  if (charge >= max) return { ...p, charge: max, _nextRegen: null };
  const elapsed = now - last;
  const gained = Math.floor(elapsed / CHARGE_REGEN_MS);
  if (gained <= 0) {
    return { ...p, _nextRegen: CHARGE_REGEN_MS - (elapsed % CHARGE_REGEN_MS) };
  }
  charge = Math.min(max, charge + gained);
  const remainder = elapsed % CHARGE_REGEN_MS;
  return {
    ...p,
    charge,
    lastChargeUpdate: now - remainder,
    _nextRegen: charge >= max ? null : CHARGE_REGEN_MS - remainder,
  };
}

function levelFromXp(xp) {
  return Math.floor((xp || 0) / 100) + 1;
}

function storageKey(username) {
  return `vr-save-${slug(username)}`;
}

function playerPayload() {
  if (!player) return null;
  const { _nextRegen, ...data } = player;
  return data;
}

function saveLocal() {
  if (!player?.username) return;
  try {
    localStorage.setItem(storageKey(player.username), JSON.stringify(playerPayload()));
    localStorage.setItem(SESSION_USER_KEY, player.username);
  } catch {
    /* ignore */
  }
}

function scheduleCloudSave() {
  if (!player?.username) return;
  clearTimeout(firebaseSaveTimer);
  firebaseSaveTimer = setTimeout(async () => {
    try {
      await savePlayerBySlug(slug(player.username), playerPayload());
    } catch (err) {
      console.warn("Cloud save skipped:", err.message);
    }
  }, 800);
}

function loadLocal(username) {
  try {
    const raw = localStorage.getItem(storageKey(username));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function loadPlayer(username) {
  const s = slug(username);
  try {
    const cloud = await loadPlayerBySlug(s);
    if (cloud?.username) return cloud;
  } catch {
    /* offline */
  }
  return loadLocal(username);
}

async function persist(partial) {
  if (!player) return;
  Object.assign(player, partial);
  player.level = levelFromXp(player.xp);
  saveLocal();
  scheduleCloudSave();
  render();
}

function spendCharge(cost) {
  if ((player.charge ?? 0) < cost) {
    logEvent(`Need ${cost} Charge!`);
    return false;
  }
  player.charge -= cost;
  player.lastChargeUpdate = Date.now();
  return true;
}

async function travelTo(loc) {
  if (loc === player.location) return;
  if (!spendCharge(MOVE_COST)) return;
  busy = true;

  let gameDay = (player.gameDay || 1) + 1;
  let marketEvent = player.marketEvent;
  if (marketEvent?.turnsLeft > 0) {
    marketEvent = { ...marketEvent, turnsLeft: marketEvent.turnsLeft - 1 };
    if (marketEvent.turnsLeft <= 0) marketEvent = null;
  }
  const newEvent = rollMarketEvent();
  if (newEvent) marketEvent = newEvent;

  const snackPrices = generateMarketPrices(loc, marketEvent);
  let seasonMsg = null;
  if (gameDay > SEASON_DAYS) {
    gameDay = 1;
    seasonMsg = "Season complete! Day 1 — new month of trading!";
  }

  await persist({
    location: loc,
    gameDay,
    charge: player.charge,
    lastChargeUpdate: player.lastChargeUpdate,
    snackPrices,
    marketEvent,
  });

  logEvent(`Travelled to ${loc}. Day ${gameDay}/${SEASON_DAYS}. (-${MOVE_COST} Charge)`);
  if (marketEvent) logEvent(marketEvent.msg);
  if (seasonMsg) logEvent(seasonMsg);

  const cheap = Object.entries(snackPrices)
    .filter(([id, pr]) => pr <= SNACKS[id].min * 1.15)
    .map(([id]) => SNACKS[id].name);
  if (cheap.length && Math.random() < 0.5) {
    logEvent(`Tip: ${cheap[0]} looks cheap here!`);
  }

  busy = false;
  render();
}

// ——— Gear loadout & raids ———
function getLoadoutBonuses(p) {
  const b = { attack: 0, defense: 0, scout: 0, evasion: 0, decoy: 0, playerDefense: 0 };
  const lo = p.loadout || {};
  if (lo.attack && p.gear[lo.attack]) {
    const g = GEAR[lo.attack];
    b.attack += g?.attack || 0;
  }
  for (const id of lo.defense || []) {
    if (!p.gear[id]) continue;
    const g = GEAR[id];
    b.defense += g?.defense || 0;
    b.decoy += g?.decoy || 0;
    b.scout += g?.scout || 0;
    b.playerDefense += g?.playerDefense || 0;
  }
  if (lo.utility && p.gear[lo.utility]) {
    const g = GEAR[lo.utility];
    b.scout += g?.scout || 0;
    b.evasion += g?.evasion || 0;
  }
  return b;
}

function hasAttackEquipped(p) {
  const id = p.loadout?.attack;
  return Boolean(id && p.gear[id] && GEAR[id]?.slot === "attack");
}

function riskLabel(risk) {
  return { easy: "Easy", medium: "Med", hard: "Hard", boss: "BOSS" }[risk] || risk;
}

function rollRaidEvent(npcId) {
  if (Math.random() > RAID_ECON.raidEventChance) return null;
  const ev = RAID_EVENTS[Math.floor(Math.random() * RAID_EVENTS.length)];
  return { ...ev, npcId };
}

function calcWinChance(npc, scouted, raidEv) {
  const b = getLoadoutBonuses(player);
  const atk = (player.attack || 1) + b.attack;
  let chance = 50 + (atk - npc.defense) * 2.8 + ((player.level || 1) - npc.level) * 2;
  if (scouted) chance += 8 + b.scout;
  if (raidEv?.bonus) chance += raidEv.bonus;
  if (npc.risk === "easy") chance += 6;
  if (npc.risk === "boss") chance -= 8;
  chance += (Math.random() - 0.5) * 10;
  return Math.min(92, Math.max(18, Math.round(chance)));
}

function calcRaidPayout(npc, raidEv) {
  const b = getLoadoutBonuses(player);
  let pct = RAID_ECON.stealPctMin + Math.random() * (RAID_ECON.stealPctMax - RAID_ECON.stealPctMin);
  pct += b.attack * 0.003;
  if (raidEv?.mult) pct *= raidEv.mult;
  if (scoutIntel[npc.id] >= 65) pct += 0.02;
  let stolen = Math.round((npc.exposed || 0) * pct);
  const mega = Math.random() < RAID_ECON.megaChance;
  if (mega) stolen = Math.round(stolen * RAID_ECON.megaMult);
  stolen = Math.min(npc.exposed || 0, Math.max(80, stolen));
  return { stolen, mega };
}

function calcFailPenalty() {
  const b = getLoadoutBonuses(player);
  const exposed = player.lollies || 0;
  let loss =
    RAID_ECON.failLossMin +
    Math.floor(Math.random() * (RAID_ECON.failLossMax - RAID_ECON.failLossMin + 1));
  loss = Math.min(loss, Math.round(exposed * 0.12));
  loss = Math.max(0, loss - b.playerDefense * 2);
  const chargeLoss =
    Math.random() < RAID_ECON.failChargeChance
      ? Math.min(RAID_ECON.failChargeLoss, player.charge || 0)
      : 0;
  return { loss, chargeLoss };
}

function autoEquipGear(id) {
  const g = GEAR[id];
  if (!g || !player.gear[id]) return;
  const loadout = {
    attack: player.loadout?.attack || null,
    defense: [...(player.loadout?.defense || [])],
    utility: player.loadout?.utility || null,
  };
  if (g.slot === "attack") loadout.attack = id;
  else if (g.slot === "defense" && loadout.defense.length < MAX_DEFENSE_SLOTS && !loadout.defense.includes(id)) {
    loadout.defense.push(id);
  } else if (g.slot === "utility") loadout.utility = id;
  player.loadout = loadout;
}

function toggleEquipGear(id) {
  const g = GEAR[id];
  if (!g || !player.gear[id]) return;
  const loadout = {
    attack: player.loadout?.attack || null,
    defense: [...(player.loadout?.defense || [])],
    utility: player.loadout?.utility || null,
  };
  if (g.slot === "attack") {
    loadout.attack = loadout.attack === id ? null : id;
  } else if (g.slot === "defense") {
    const i = loadout.defense.indexOf(id);
    if (i >= 0) loadout.defense.splice(i, 1);
    else if (loadout.defense.length < MAX_DEFENSE_SLOTS) loadout.defense.push(id);
    else logEvent("Max 3 defense items equipped.");
  } else if (g.slot === "utility") {
    loadout.utility = loadout.utility === id ? null : id;
  }
  player.loadout = loadout;
}

function formatLoadout(p) {
  const lo = p.loadout || {};
  const parts = [];
  if (lo.attack && p.gear[lo.attack]) parts.push(GEAR[lo.attack].name);
  for (const id of lo.defense || []) {
    if (p.gear[id]) parts.push(GEAR[id].name);
  }
  if (lo.utility && p.gear[lo.utility]) parts.push(GEAR[lo.utility].name);
  return parts.length ? parts.join(" · ") : "(none — buy & equip gear)";
}

const FAIL_LINES = [
  (n, loss) => `${n} splashed you back! −$${loss}`,
  (n, loss) => `You slipped escaping ${n}! −$${loss}`,
  (n, loss) => `${n} had extra water shields! −$${loss}`,
  (n, loss) => `Soaked! ${n} wins this round. −$${loss}`,
];

// ——— Trade ———
function getTradeQty() {
  const n = parseInt($("#trade-qty")?.value, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(99, n) : 1;
}

async function buySnack() {
  if (busy || !selectedSnackId) return;
  const snack = SNACKS[selectedSnackId];
  const price = player.snackPrices[selectedSnackId];
  if (!snack || price == null) return;

  const qty = getTradeQty();
  const cost = price * qty;
  const needSpace = snack.space * qty;
  const used = snackSpaceUsed(player.snacks);
  const cap = maxSnackSpace(player);

  if (used + needSpace > cap) {
    logEvent("Snack stash full! Upgrade backpack in Gear shop.");
    return;
  }
  if ((player.lollies ?? 0) < cost) {
    logEvent("Not enough $Lollies!");
    return;
  }

  busy = true;
  const snacks = { ...player.snacks };
  const row = snacks[selectedSnackId] || { qty: 0, avg: 0 };
  const totalQty = row.qty + qty;
  row.avg = Math.round((row.avg * row.qty + price * qty) / totalQty);
  row.qty = totalQty;
  snacks[selectedSnackId] = row;

  await persist({
    lollies: player.lollies - cost,
    snacks,
    xp: (player.xp || 0) + 2,
  });
  logEvent(`Bought ${qty} ${snack.name} @ $${price} (−$${cost}).`);
  busy = false;
}

async function sellSnack() {
  if (busy || !selectedStashId) return;
  const snack = SNACKS[selectedStashId];
  const row = player.snacks[selectedStashId];
  if (!snack || !row?.qty) return;

  const qty = Math.min(getTradeQty(), row.qty);
  const price = player.snackPrices[selectedStashId] ?? snack.min;
  const revenue = price * qty;
  const profit = (price - row.avg) * qty;

  busy = true;
  const snacks = { ...player.snacks };
  row.qty -= qty;
  if (row.qty <= 0) delete snacks[selectedStashId];
  else snacks[selectedStashId] = row;

  await persist({
    lollies: player.lollies + revenue,
    snacks,
    xp: (player.xp || 0) + 3 + (profit > 0 ? 5 : 0),
  });

  const profitMsg =
    profit > 0 ? ` Profit +$${profit}!` : profit < 0 ? ` Loss $${-profit}.` : "";
  logEvent(`Sold ${qty} ${snack.name} @ $${price} (+$${revenue}).${profitMsg}`);
  busy = false;
}

// ——— UI modes ———
function setMode(mode) {
  gameMode = mode;
  document.querySelectorAll(".dw-mode-btn").forEach((btn) => {
    btn.classList.toggle("dw-mode-btn--on", btn.dataset.mode === mode);
  });
  $("#panel-trade")?.classList.toggle("is-hidden", mode !== "trade");
  $("#panel-gear")?.classList.toggle("is-hidden", mode !== "gear");
  $("#panel-raid")?.classList.toggle("is-hidden", mode !== "raid");
  updateActionButtons();
}

function showAuth() {
  $("#auth-screen")?.classList.remove("is-hidden");
  $("#game-screen")?.classList.add("is-hidden");
  const last = localStorage.getItem(SESSION_USER_KEY);
  const input = $("#username-input");
  if (input && last) input.value = last;
}

function showGame() {
  $("#auth-screen")?.classList.add("is-hidden");
  $("#game-screen")?.classList.remove("is-hidden");
}

async function startGame(username) {
  const name = String(username || "").trim();
  if (name.length < 2) return false;

  const saved = await loadPlayer(name);
  player = normalizePlayer(
    applyChargeRegen({
      ...DEFAULT_USER,
      ...saved,
      username: name,
      lastChargeUpdate: saved?.lastChargeUpdate || Date.now(),
    }),
  );

  scoutIntel = {};
  events = saved
    ? [{ text: `Welcome back, ${name}!` }, { text: `Day ${player.gameDay} — buy low, sell high!` }]
    : [
        { text: `Welcome, ${name}!` },
        { text: "Travel between parks. Snack prices change every trip!" },
        { text: "Trade snacks for steady $Lollies. Raids are big risky scores!" },
      ];

  if (!saved && !player.gear["water-balloon"]) {
    player.gear["water-balloon"] = 1;
    player.loadout = { attack: "water-balloon", defense: [], utility: null };
  }

  if (!selectedSnackId) selectedSnackId = Object.keys(SNACKS)[0];
  if (!selectedGearId) selectedGearId = "water-balloon";
  if (!selectedTargetId) selectedTargetId = NPCS[0].id;

  saveLocal();
  scheduleCloudSave();
  showGame();
  setMode("trade");
  try {
    render();
  } catch (err) {
    console.error(err);
  }
  startChargeTicker();
  return true;
}

function handleEnterGame(e) {
  e?.preventDefault();
  const err = $("#auth-error");
  const name = $("#username-input")?.value?.trim() || "";
  if (name.length < 2) {
    if (err) {
      err.textContent = "Enter a username (2+ characters).";
      err.hidden = false;
    }
    return;
  }
  startGame(name).then((ok) => {
    if (!ok && err) {
      err.textContent = "Enter a username (2+ characters).";
      err.hidden = false;
    } else if (err) err.hidden = true;
  });
}

// ——— Render ———
function render() {
  if (!player) return;
  player = applyChargeRegen(player);
  const day = player.gameDay || 1;
  const usedSnack = snackSpaceUsed(player.snacks);
  const capSnack = maxSnackSpace(player);
  const usedGear = gearCount(player.gear);
  const capGear = maxGearSlots(player);
  const g = gearBonuses(player.gear);

  $("#title-username").textContent = player.username || "";
  const stats = $("#stats-box");
  if (stats) {
    stats.innerHTML = `
      <div class="line"><span class="lbl">DAY</span><span class="c-day">${day}/${SEASON_DAYS}</span></div>
      <div class="line"><span class="lbl">CASH</span><span class="c-cash">$${fmt(player.lollies)}</span></div>
      <div class="line"><span class="lbl">VAULT</span><span class="c-bank">$${fmt(player.vault)}</span></div>
      <div class="line"><span class="lbl">CHARGE</span><span class="c-charge">${player.charge}/${player.maxCharge}</span></div>
      <div class="line"><span class="lbl">STASH</span><span class="c-wht">${usedSnack}/${capSnack}</span></div>
      <div class="line"><span class="lbl">LEVEL</span><span class="c-wht">${player.level || 1}</span></div>
    `;
  }

  const pct = Math.round(((player.charge ?? 0) / (player.maxCharge || 100)) * 100);
  $("#charge-fill") && ($("#charge-fill").style.width = `${pct}%`);
  $("#charge-pct") && ($("#charge-pct").textContent = `${player.charge}/${player.maxCharge}`);
  const timer = $("#charge-timer");
  if (timer) {
    if (player._nextRegen != null && player.charge < player.maxCharge) {
      const sec = Math.ceil(player._nextRegen / 1000);
      timer.textContent = `+1 ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    } else timer.textContent = player.charge >= player.maxCharge ? "Full" : "";
  }

  const evEl = $("#market-event");
  if (evEl) {
    evEl.textContent = player.marketEvent?.msg || "—";
  }

  $("#location-name").textContent = player.location;
  $("#trade-loc-label").textContent = player.location;
  const locBtns = $("#location-btns");
  if (locBtns) {
    locBtns.innerHTML = LOCATIONS.map(
      (loc) =>
        `<button type="button" class="dw-btn" data-loc="${loc}" ${player.location === loc ? "disabled" : ""}>${loc}</button>`,
    ).join("");
  }

  $("#snack-inv-title").textContent = `Snack stash: ${usedSnack}/${capSnack}`;
  $("#gear-inv-title").textContent = `Gear pack: ${usedGear}/${capGear}`;

  renderEvents();
  renderMarket();
  renderSnackInv();
  renderShop();
  renderGearInv();
  renderOwnedGear();
  renderRaid();
  renderLoadout();
  updateActionButtons();
}

function renderEvents() {
  const log = $("#event-log");
  if (!log) return;
  log.innerHTML = events
    .slice(0, 14)
    .map((e) => `<p>${e.text}</p>`)
    .join("");
}

function renderMarket() {
  const tbody = $("#market-table tbody");
  if (!tbody) return;
  tbody.innerHTML = Object.entries(SNACKS)
    .map(([id, s]) => {
      const price = player.snackPrices[id] ?? "—";
      const sel = id === selectedSnackId ? ' class="sel"' : "";
      const cls = price <= s.min * 1.12 ? "cheap" : price >= s.max * 0.88 ? "dear" : "";
      const tdCls = cls ? ` class="${cls}"` : "";
      return `<tr data-snack="${id}"${sel}><td>${s.name}</td><td${tdCls}>$${price}</td></tr>`;
    })
    .join("");
}

function renderSnackInv() {
  const tbody = $("#snack-inv-table tbody");
  if (!tbody) return;
  const keys = Object.keys(player.snacks).filter((k) => player.snacks[k]?.qty > 0);
  if (!keys.length) {
    tbody.innerHTML = `<tr><td colspan="3"><i>empty</i></td></tr>`;
    return;
  }
  tbody.innerHTML = keys
    .map((id) => {
      const s = SNACKS[id];
      const row = player.snacks[id];
      const sel = id === selectedStashId ? ' class="sel"' : "";
      const sell = player.snackPrices[id] ?? 0;
      const pnl = sell - row.avg;
      const tag = pnl > 0 ? "+" : "";
      return `<tr data-stash="${id}"${sel}><td>${s?.name || id}</td><td>${row.qty}</td><td>$${row.avg} (${tag}${pnl})</td></tr>`;
    })
    .join("");
}

function renderShop() {
  const tbody = $("#shop-table tbody");
  if (!tbody) return;
  let html = Object.entries(GEAR)
    .map(([id, g]) => {
      const sel = id === selectedGearId ? ' class="sel"' : "";
      return `<tr data-gear="${id}"${sel}><td>${g.name}</td><td>$${g.cost}</td></tr>`;
    })
    .join("");

  const snackUp = nextSnackUpgrade(player);
  if (snackUp) {
    const cur = maxSnackSpace(player);
    const sel = selectedGearId === "snack-pack-upgrade" ? ' class="sel"' : "";
    html += `<tr data-gear="snack-pack-upgrade"${sel}><td>🎒 Snack stash +${snackUp.space - cur}</td><td>$${snackUp.upgradeCost}</td></tr>`;
  }
  const gearUp = nextGearUpgrade(player);
  if (gearUp) {
    const cur = maxGearSlots(player);
    const sel = selectedGearId === "gear-pack-upgrade" ? ' class="sel"' : "";
    html += `<tr data-gear="gear-pack-upgrade"${sel}><td>🎒 Gear pack +${gearUp.slots - cur}</td><td>$${gearUp.upgradeCost}</td></tr>`;
  }
  tbody.innerHTML = html;
}

function renderGearInv() {
  const tbody = $("#gear-inv-table tbody");
  if (!tbody) return;
  const keys = Object.keys(player.gear).filter((k) => player.gear[k] > 0);
  tbody.innerHTML = !keys.length
    ? `<tr><td colspan="2"><i>empty</i></td></tr>`
    : keys
        .map((id) => {
          const g = GEAR[id];
          const eq =
            player.loadout?.attack === id ||
            player.loadout?.defense?.includes(id) ||
            player.loadout?.utility === id
              ? " ✓"
              : "";
          return `<tr><td>${g?.name || id}${eq}</td><td>owned</td></tr>`;
        })
        .join("");
}

function renderOwnedGear() {
  const tbody = $("#owned-gear-table tbody");
  if (!tbody) return;
  const keys = Object.keys(player.gear).filter((k) => player.gear[k] > 0);
  tbody.innerHTML = !keys.length
    ? `<tr><td colspan="2"><i>buy gear in Gear tab</i></td></tr>`
    : keys
        .map((id) => {
          const g = GEAR[id];
          const equipped =
            player.loadout?.attack === id ||
            player.loadout?.defense?.includes(id) ||
            player.loadout?.utility === id;
          const sel = id === selectedGearId ? ' class="sel"' : "";
          return `<tr data-equip="${id}"${sel}><td>${g.name}${equipped ? " ★" : ""}</td><td>${g.slot}</td></tr>`;
        })
        .join("");
}

function renderLoadout() {
  const box = $("#loadout-box");
  if (box) box.textContent = `LOADOUT: ${formatLoadout(player)}`;
  const b = getLoadoutBonuses(player);
  const hint = $("#raid-hint");
  if (hint) {
    hint.textContent = hasAttackEquipped(player)
      ? `ATK +${b.attack} · Scout/Raid uses Charge only`
      : "Equip an attack item (Water Balloon, etc.)";
  }
  const exp = $("#exposed-cash");
  if (exp) exp.textContent = `$${fmt(player.lollies || 0)} at risk (pocket)`;
  const vault = $("#vault-safe");
  if (vault) vault.textContent = `$${fmt(player.vault || 0)} protected`;
}

function renderRaid() {
  const tbody = $("#raid-table tbody");
  if (!tbody) return;
  tbody.innerHTML = NPCS.map((npc) => {
    const sel = npc.id === selectedTargetId ? ' class="sel"' : "";
    const tag = scoutIntel[npc.id] != null ? ` ${scoutIntel[npc.id]}%` : "";
    const risk = `risk-${npc.risk}`;
    return `<tr data-target="${npc.id}"${sel}><td>${npc.username}${tag}</td><td>$${fmt(npc.exposed)}</td><td class="${risk}">${riskLabel(npc.risk)}</td></tr>`;
  }).join("");
}

function updateActionButtons() {
  const snack = selectedSnackId ? SNACKS[selectedSnackId] : null;
  const price = selectedSnackId ? player.snackPrices[selectedSnackId] : 0;
  const qty = getTradeQty();
  const buyCost = price * qty;

  const btnBuy = $("#btn-buy-snack");
  if (btnBuy) {
    btnBuy.disabled =
      busy ||
      gameMode !== "trade" ||
      !snack ||
      (player.lollies ?? 0) < buyCost ||
      snackSpaceUsed(player.snacks) + (snack?.space || 1) * qty > maxSnackSpace(player);
  }

  const stash = selectedStashId ? player.snacks[selectedStashId] : null;
  const btnSell = $("#btn-sell-snack");
  if (btnSell) {
    btnSell.disabled = busy || gameMode !== "trade" || !stash?.qty;
  }

  const g = selectedGearId && !selectedGearId.includes("upgrade") ? GEAR[selectedGearId] : null;
  const btnGear = $("#btn-buy-gear");
  if (btnGear) {
    let cost = g?.cost;
    if (selectedGearId === "snack-pack-upgrade") cost = nextSnackUpgrade(player)?.upgradeCost;
    if (selectedGearId === "gear-pack-upgrade") cost = nextGearUpgrade(player)?.upgradeCost;
    btnGear.disabled =
      busy ||
      gameMode !== "gear" ||
      !selectedGearId ||
      (cost != null && (player.lollies ?? 0) < cost) ||
      (g && gearCount(player.gear) >= maxGearSlots(player));
    btnGear.textContent =
      selectedGearId?.includes("upgrade") ? "Upgrade >>" : "Buy >>";
  }

  const npc = selectedTargetId ? NPCS.find((n) => n.id === selectedTargetId) : null;
  const raidCost = npc?.raidCost ?? 10;
  const btnScout = $("#btn-scout");
  if (btnScout) {
    btnScout.disabled = busy || gameMode !== "raid" || !selectedTargetId;
    btnScout.textContent = `Scout (${SCOUT_COST} Chg)`;
  }
  const btnRaid = $("#btn-raid");
  if (btnRaid) {
    btnRaid.disabled =
      busy || gameMode !== "raid" || !selectedTargetId || !hasAttackEquipped(player);
    btnRaid.textContent = npc ? `Raid! (${raidCost} Chg)` : "Raid!";
  }
}

function showRanks() {
  const snackVal = Object.entries(player.snacks).reduce((s, [id, row]) => {
    const p = player.snackPrices[id] ?? row.avg;
    return s + p * (row.qty || 0);
  }, 0);
  const w = (player.lollies || 0) + (player.vault || 0) + snackVal;
  const rows = [
    ...NPCS.map((n) => ({ name: n.username, wealth: (n.exposed || 0) + (n.vault || 0) })),
    { name: `${player.username} (you)`, wealth: w },
  ]
    .sort((a, b) => b.wealth - a.wealth)
    .map((r, i) => `${i + 1}. ${r.name} — $${fmt(r.wealth)}`)
    .join("\n");
  alert(`TOP TRADERS\n\n${rows}`);
}

function setupControls() {
  on("#market-table tbody", "click", (e) => {
    const row = e.target.closest("tr[data-snack]");
    if (!row) return;
    selectedSnackId = row.dataset.snack;
    renderMarket();
    updateActionButtons();
  });

  on("#snack-inv-table tbody", "click", (e) => {
    const row = e.target.closest("tr[data-stash]");
    if (!row) return;
    selectedStashId = row.dataset.stash;
    renderSnackInv();
    updateActionButtons();
  });

  on("#shop-table tbody", "click", (e) => {
    const row = e.target.closest("tr[data-gear]");
    if (!row) return;
    selectedGearId = row.dataset.gear;
    renderShop();
    updateActionButtons();
  });

  on("#raid-table tbody", "click", (e) => {
    const row = e.target.closest("tr[data-target]");
    if (!row) return;
    selectedTargetId = row.dataset.target;
    renderRaid();
    updateActionButtons();
  });

  on("#owned-gear-table tbody", "click", (e) => {
    const row = e.target.closest("tr[data-equip]");
    if (!row || busy) return;
    selectedGearId = row.dataset.equip;
    toggleEquipGear(row.dataset.equip);
    persist({ loadout: player.loadout });
    renderOwnedGear();
    renderGearInv();
    renderLoadout();
    logEvent(`Equipped: ${formatLoadout(player)}`);
  });

  on("#location-btns", "click", (e) => {
    const btn = e.target.closest("[data-loc]");
    if (!btn || busy) return;
    travelTo(btn.dataset.loc);
  });

  document.querySelectorAll(".dw-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });
  on("#btn-mode-trade", "click", () => setMode("trade"));
  on("#btn-mode-trade2", "click", () => setMode("trade"));

  on("#btn-buy-snack", "click", () => buySnack());
  on("#btn-sell-snack", "click", () => sellSnack());
  on("#trade-qty", "input", () => updateActionButtons());

  on("#btn-buy-gear", "click", async () => {
    if (busy || !selectedGearId) return;

    if (selectedGearId === "snack-pack-upgrade") {
      const up = nextSnackUpgrade(player);
      if (!up || (player.lollies ?? 0) < up.upgradeCost) {
        logEvent(!up ? "Snack stash maxed!" : "Not enough cash!");
        return;
      }
      busy = true;
      await persist({ lollies: player.lollies - up.upgradeCost, snackTier: (player.snackTier | 0) + 1 });
      logEvent(`Snack stash → ${up.space} spaces!`);
      busy = false;
      return;
    }

    if (selectedGearId === "gear-pack-upgrade") {
      const up = nextGearUpgrade(player);
      if (!up || (player.lollies ?? 0) < up.upgradeCost) {
        logEvent(!up ? "Gear pack maxed!" : "Not enough cash!");
        return;
      }
      busy = true;
      await persist({ lollies: player.lollies - up.upgradeCost, gearTier: (player.gearTier | 0) + 1 });
      logEvent(`Gear pack → ${up.slots} slots!`);
      busy = false;
      return;
    }

    const item = GEAR[selectedGearId];
    if (!item) return;
    if (player.gear[selectedGearId]) {
      logEvent(`You own ${item.name} — equip it on the Raid tab.`);
      return;
    }
    if (gearCount(player.gear) >= maxGearSlots(player)) {
      logEvent("Gear pack full!");
      return;
    }
    if ((player.lollies ?? 0) < item.cost) {
      logEvent("Not enough cash!");
      return;
    }
    busy = true;
    const gear = { ...player.gear, [selectedGearId]: 1 };
    player.gear = gear;
    player.lollies -= item.cost;
    autoEquipGear(selectedGearId);
    await persist({ lollies: player.lollies, gear, loadout: player.loadout });
    logEvent(`Bought ${item.name} for $${item.cost} — permanent gear!`);
    busy = false;
  });

  on("#btn-scout", "click", async () => {
    if (busy || !selectedTargetId) return;
    const npc = NPCS.find((n) => n.id === selectedTargetId);
    if (!npc || !spendCharge(SCOUT_COST)) return;
    busy = true;
    const chance = calcWinChance(npc, true);
    scoutIntel[npc.id] = chance;
    await persist({ charge: player.charge, lastChargeUpdate: player.lastChargeUpdate });
    logEvent(`Scouted ${npc.username} — ${chance}% win · $${fmt(npc.exposed)} exposed.`);
    busy = false;
  });

  on("#btn-raid", "click", async () => {
    if (busy || !selectedTargetId) return;
    const npc = NPCS.find((n) => n.id === selectedTargetId);
    if (!npc || !hasAttackEquipped(player)) {
      logEvent("Equip attack gear first (Raid tab)!");
      return;
    }
    const raidCost = npc.raidCost || 10;
    if (!spendCharge(raidCost)) return;
    busy = true;

    const raidEv = rollRaidEvent(npc.id);
    if (raidEv) {
      raidEvents[npc.id] = raidEv;
      logEvent(raidEv.msg);
    }
    const scouted = scoutIntel[npc.id] != null;
    const win = Math.random() * 100 < calcWinChance(npc, scouted, raidEv);

    if (win) {
      const { stolen, mega } = calcRaidPayout(npc, raidEv);
      npc.exposed = Math.max(0, (npc.exposed || 0) - stolen);
      player.lollies += stolen;
      player.raidsWon = (player.raidsWon || 0) + 1;
      player.xp = (player.xp || 0) + (mega ? RAID_ECON.xpMega : RAID_ECON.xpWin);
      if (mega) {
        logEvent(`MEGA SCORE! You soaked ${npc.username}! +$${fmt(stolen)} +${RAID_ECON.xpMega} XP`);
      } else {
        logEvent(`SUCCESS! You soaked ${npc.username}! +$${fmt(stolen)} +${RAID_ECON.xpWin} XP`);
      }
    } else {
      const { loss, chargeLoss } = calcFailPenalty();
      player.lollies = Math.max(0, (player.lollies || 0) - loss);
      player.charge = Math.max(0, (player.charge || 0) - chargeLoss);
      player.raidsLost = (player.raidsLost || 0) + 1;
      player.xp = (player.xp || 0) + RAID_ECON.xpLoss;
      const line = FAIL_LINES[Math.floor(Math.random() * FAIL_LINES.length)](npc.username, loss);
      logEvent(`${line} +${RAID_ECON.xpLoss} XP`);
      if (chargeLoss) logEvent(`Winded — lost ${chargeLoss} Charge.`);
    }

    await persist({
      lollies: player.lollies,
      xp: player.xp,
      raidsWon: player.raidsWon,
      raidsLost: player.raidsLost,
      charge: player.charge,
      lastChargeUpdate: player.lastChargeUpdate,
    });
    busy = false;
  });

  on("#btn-deposit", "click", async () => {
    const amt = parseInt($("#vault-amount")?.value, 10);
    if (!amt || amt <= 0 || amt > (player.lollies || 0)) {
      logEvent("Bad deposit amount.");
      return;
    }
    busy = true;
    await persist({ lollies: player.lollies - amt, vault: (player.vault || 0) + amt });
    logEvent(`Vault +$${amt}.`);
    busy = false;
  });

  on("#btn-withdraw", "click", async () => {
    const amt = parseInt($("#vault-amount")?.value, 10);
    if (!amt || amt <= 0 || amt > (player.vault || 0)) {
      logEvent("Bad withdraw amount.");
      return;
    }
    busy = true;
    await persist({ lollies: player.lollies + amt, vault: player.vault - amt });
    logEvent(`Vault −$${amt} to pocket.`);
    busy = false;
  });

  on("#btn-ranks", "click", () => showRanks());
  on("#btn-help", "click", () => {
    alert(
      "VAULT RAID\n\n" +
        "TRADE: travel, buy snacks low, sell high (main income)\n" +
        "RAID: costs Charge only — gear is permanent!\n" +
        "• Equip attack + defense on Raid tab\n" +
        "• Steal 5–15% of target EXPOSED cash\n" +
        "• Failed raids: small $ loss + always +XP\n" +
        "• Vault = safe · Pocket $ = raid risk\n",
    );
  });

  on("#btn-refill-charge", "click", async () => {
    if (!player || busy) return;
    busy = true;
    await persist({ charge: player.maxCharge, lastChargeUpdate: Date.now() });
    logEvent("Charge refilled. (dev)");
    busy = false;
  });

  on("#form-enter", "submit", handleEnterGame);
  on("#btn-logout", "click", () => {
    clearInterval(chargeTimerId);
    player = null;
    showAuth();
  });
}

function startChargeTicker() {
  clearInterval(chargeTimerId);
  chargeTimerId = setInterval(() => {
    if (!player) return;
    const before = player.charge;
    player = applyChargeRegen(player);
    if (player.charge !== before) {
      persist({ charge: player.charge, lastChargeUpdate: player.lastChargeUpdate });
    } else render();
  }, 1000);
}

function init() {
  setupControls();
  showAuth();
  const last = localStorage.getItem(SESSION_USER_KEY);
  if (last) startGame(last);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
