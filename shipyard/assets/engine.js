/* Kex Shipyard engine: campaign state and every action that changes it.
   Pure functions over plain JSON. Each action returns { state, log } or throws ActionError; a failed action never
   changes the input. Works in the browser (window.KexEngine) and in Node (require) for tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KexEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHEMA = 1;
  const HANGAR_REWARD = { kits: 20, items: { repair_drone: 2, power_cell: 1 } };
  const REACTOR_CASK_PU = 500;
  const REACTOR_DAYS = 30;
  const CHANNEL_CAP = 10;
  const ARCHIVE_CAP = 24;
  const LOG_LIMIT = 300;
  const MAX_AMOUNT = 1e7; // largest single request
  // Ledger limits shared by every action and by the save loader, so a legal action always survives a reload.
  const CAP = { day: 1e9, count: 1e8, gold: 1e10 };
  // Decoding an encrypted schematic (GM request 2026-10-01): a small power cost and a few days per tier.
  const DECODE = { puPerTier: 5, daysPerTier: 1 };
  const HULLS = ['kex', 'shuttle'];
  const MODES = { kex: ['active', 'cold'], shuttle: ['docked', 'standby', 'flight'] };
  const LOG_KINDS = ['info', 'gold', 'kits', 'power', 'part', 'quest', 'build', 'install', 'reveal', 'warn', 'day', 'gm', 'recycle', 'learn'];
  const STATUSES = ['planned', 'building', 'installed'];

  class ActionError extends Error {}
  const fail = (msg) => { throw new ActionError(msg); };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const round2 = (n) => Math.round(n * 100) / 100;
  const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

  // ---------- catalog lookups (prototype-free, so ids like "constructor" are simply unknown) ----------
  function index(cat) {
    if (cat._ix) return cat._ix;
    const ix = { up: Object.create(null), item: Object.create(null), hull: Object.create(null), market: Object.create(null) };
    cat.upgrades.forEach((u) => (ix.up[u.id] = u));
    cat.items.forEach((i) => (ix.item[i.id] = i));
    cat.hulls.forEach((h) => (ix.hull[h.id] = h));
    cat.markets.forEach((m) => (ix.market[m.id] = m));
    Object.defineProperty(cat, '_ix', { value: ix, enumerable: false });
    return ix;
  }
  const up = (cat, id) => index(cat).up[id] || fail('Unknown project.');
  const item = (cat, id) => index(cat).item[id] || fail('Unknown item.');
  const market = (cat, st) => index(cat).market[st.market] || cat.markets[0];
  const hullId = (h) => (HULLS.includes(h) ? h : fail('Unknown ship.'));
  const installed = (st, id) => has(st.projects, id) && st.projects[id].status === 'installed';
  const found = (st) => !!st.hulls.shuttle.found;
  // GM ruling 2026-09-30: the shuttle is found buried under wreckage. It stays docked until every recovery project is installed.
  const repairsLeft = (cat, st) => cat.upgrades.filter((u) => u.hull === 'shuttle' && u.recovery && !installed(st, u.id));
  const flightReady = (cat, st) => repairsLeft(cat, st).length === 0;
  // Name to use in text: the shuttle stays "Hangar bay" until it is discovered.
  const hullLabel = (cat, st, hull) => (hull === 'shuttle' && !found(st) ? index(cat).hull.shuttle.sealedName : index(cat).hull[hull].name);

  // ---------- state ----------
  function blankProject(u) {
    return { revealed: !!u.startsRevealed, questDone: false, status: 'planned', paid: { gp: 0, kits: 0, pu: 0 }, parts: u.components.map(() => 0), partItem: u.components.map(() => null), partFab: u.components.map(() => 0), extraDays: 0, daysLeft: 0 };
  }

  function createState(cat, overrides) {
    const ix = index(cat);
    const st = {
      schema: SCHEMA, revision: 0, label: 'Session 15 — arrival at the Kex', day: 1, market: (cat.markets.find((m) => m.multiplier === 1) || cat.markets[0]).id,
      treasury: 0, rawChunks: 0, refinedDisks: 0, kits: 0, inventory: {}, patterns: [], crew: ['Party fund'],
      hulls: {
        kex: { charge: ix.hull.kex.startCharge, mode: 'active', strain: 0 },
        shuttle: { charge: ix.hull.shuttle.startCharge, mode: 'docked', strain: 1, found: false, leyAccess: false },
      },
      reactorFuel: 0, hangarRewardGiven: false, channeled: {}, projects: {}, log: [], codexPatterns: [], materials: {},
      decoding: { kex: null, shuttle: null },
    };
    cat.upgrades.forEach((u) => (st.projects[u.id] = blankProject(u)));
    return Object.assign(st, overrides || {});
  }

  // Strict loader for anything untrusted (saved games, imported files, the published record).
  // Every field is coerced to its type; unknown ids and malformed values are dropped.
  const numIn = (x, lo, hi, dflt) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, round2(x))) : dflt);
  const intIn = (x, lo, hi, dflt) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.floor(x))) : dflt);
  const str = (x, max, dflt) => (typeof x === 'string' ? x.slice(0, max) : dflt);
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

  function normalize(cat, raw) {
    const ix = index(cat);
    const r = obj(raw);
    const st = createState(cat);
    st.schema = SCHEMA;
    st.revision = intIn(r.revision, 0, 1e9, 0);
    st.label = str(r.label, 160, st.label);
    st.day = intIn(r.day, 1, CAP.day, 1);
    st.market = typeof r.market === 'string' && ix.market[r.market] ? r.market : st.market;
    st.treasury = numIn(r.treasury, 0, CAP.gold, 0);
    st.rawChunks = intIn(r.rawChunks, 0, CAP.count, 0);
    st.refinedDisks = intIn(r.refinedDisks, 0, CAP.count, 0);
    st.kits = intIn(r.kits, 0, CAP.count, 0);
    st.reactorFuel = numIn(r.reactorFuel, 0, REACTOR_CASK_PU, 0);
    st.hangarRewardGiven = r.hangarRewardGiven === true;
    if (Array.isArray(r.crew)) {
      const crew = [...new Set(r.crew.filter((c) => typeof c === 'string').map((c) => c.trim().slice(0, 40)).filter(Boolean))].slice(0, 24);
      if (crew.length) st.crew = crew;
    }
    Object.entries(obj(r.inventory)).forEach(([k, q]) => { if (ix.item[k]) { const n = intIn(q, 0, CAP.count, 0); if (n) st.inventory[k] = n; } });
    if (Array.isArray(r.patterns)) st.patterns = [...new Set(r.patterns.filter((p) => typeof p === 'string' && ix.item[p] && !ix.item[p].protected && ix.item[p].replicaPu))].slice(0, ARCHIVE_CAP);
    if (Array.isArray(r.codexPatterns) && cat.itemRules) {
      const seen = new Set();
      st.codexPatterns = r.codexPatterns.filter((p) => p && typeof p.name === 'string' && p.name.trim() && has(cat.itemRules.rarity, p.rarity) && p.rarity !== 'artifact')
        .map((p) => ({ name: p.name.trim().slice(0, 80), rarity: p.rarity, consumable: p.consumable === true }))
        .filter((p) => { const k = p.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, Math.max(0, ARCHIVE_CAP - st.patterns.length));
    }
    const knownMaterial = new Set((cat.materials || []).map((m) => m.id));
    Object.entries(obj(r.materials)).forEach(([k, v]) => { if (knownMaterial.has(k)) { const n = intIn(v, 0, CAP.count, 0); if (n) st.materials[k] = n; } });
    const rp = obj(r.projects);
    cat.upgrades.forEach((u) => {
      const p0 = obj(has(rp, u.id) ? rp[u.id] : null);
      const p = st.projects[u.id];
      if (typeof p0.revealed === 'boolean') p.revealed = p0.revealed;
      p.questDone = p0.questDone === true;
      p.status = STATUSES.includes(p0.status) ? p0.status : 'planned';
      const paid = obj(p0.paid);
      p.paid = { gp: numIn(paid.gp, 0, u.gp, 0), kits: intIn(paid.kits, 0, u.kits, 0), pu: numIn(paid.pu, 0, u.pu, 0) };
      const parts = Array.isArray(p0.parts) ? p0.parts : []; const pi = Array.isArray(p0.partItem) ? p0.partItem : [];
      p.parts = u.components.map((c, i) => intIn(parts[i], 0, c.qty, 0));
      p.partItem = u.components.map((c, i) => (typeof pi[i] === 'string' && c.options.includes(pi[i]) ? pi[i] : null));
      const pf = Array.isArray(p0.partFab) ? p0.partFab : [];
      p.partFab = u.components.map((c, i) => intIn(pf[i], 0, p.parts[i], 0));
      p.extraDays = numIn(p0.extraDays, 0, 1e4, 0);
      p.daysLeft = p.status === 'building' ? numIn(p0.daysLeft, 0, 1e4, u.days) : 0;
    });
    const rh = obj(r.hulls);
    HULLS.forEach((h) => {
      const src = obj(rh[h]); const dst = st.hulls[h];
      dst.charge = numIn(src.charge, 0, capacity(cat, st, h), dst.charge);
      const mode = h === 'kex' && src.mode === 'dormant' ? 'cold' : src.mode;
      dst.mode = MODES[h].includes(mode) ? mode : dst.mode;
      dst.strain = intIn(src.strain, 0, 3, dst.strain);
    });
    st.hulls.shuttle.found = obj(rh.shuttle).found === true || installed(st, 'k_hangar');
    if (installed(st, 'k_hangar') && obj(rh.shuttle).found !== true) cat.upgrades.filter((u) => u.hull === 'shuttle' && u.tier <= 2).forEach((u) => (st.projects[u.id].revealed = true));
    st.hulls.shuttle.leyAccess = obj(rh.shuttle).leyAccess === true;
    if (!flightReady(cat, st)) st.hulls.shuttle.mode = 'docked';
    Object.entries(obj(r.channeled)).forEach(([k, v]) => { if (/^c:[^\s].{0,39}$/.test(k)) st.channeled[k] = intIn(v, 0, CHANNEL_CAP, 0); });
    if (Array.isArray(r.log)) {
      st.log = r.log.filter((l) => l && typeof l === 'object').slice(0, LOG_LIMIT).map((l) => ({
        day: intIn(l.day, 1, 1e6, 1), who: str(l.who, 60, ''), text: str(l.text, 600, ''), kind: LOG_KINDS.includes(l.kind) ? l.kind : 'info',
      })).filter((l) => l.text);
    }
    // Schematics being decoded: one per ship, only hidden ones the players may decode (anything else is dropped).
    st.decoding = { kex: null, shuttle: null };
    HULLS.forEach((h) => {
      const d = obj(obj(r.decoding)[h]); const u = typeof d.id === 'string' && has(ix.up, d.id) ? ix.up[d.id] : null;
      if (u && u.hull === h && !st.projects[u.id].revealed && !u.gmHeld && !u.tbd) st.decoding[h] = { id: u.id, daysLeft: numIn(d.daysLeft, 0.01, DECODE.daysPerTier * 5, 1) };
    });
    return st;
  }

  // ---------- derived values ----------
  const anyMet = (st, groups) => (groups || []).every((g) => g.some((id) => installed(st, id)));
  const hasCore = (st) => installed(st, 's_inverse_pair') || installed(st, 's_inverse_salvage');

  function capacity(cat, st, hull) {
    const base = index(cat).hull[hull].baseCapacity;
    return base + cat.upgrades.filter((u) => u.hull === hull && u.capacityPu && installed(st, u.id)).reduce((s, u) => s + u.capacityPu, 0);
  }

  function slotCapacity(cat, st, hull) {
    return index(cat).hull[hull].baseSlots + cat.upgrades.filter((u) => u.hull === hull && u.slotCapacity && installed(st, u.id)).reduce((s, u) => s + u.slotCapacity, 0);
  }
  function slotsUsed(cat, st, hull) {
    return cat.upgrades.filter((u) => u.hull === hull && u.slots && ['installed', 'building'].includes(st.projects[u.id].status)).reduce((s, u) => s + u.slots, 0);
  }

  function generation(cat, st, hull) {
    const parts = [];
    if (hull === 'kex' && st.hulls.kex.mode === 'cold') return { total: 0, parts: [{ label: 'Cold storage — array offline', pu: 0 }] };
    let raw = 0; // unrounded output, so the relay bonus is computed exactly (each day: 16.667 x 1.25 = 20.83)
    const add = (label, pu) => { raw += pu; parts.push({ label, pu: round2(pu) }); };
    cat.upgrades.filter((u) => u.hull === hull && u.generationPu && installed(st, u.id)).forEach((u) => {
      if (u.generationCondition === 'reactor_fueled') { if (st.reactorFuel > 0) add('Reactor cask', Math.min(st.reactorFuel, REACTOR_CASK_PU / REACTOR_DAYS)); }
      else if (u.generationCondition === 'ley') { if (st.hulls.shuttle.leyAccess && hasCore(st)) add('Ley intake', u.generationPu); }
      else add(u.id === 'k_fog_cloak' ? 'Regulator trickle' : u.name, u.generationPu);
    });
    // Power relays (GM ruling 2026-09-30): they used to run through the armory section. With an armory back in place
    // they run properly again and the Kex makes a quarter more power.
    const bonus = index(cat).hull[hull].relayBonus;
    const extra = bonus && relaysRestored(cat, st, hull) ? raw * (bonus.factor - 1) : 0;
    if (round2(extra) > 0) parts.push({ label: `Relays restored through the armory (+${Math.round((bonus.factor - 1) * 100)}%)`, pu: round2(extra) });
    return { total: round2(raw + extra), parts };
  }
  const relaysRestored = (cat, st, hull) => { const b = index(cat).hull[hull].relayBonus; return !!b && b.by.some((id) => installed(st, id)); };

  function draw(cat, st, hull) {
    const h = st.hulls[hull];
    const systems = cat.upgrades.filter((u) => u.hull === hull && u.dailyPu > 0 && installed(st, u.id));
    const extras = systems.map((u) => ({ label: u.name, pu: u.dailyPu }));
    let parts;
    if (hull === 'kex') {
      if (h.mode === 'cold') return { total: 0, parts: [{ label: 'Cold storage — systems off, cloak down', pu: 0 }] };
      parts = [{ label: 'Base systems', pu: index(cat).hull.kex.baseDailyPu }].concat(extras);
    } else if (h.mode === 'docked') {
      return { total: 0, parts: [{ label: 'Docked — powered down', pu: 0 }] };
    } else if (h.mode === 'standby') {
      parts = [{ label: 'Occupied standby', pu: 2 }].concat(extras);
    } else {
      parts = [{ label: 'Operating day (flight, life support, cleaning)', pu: index(cat).hull.shuttle.baseDailyPu }].concat(extras);
    }
    return { total: round2(parts.reduce((s, p) => s + p.pu, 0)), parts };
  }

  function power(cat, st, hull) {
    const g = generation(cat, st, hull);
    const d = draw(cat, st, hull);
    const net = round2(g.total - d.total);
    const charge = st.hulls[hull].charge;
    return { charge, capacity: capacity(cat, st, hull), generation: g, draw: d, net, daysLeft: net < 0 ? Math.floor(charge / -net) : Infinity };
  }

  function tier(cat, st, hull) {
    let t = 1;
    for (const row of index(cat).hull[hull].tiers) if (row.requires.every((id) => installed(st, id)) && anyMet(st, row.requiresAny)) t = Math.max(t, row.tier);
    return t;
  }

  function teams(st) { return { bay: 1 + (installed(st, 'k_clean_forge') ? 1 : 0) }; }
  function busyTeams(cat, st) { return cat.upgrades.filter((u) => st.projects[u.id].status === 'building').length; }

  function buyPrice(cat, st, gp) { return Math.ceil(gp * market(cat, st).multiplier); }
  // Generic kits keep their catalog price everywhere (GM workshop notes).
  function kitPrice(cat) { return cat.economy.materialUnitGp; }
  function chunkPrice(cat, st) { return round2((cat.economy.rawGpPerLb / cat.economy.rawChunksPerLb) * market(cat, st).multiplier); }
  const puPerChunk = (cat) => cat.economy.rawPuPerLb / cat.economy.rawChunksPerLb;

  function buyBlock(cat, st, itemId, gm) {
    const i = item(cat, itemId);
    if (i.availability === 'quest') return 'Not for sale — must be found or earned';
    if (i.availability === 'limited' && !gm) return 'Limited stock — the GM confirms a seller';
    return '';
  }

  function canFabricate(cat, st, itemId) {
    const i = item(cat, itemId);
    if (i.protected || !i.replicaPu) return 'Cannot be copied';
    if (!installed(st, 'k_pattern_archive')) return 'Needs the pattern archive';
    if (!st.patterns.includes(itemId)) return 'Pattern not learned';
    return '';
  }

  function itemValue(cat, rarity, consumable) {
    const R = cat.itemRules && has(cat.itemRules.rarity, rarity) ? cat.itemRules.rarity[rarity] : fail('Unknown rarity.');
    const k = consumable ? cat.itemRules.consumable : 1;
    const copyable = rarity !== 'artifact';
    return { fuel: round2(R.fuel * k), learnPu: copyable ? round2(R.learnPu * k) : 0, copyable,
      blueprint: copyable ? { gp: Math.round(R.gp * k), kits: Math.ceil(R.kits * k), pu: round2(R.pu * k), days: round2(Math.max(0.25, R.days * k)) } : null };
  }
  const patternCount = (st) => st.patterns.length + (st.codexPatterns || []).length;

  const hasContributions = (p) => p.paid.gp > 0 || p.paid.kits > 0 || p.paid.pu > 0 || p.parts.some((n) => n > 0);

  // Recipes in the same exclusive group install the same system; once one is started (or supplied), the others lock.
  function exclusiveBlock(cat, st, id) {
    const u = up(cat, id);
    if (!u.exclusiveGroup) return '';
    const other = cat.upgrades.find((x) => x.id !== id && x.exclusiveGroup === u.exclusiveGroup && (st.projects[x.id].status !== 'planned' || hasContributions(st.projects[x.id])));
    return other ? `Alternative recipe already chosen: ${other.name}` : '';
  }

  function missingPrereqs(cat, st, u) {
    const out = u.requires.filter((r) => !installed(st, r)).map((r) => ({ ids: [r], label: up(cat, r).name }));
    (u.requiresAny || []).forEach((g) => { if (!g.some((id) => installed(st, id))) out.push({ ids: g, label: g.map((id) => up(cat, id).name).join(' or ') }); });
    return out;
  }

  function projectStatus(cat, st, id, gm) {
    const u = up(cat, id);
    const p = st.projects[id];
    const hidden = !p.revealed || (u.hull === 'shuttle' && !found(st));
    const missing = missingPrereqs(cat, st, u);
    const need = {
      gp: round2(Math.max(0, u.gp - p.paid.gp)),
      kits: Math.max(0, u.kits - p.paid.kits),
      pu: round2(Math.max(0, u.pu - p.paid.pu)),
      parts: u.components.map((c, i) => Math.max(0, c.qty - p.parts[i])),
      quest: !!u.quest && !p.questDone,
    };
    const totalUnits = u.gp + u.kits * 100 + u.pu * 10 + u.components.reduce((s, c) => s + c.qty * 500, 0) + (u.quest ? 1000 : 0);
    const doneUnits = Math.min(u.gp, p.paid.gp) + Math.min(u.kits, p.paid.kits) * 100 + Math.min(u.pu, p.paid.pu) * 10 +
      u.components.reduce((s, c, i) => s + Math.min(c.qty, p.parts[i]) * 500, 0) + (u.quest && p.questDone ? 1000 : 0);
    const funded = need.gp === 0 && need.kits === 0 && need.pu === 0 && need.parts.every((n) => n === 0) && !need.quest;
    let state;
    if (p.status === 'installed') state = 'installed';
    else if (p.status === 'building') state = 'building';
    else if (hidden && !gm) state = 'classified';
    else if (u.tbd) state = 'unknown'; // not worked out yet (GM): no price, no work
    else if (missing.length) state = 'locked';
    else if (funded) state = 'ready';
    else state = doneUnits > 0 ? 'funding' : 'open';
    return { id, u, p, state, hidden, missingPrereqs: missing, need, funded, exclusive: exclusiveBlock(cat, st, id), progress: p.status === 'installed' ? 1 : totalUnits ? doneUnits / totalUnits : 1, workDays: round2(u.days + (p.extraDays || 0)) };
  }

  // ---------- action plumbing ----------
  const entry = (st, who, text, kind) => ({ day: st.day, who: String(who || '').slice(0, 60), text: String(text).slice(0, 600), kind: kind || 'info' });
  function checkBounds(st) {
    const over = st.treasury > CAP.gold || [st.rawChunks, st.refinedDisks, st.kits].some((n) => n > CAP.count) || Object.values(st.inventory).some((n) => n > CAP.count);
    if (over) fail('That is more than the ledger can hold.');
  }
  function commit(st, entries) {
    checkBounds(st);
    const list = Array.isArray(entries) ? entries : [entries];
    st.log = list.concat(st.log).slice(0, LOG_LIMIT);
    return { state: st, log: list };
  }
  // Very large requests are clamped (then limited by what is needed or affordable); nonsense is refused.
  function whole(n, what) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || Math.floor(n) !== n) fail(`Enter a whole number of ${what}.`);
    return Math.min(n, MAX_AMOUNT);
  }
  function amount(n, what) {
    if (typeof n !== 'number' || !Number.isFinite(n)) fail(`Enter an amount of ${what}.`);
    const r = round2(Math.min(n, MAX_AMOUNT));
    if (r < 0.01) fail(`Enter at least 0.01 ${what}.`);
    return r;
  }
  const decodeCost = (cat, id) => { const u = up(cat, id); return { pu: DECODE.puPerTier * u.tier, days: DECODE.daysPerTier * u.tier }; };
  function decodeBlock(cat, st, id) {
    const u = up(cat, id); const c = decodeCost(cat, id);
    if (st.projects[id].revealed) return 'Already decoded.';
    if (u.gmHeld || u.tbd) return 'Out of reach for now: your GM reveals this one.';
    if (u.hull === 'shuttle' && !found(st)) return 'Nothing to decode there yet — the hangar is still sealed.';
    const d = st.decoding[u.hull];
    if (d && d.id === id) return 'Already being decoded.';
    if (d) return 'Already decoding another schematic on this ship.';
    if (st.hulls[u.hull].charge < c.pu) return `Needs ${fmt(c.pu)} PU in the reserve.`;
    return '';
  }

  function openProject(cat, st, id) {
    const s = projectStatus(cat, st, id, true);
    if (s.u.hull === 'shuttle' && !found(st)) fail('Nothing to work on there yet — the hangar is still sealed.');
    if (s.u.tbd) fail(`${s.u.name}: not worked out yet. Your GM sets its cost when the time comes.`);
    if (s.state === 'installed') fail(`${s.u.name} is already installed.`);
    if (s.state === 'building') fail(`${s.u.name} is already under construction.`);
    if (s.missingPrereqs.length) fail(`${s.u.name} needs ${s.missingPrereqs.map((m) => m.label).join(', ')} first.`);
    if (s.exclusive) fail(s.exclusive);
    return s;
  }
  function spendCharge(cat, st, hull, pu) {
    const h = st.hulls[hull];
    if (h.charge + 1e-9 < pu) fail(`${hullLabel(cat, st, hull)} only holds ${round2(h.charge)} PU.`);
    h.charge = round2(h.charge - pu);
  }
  function addCharge(cat, st, hull, pu) {
    const cap = capacity(cat, st, hull);
    const room = round2(cap - st.hulls[hull].charge);
    if (pu > room + 1e-9) fail(`${hullLabel(cat, st, hull)} only has room for ${Math.max(0, room)} more PU (capacity ${cap}).`);
    st.hulls[hull].charge = round2(st.hulls[hull].charge + pu);
  }
  // Adds what fits; returns the amount that did not fit.
  function bank(cat, st, hull, pu) {
    const room = Math.max(0, round2(capacity(cat, st, hull) - st.hulls[hull].charge));
    const put = Math.min(room, pu);
    st.hulls[hull].charge = round2(st.hulls[hull].charge + put);
    return round2(pu - put);
  }
  function takeItem(st, itemId, qty) {
    if ((has(st.inventory, itemId) ? st.inventory[itemId] : 0) < qty) fail('Not enough of that item in the hold.');
    st.inventory[itemId] -= qty;
    if (!st.inventory[itemId]) delete st.inventory[itemId];
  }
  function giveItem(st, itemId, qty) { st.inventory[itemId] = (has(st.inventory, itemId) ? st.inventory[itemId] : 0) + qty; }
  function pay(st, gp) {
    if (st.treasury + 1e-9 < gp) fail(`The treasury holds only ${fmt(st.treasury)} gp of coin.`);
    st.treasury = round2(st.treasury - gp);
  }
  const channelKey = (name) => `c:${name.toLowerCase()}`;

  // ---------- project contributions ----------
  const actions = Object.create(null);

  actions.payGold = (cat, st0, { id, gp, who }) => {
    const st = clone(st0); const s = openProject(cat, st, id);
    const amt = Math.min(amount(gp, 'gold'), s.need.gp);
    if (amt <= 0) fail('The precious-metal feedstock is already supplied.');
    pay(st, amt); st.projects[id].paid.gp = round2(st.projects[id].paid.gp + amt);
    return commit(st, entry(st, who, `fed ${fmt(amt)} gp of coin into the smelter for ${s.u.name} (precious-metal feedstock).`, 'gold'));
  };

  actions.giveKits = (cat, st0, { id, qty, who, buy }) => {
    const st = clone(st0); const s = openProject(cat, st, id);
    const n = Math.min(whole(qty, 'kits'), s.need.kits);
    if (n <= 0) fail('Fabrication kits are already supplied.');
    let note = '';
    if (buy) { const cost = kitPrice(cat) * n; pay(st, cost); note = ` (bought for ${fmt(cost)} gp)`; }
    else { if (st.kits < n) fail(`The hold has only ${st.kits} fabrication kits.`); st.kits -= n; }
    st.projects[id].paid.kits += n;
    return commit(st, entry(st, who, `supplied ${n} fabrication kit${n > 1 ? 's' : ''}${note} to ${s.u.name}.`, 'kits'));
  };

  // source: 'kex' | 'shuttle' (stored charge) | 'raw' (feed chunks straight in)
  actions.givePower = (cat, st0, { id, pu, source, chunks, who }) => {
    const st = clone(st0); const s = openProject(cat, st, id);
    if (s.need.pu <= 0) fail('Commissioning power is already supplied.');
    if (!['kex', 'shuttle', 'raw'].includes(source)) fail('Choose where the power comes from.');
    let amt; let text;
    if (source === 'raw') {
      whole(chunks, 'chunks');
      if (st.rawChunks < chunks) fail(`The hold has only ${st.rawChunks} raw chunks.`);
      const useful = Math.min(chunks, Math.ceil(s.need.pu / puPerChunk(cat)));
      st.rawChunks -= useful;
      const energy = useful * puPerChunk(cat);
      amt = round2(Math.min(s.need.pu, energy));
      text = `fed ${useful} raw ether chunk${useful > 1 ? 's' : ''} (${fmt(amt)} PU) into ${s.u.name}.`;
      const spare = round2(energy - amt);
      if (spare > 0) {
        const lost = bank(cat, st, 'kex', spare);
        text += lost > 0 ? ` ${fmt(spare - lost)} PU left over went to the Kex reserve; ${fmt(lost)} PU was lost (reserve full).` : ` ${fmt(spare)} PU left over went to the Kex reserve.`;
      }
    } else {
      if (source === 'shuttle' && !found(st)) fail('No such reserve.');
      amt = Math.min(amount(pu, 'power'), s.need.pu);
      spendCharge(cat, st, source, amt);
      text = `routed ${fmt(amt)} PU from ${hullLabel(cat, st, source)}'s reserve into ${s.u.name}.`;
    }
    st.projects[id].paid.pu = round2(st.projects[id].paid.pu + amt);
    return commit(st, entry(st, who, text, 'power'));
  };

  // route: 'owned' | 'buy' | 'fabricate'
  actions.givePart = (cat, st0, { id, line, itemId, qty, route, who, gm }) => {
    const st = clone(st0); const s = openProject(cat, st, id);
    if (typeof line !== 'number' || !s.u.components[line]) fail('Unknown component line.');
    const comp = s.u.components[line];
    if (!comp.options.includes(itemId)) fail('That item does not fit this component.');
    const locked = st.projects[id].partItem[line];
    if (locked && locked !== itemId) fail(`This line is already being filled with ${item(cat, locked).name}. One item type per line.`);
    const n = Math.min(whole(qty, 'units'), s.need.parts[line]);
    if (n <= 0) fail('That component is already supplied.');
    const it = item(cat, itemId);
    let text;
    if (route === 'owned') {
      takeItem(st, itemId, n);
      text = `installed ${n} × ${it.name} from the hold into ${s.u.name}.`;
    } else if (route === 'buy') {
      const why = buyBlock(cat, st, itemId, gm); if (why) fail(why);
      const cost = buyPrice(cat, st, it.marketGp) * n; pay(st, cost);
      text = `bought ${n} × ${it.name} for ${fmt(cost)} gp and installed ${n > 1 ? 'them' : 'it'} in ${s.u.name}.`;
    } else if (route === 'fabricate') {
      const why = canFabricate(cat, st, itemId); if (why) fail(why);
      const kitsNeeded = (it.replicaKits || 0) * n;
      if (st.kits < kitsNeeded) fail(`Fabricating ${n} needs ${kitsNeeded} fabrication kits; the hold has ${st.kits}.`);
      pay(st, it.replicaGp * n); spendCharge(cat, st, 'kex', it.replicaPu * n); st.kits -= kitsNeeded;
      st.projects[id].extraDays = round2((st.projects[id].extraDays || 0) + it.replicaDays * n);
      st.projects[id].partFab[line] += n;
      text = `fabricated ${n} hull-bound ${it.name} equivalent${n > 1 ? 's' : ''} for ${s.u.name} (${fmt(it.replicaGp * n)} gp of coin metal, ${kitsNeeded} kits, ${fmt(it.replicaPu * n)} PU, +${fmt(it.replicaDays * n)} work days).`;
    } else fail('Unknown supply route.');
    st.projects[id].parts[line] += n;
    st.projects[id].partItem[line] = itemId;
    return commit(st, entry(st, who, text, 'part'));
  };

  actions.setQuest = (cat, st0, { id, done, who }) => {
    const st = clone(st0); const u = up(cat, id);
    if (!u.quest) fail('This project has no field objective.');
    if (u.hull === 'shuttle' && !found(st)) fail('Nothing to work on there yet — the hangar is still sealed.');
    if (st.projects[id].status === 'installed') fail('That system is already installed.');
    st.projects[id].questDone = !!done;
    return commit(st, entry(st, who, done ? `completed the objective for ${u.name}: ${u.quest}` : `reopened the objective for ${u.name}.`, done ? 'quest' : 'gm'));
  };

  actions.startWork = (cat, st0, { id, who }) => {
    const st = clone(st0); const s = openProject(cat, st, id);
    if (!s.funded) fail('Everything on the checklist must be supplied first.');
    if (busyTeams(cat, st) >= teams(st).bay) fail('Every work team is busy. Wait for a project to finish, or install isolated fabrication cells for a second team.');
    if (s.u.slots) {
      const cap = slotCapacity(cat, st, s.u.hull); const used = slotsUsed(cat, st, s.u.hull);
      if (used + s.u.slots > cap) fail(`${hullLabel(cat, st, s.u.hull)} has ${cap - used} free system slot${cap - used === 1 ? '' : 's'}; ${s.u.name} needs ${s.u.slots}.`);
    }
    const p = st.projects[id]; p.status = 'building'; p.daysLeft = s.workDays;
    return commit(st, entry(st, who, `started work on ${s.u.name} — ${fmt(s.workDays)} work day${s.workDays === 1 ? '' : 's'}.`, 'build'));
  };

  // Finishing installs the project and applies one-time effects (the hangar reveal).
  function install(cat, st, id) {
    const u = up(cat, id); const p = st.projects[id];
    p.status = 'installed'; p.daysLeft = 0; p.revealed = true;
    const out = [entry(st, u.hull === 'kex' ? 'Kubix' : index(cat).hull.shuttle.ai, `${u.name} commissioned. ${u.summary}`, 'install')];
    if (id === 'k_hangar' && !st.hangarRewardGiven) {
      st.hangarRewardGiven = true;
      st.hulls.shuttle.found = true;
      cat.upgrades.filter((x) => x.hull === 'shuttle' && x.tier <= 2).forEach((x) => (st.projects[x.id].revealed = true));
      st.kits += HANGAR_REWARD.kits;
      Object.entries(HANGAR_REWARD.items).forEach(([k, q]) => giveItem(st, k, q));
      out.push(entry(st, 'Kubix', `Hangar open. Inside: a shuttle with its own intelligence, buried under the fallen framing. It will not fly until it is dug out, surveyed and repaired. Also stores — ${HANGAR_REWARD.kits} fabrication kits, 2 repair-drone chassis and 1 uncharged power cell.`, 'reveal'));
    }
    if (id === 'k_hangar') st.hulls.shuttle.found = true;
    // Reveal anything that just became reachable next to a revealed tree (one tier up), but never a schematic whose
    // other prerequisites are still encrypted: those wait for the GM (e.g. the emitter array, which also needs the cloak).
    const known = (r) => st.projects[r].revealed;
    cat.upgrades.filter((x) => x.hull === u.hull && !x.tbd && (x.requires.includes(id) || (x.requiresAny || []).some((g) => g.includes(id))) && x.tier <= u.tier + 1 && (x.hull === 'kex' || found(st))
      && x.requires.every(known) && (x.requiresAny || []).every((g) => g.some(known)))
      .forEach((x) => (st.projects[x.id].revealed = true));
    return out;
  }

  actions.finishNow = (cat, st0, { id }) => {
    const st = clone(st0); up(cat, id);
    if (st.projects[id].status !== 'building') fail('Only a project under construction can be finished.');
    return commit(st, install(cat, st, id));
  };

  // GM: return everything supplied to an unfinished project (e.g. the unchosen core recipe).
  actions.refundProject = (cat, st0, { id }) => {
    const st = clone(st0); const u = up(cat, id); const p = st.projects[id];
    if (p.status !== 'planned') fail('Only a project that has not started work can be refunded.');
    if (!hasContributions(p)) fail('Nothing has been supplied to this project.');
    st.treasury = round2(st.treasury + p.paid.gp);
    st.kits += p.paid.kits;
    const lost = bank(cat, st, 'kex', p.paid.pu);
    // Real items go back to the hold; hull-bound fabricated replicas cannot become wearable items, so they are scrapped.
    let returned = 0; let scrapped = 0;
    p.parts.forEach((n, i) => { const fab = Math.min(n, p.partFab[i] || 0); if (n - fab > 0 && p.partItem[i]) { giveItem(st, p.partItem[i], n - fab); returned += n - fab; } scrapped += fab; });
    const back = `${fmt(p.paid.gp)} gp, ${p.paid.kits} kits, ${fmt(p.paid.pu - lost)} PU to the Kex reserve${lost ? ` (${fmt(lost)} PU lost, reserve full)` : ''} and ${returned} parts${scrapped ? `; ${scrapped} fabricated replica${scrapped > 1 ? 's' : ''} scrapped` : ''}`;
    Object.assign(p, { paid: { gp: 0, kits: 0, pu: 0 }, parts: u.components.map(() => 0), partItem: u.components.map(() => null), partFab: u.components.map(() => 0), extraDays: 0 });
    return commit(st, entry(st, 'GM', `refunded ${u.name}: ${back} returned to the hold.`, 'gm'));
  };

  // ---------- daily tick ----------
  actions.advanceDay = (cat, st0) => {
    const st = clone(st0);
    st.day = Math.min(st.day + 1, CAP.day);
    const dayEntry = entry(st, '', `Day ${st.day} begins.`, 'day');
    const out = [];
    for (const hull of HULLS) {
      if (hull === 'shuttle' && !found(st)) continue;
      const pw = power(cat, st, hull);
      const next = round2(pw.charge + pw.net);
      if (next < 0) out.push(entry(st, hull === 'kex' ? 'Kubix' : index(cat).hull.shuttle.ai, `${hullLabel(cat, st, hull)} ran dry: needed ${fmt(-pw.net)} PU, had ${fmt(pw.charge)}. Systems browned out overnight.`, 'warn'));
      st.hulls[hull].charge = Math.max(0, Math.min(pw.capacity, next));
    }
    if (installed(st, 'k_reactor') && st.reactorFuel > 0 && st.hulls.kex.mode !== 'cold') st.reactorFuel = round2(Math.max(0, st.reactorFuel - REACTOR_CASK_PU / REACTOR_DAYS));
    for (const u of cat.upgrades.filter((x) => st.projects[x.id].status === 'building')) {
      const p = st.projects[u.id];
      p.daysLeft = round2(p.daysLeft - 1);
      if (p.daysLeft <= 0) out.push(...install(cat, st, u.id));
    }
    // Decoding (GM request 2026-10-01): a day's work each; paused while the Kex is in cold storage.
    for (const h of HULLS) {
      const d = st.decoding[h]; if (!d) continue;
      if (st.projects[d.id].revealed) { st.decoding[h] = null; continue; }
      if (h === 'kex' && st.hulls.kex.mode === 'cold') continue;
      d.daysLeft = round2(d.daysLeft - 1);
      if (d.daysLeft <= 0) {
        const u = up(cat, d.id); st.projects[d.id].revealed = true; st.decoding[h] = null;
        out.push(entry(st, h === 'kex' ? 'Kubix' : index(cat).hull.shuttle.ai, `Schematic decoded: ${u.name}. ${u.summary} Everything it needs is on its page now.`, 'reveal'));
      }
    }
    st.channeled = {};
    // Log is newest-first: the day marker sits under that day's events.
    return commit(st, out.reverse().concat([dayEntry]));
  };

  // ---------- decoding encrypted schematics ----------
  actions.beginDecode = (cat, st0, { id, who }) => {
    const st = clone(st0); const u = up(cat, id);
    const why = decodeBlock(cat, st, id); if (why) fail(why);
    const c = decodeCost(cat, id);
    st.hulls[u.hull].charge = round2(st.hulls[u.hull].charge - c.pu);
    st.decoding[u.hull] = { id, daysLeft: c.days };
    // The log never names a schematic before it is decoded.
    return commit(st, entry(st, who, `set ${u.hull === 'kex' ? 'Kubix' : index(cat).hull.shuttle.ai} to decode a tier-${u.tier} schematic: ${fmt(c.pu)} PU, ${fmt(c.days)} day${c.days === 1 ? '' : 's'}.`, 'power'));
  };
  actions.cancelDecode = (cat, st0, { hull, who }) => {
    const st = clone(st0); hullId(hull);
    if (!st.decoding[hull]) fail('Nothing is being decoded on that ship.');
    st.decoding[hull] = null;
    return commit(st, entry(st, who, 'stopped decoding a schematic (the power spent is gone).', 'power'));
  };

  // ---------- hold & workshop ----------
  actions.refuel = (cat, st0, { hull, chunks, disks, who }) => {
    const st = clone(st0); hullId(hull);
    if (hull === 'shuttle' && !found(st)) fail('No such reserve.');
    chunks = chunks || 0; disks = disks || 0;
    if (!chunks && !disks) fail('Choose raw chunks or refined disks to load.');
    if (chunks) { whole(chunks, 'chunks'); if (st.rawChunks < chunks) fail(`The hold has only ${st.rawChunks} raw chunks.`); }
    if (disks) { whole(disks, 'disks'); if (st.refinedDisks < disks) fail(`The hold has only ${st.refinedDisks} refined disks.`); }
    const pu = round2(chunks * puPerChunk(cat) + disks * cat.economy.refinedPuEach);
    addCharge(cat, st, hull, pu);
    st.rawChunks -= chunks; st.refinedDisks -= disks;
    const what = [chunks ? `${chunks} raw chunk${chunks > 1 ? 's' : ''}` : '', disks ? `${disks} refined disk${disks > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ');
    return commit(st, entry(st, who, `loaded ${what} into ${hullLabel(cat, st, hull)}: +${fmt(pu)} PU.`, 'power'));
  };

  actions.channel = (cat, st0, { hull, levels, caster, who }) => {
    const st = clone(st0); hullId(hull);
    if (hull === 'shuttle' && !found(st)) fail('No such reserve.');
    whole(levels, 'spell-slot levels');
    const name = String(caster || '').trim().slice(0, 40) || fail('Name the caster.');
    const key = channelKey(name);
    const used = has(st.channeled, key) ? st.channeled[key] : 0;
    if (used + levels > CHANNEL_CAP) fail(`${name} can channel only ${CHANNEL_CAP - used} more PU today (max ${CHANNEL_CAP} per caster per day).`);
    addCharge(cat, st, hull, levels);
    st.channeled[key] = used + levels;
    return commit(st, entry(st, name, `channeled ${levels} spell-slot level${levels > 1 ? 's' : ''} into ${hullLabel(cat, st, hull)} over a two-hour watch: +${levels} PU.`, 'power'));
  };

  actions.transfer = (cat, st0, { from, to, pu, who }) => {
    const st = clone(st0); hullId(from); hullId(to);
    if (!found(st)) fail('No second ship to transfer to.');
    if (from === to) fail('Choose two different ships.');
    const amt = amount(pu, 'power');
    spendCharge(cat, st, from, amt); addCharge(cat, st, to, amt);
    return commit(st, entry(st, who, `transferred ${fmt(amt)} PU from ${hullLabel(cat, st, from)} to ${hullLabel(cat, st, to)}.`, 'power'));
  };

  actions.recycle = (cat, st0, { itemId, who }) => {
    const st = clone(st0); const it = item(cat, itemId);
    if (it.protected || !it.salvagePu) fail(`${it.name} cannot be recycled.`);
    takeItem(st, itemId, 1);
    const lost = bank(cat, st, 'kex', it.salvagePu);
    return commit(st, entry(st, who, `fed ${it.name} to the Kex's intake for ${fmt(it.salvagePu - lost)} PU${lost ? ` (${fmt(lost)} PU lost — reserve full)` : ''}. It is gone.`, 'recycle'));
  };

  actions.learn = (cat, st0, { itemId, who }) => {
    const st = clone(st0); const it = item(cat, itemId);
    if (it.protected || !it.replicaPu) fail(`${it.name} cannot be copied.`);
    if (!installed(st, 'k_pattern_archive')) fail('Learning a pattern needs the pattern archive.');
    if (st.patterns.includes(itemId)) fail('That pattern is already in the archive.');
    if (patternCount(st) >= ARCHIVE_CAP) fail(`The archive is full (${ARCHIVE_CAP} patterns). Ask the GM about extra storage prisms.`);
    spendCharge(cat, st, 'kex', it.learnPu);
    takeItem(st, itemId, 1);
    st.patterns.push(itemId);
    return commit(st, entry(st, who, `sacrificed ${it.name} to the archive (${fmt(it.learnPu)} PU). Its pattern is learned; the item is destroyed.`, 'learn'));
  };

  actions.feedItem = (cat, st0, { name, rarity, consumable, mode, who, gm }) => {
    const st = clone(st0);
    const label = String(name || '').trim().slice(0, 80) || fail('Name the item.');
    const v = itemValue(cat, rarity, !!consumable);
    const unique = cat.items.find((i) => i.protected && i.name.toLowerCase() === label.toLowerCase());
    if (unique) fail(`${unique.name} is unique. It can only be installed, never fed to the intake or the archive.`);
    if (mode === 'recycle') {
      if (rarity === 'artifact' && !gm) fail('Artifacts are only fed to the intake if the GM allows it.');
      const lost = bank(cat, st, 'kex', v.fuel);
      return commit(st, entry(st, who, `fed ${label} to the intake for ${fmt(v.fuel - lost)} PU${lost ? ` (${fmt(lost)} PU lost, reserve full)` : ''}. It is gone.`, 'recycle'));
    }
    if (mode !== 'learn') fail('Choose recycle or learn.');
    if (!v.copyable) fail('Artifacts cannot be copied.');
    if (!installed(st, 'k_pattern_archive')) fail('Learning a pattern needs the pattern archive.');
    if (patternCount(st) >= ARCHIVE_CAP) fail(`The archive is full (${ARCHIVE_CAP} patterns). Ask the GM about extra storage prisms.`);
    const key = label.toLowerCase();
    const catItem = cat.items.find((i) => i.name.toLowerCase() === key && !i.protected && i.replicaPu);
    if (catItem ? st.patterns.includes(catItem.id) : st.codexPatterns.some((p) => p.name.toLowerCase() === key)) fail('That pattern is already in the archive.');
    spendCharge(cat, st, 'kex', v.learnPu);
    if (catItem) st.patterns.push(catItem.id); else st.codexPatterns.push({ name: label, rarity, consumable: !!consumable });
    const bp = v.blueprint;
    return commit(st, entry(st, who, `fed ${label} to the archive (${fmt(v.learnPu)} PU). It is destroyed; its pattern is learned. Blueprint per copy: ${fmt(bp.gp)} gp of coin metal, ${bp.kits} kits, ${fmt(bp.pu)} PU, ${fmt(bp.days)} days.`, 'learn'));
  };

  // ---------- material research: the replicator learns only the metals it is fed (GM ruling 2026-09-30) ----------
  const material = (cat, id) => (cat.materials || []).find((m) => m.id === id) || fail('Unknown material.');
  function materialStage(cat, st, id) {
    const m = material(cat, id);
    const fed = has(st.materials, id) ? st.materials[id] : 0;
    return m.startsKnown || fed >= m.researchBars ? 'analyzed' : fed > 0 ? 'sampled' : 'unknown';
  }
  // bars: bar-equivalents fed (an item counts as the bars it was forged from). The stock is destroyed.
  actions.feedMaterial = (cat, st0, { material: id, bars, who }) => {
    const st = clone(st0); const m = material(cat, id);
    const before = materialStage(cat, st, m.id);
    if (before === 'analyzed') fail(`Kubix already understands ${m.name}.`);
    const fed0 = has(st.materials, m.id) ? st.materials[m.id] : 0;
    const n = Math.min(whole(bars, 'bar-equivalents'), m.researchBars - fed0); // more than analysis needs is not taken
    const cost = round2(n * m.researchPu);
    spendCharge(cat, st, 'kex', cost);
    st.materials[m.id] = Math.min(CAP.count, (has(st.materials, m.id) ? st.materials[m.id] : 0) + n);
    const left = Math.max(0, m.researchBars - st.materials[m.id]);
    const uses = m.roles.length ? m.roles.map(([r, s]) => `${r} ${'★'.repeat(s)}`).join(', ') : 'no ship use';
    const what = `${n} bar-equivalent${n > 1 ? 's' : ''}`;
    const text = left === 0 ? `fed ${what} of ${m.name} to the analyzer (${fmt(cost)} PU). Kubix now understands ${m.name}: ${uses}.`
      : before === 'unknown' ? `fed ${what} of an unknown material to the analyzer (${fmt(cost)} PU). Kubix identifies it as ${m.name}; ${left} more to understand it.`
      : `fed ${what} of ${m.name} to the analyzer (${fmt(cost)} PU); ${left} more to understand it.`;
    return commit(st, entry(st, who, text, 'learn'));
  };

  actions.buyItem = (cat, st0, { itemId, qty, who, gm }) => {
    const st = clone(st0); const it = item(cat, itemId);
    whole(qty, 'units');
    const why = buyBlock(cat, st, itemId, gm); if (why) fail(why);
    const cost = buyPrice(cat, st, it.marketGp) * qty; pay(st, cost); giveItem(st, itemId, qty);
    return commit(st, entry(st, who, `bought ${qty} × ${it.name} for ${fmt(cost)} gp.`, 'gold'));
  };

  actions.buyKits = (cat, st0, { qty, who }) => {
    const st = clone(st0); whole(qty, 'kits');
    const cost = kitPrice(cat) * qty; pay(st, cost); st.kits += qty;
    return commit(st, entry(st, who, `bought ${qty} fabrication kit${qty > 1 ? 's' : ''} for ${fmt(cost)} gp.`, 'gold'));
  };

  actions.buyRaw = (cat, st0, { chunks, who }) => {
    const st = clone(st0); whole(chunks, 'chunks');
    const cost = round2(chunkPrice(cat, st) * chunks); pay(st, cost); st.rawChunks += chunks;
    return commit(st, entry(st, who, `bought ${chunks} raw ether chunk${chunks > 1 ? 's' : ''} (${fmt(chunks / cat.economy.rawChunksPerLb)} lb) for ${fmt(cost)} gp.`, 'gold'));
  };

  // ---------- GM tools ----------
  actions.reveal = (cat, st0, { id, revealed }) => {
    const st = clone(st0); const u = up(cat, id);
    st.projects[id].revealed = !!revealed;
    const name = u.hull === 'shuttle' && !found(st) ? 'a hangar schematic' : u.name;
    return commit(st, entry(st, 'GM', revealed ? `revealed a new schematic: ${name}.` : `hid ${name}.`, 'gm'));
  };

  actions.revealTier = (cat, st0, { hull, tier: t }) => {
    const st = clone(st0); hullId(hull);
    if (typeof t !== 'number' || t < 1 || t > 5) fail('Choose a tier 1–5.');
    const ids = cat.upgrades.filter((u) => u.hull === hull && u.tier === t && !u.tbd).map((u) => u.id);
    ids.forEach((id) => (st.projects[id].revealed = true));
    return commit(st, entry(st, 'GM', `revealed ${ids.length} tier-${t} schematic${ids.length === 1 ? '' : 's'} for ${hullLabel(cat, st, hull)}.`, 'gm'));
  };

  // field: treasury | rawChunks | refinedDisks | kits | reactorFuel | charge:<hull> | strain:<hull> | item:<id>
  actions.adjust = (cat, st0, { field, delta, reason }) => {
    const st = clone(st0);
    if (typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > MAX_AMOUNT) fail('Enter a non-zero change (up to 10 million).');
    delta = round2(delta);
    const why = reason ? ` (${String(reason).slice(0, 120)})` : '';
    const [kind, key] = String(field || '').split(':');
    let label; let after;
    const INT = ['rawChunks', 'refinedDisks', 'kits'];
    if (['treasury', 'rawChunks', 'refinedDisks', 'kits', 'reactorFuel'].includes(kind) && key === undefined) {
      if (INT.includes(kind) && Math.floor(delta) !== delta) fail('Use whole units.');
      after = round2(st[kind] + delta); if (after < 0) fail('That would go below zero.');
      if (kind === 'reactorFuel' && after > REACTOR_CASK_PU) fail(`A cask holds ${REACTOR_CASK_PU} PU.`);
      st[kind] = after; label = { treasury: 'treasury (gp)', rawChunks: 'raw chunks', refinedDisks: 'refined disks', kits: 'fabrication kits', reactorFuel: 'reactor fuel (PU)' }[kind];
    } else if (kind === 'charge' && HULLS.includes(key)) {
      after = round2(st.hulls[key].charge + delta);
      if (after < 0 || after > capacity(cat, st, key)) fail(`Charge must stay between 0 and ${capacity(cat, st, key)}.`);
      st.hulls[key].charge = after; label = `${hullLabel(cat, st, key)} charge`;
    } else if (kind === 'strain' && HULLS.includes(key)) {
      if (Math.floor(delta) !== delta) fail('Use whole units.');
      after = st.hulls[key].strain + delta; if (after < 0 || after > 3) fail('Strain runs 0–3.');
      st.hulls[key].strain = after; label = `${hullLabel(cat, st, key)} strain`;
    } else if (kind === 'item') {
      const it = item(cat, key);
      if (Math.floor(delta) !== delta) fail('Use whole units.');
      after = (has(st.inventory, key) ? st.inventory[key] : 0) + delta; if (after < 0) fail('That would go below zero.');
      if (after) st.inventory[key] = after; else delete st.inventory[key];
      label = it.name;
    } else fail('Unknown field.');
    return commit(st, entry(st, 'GM', `${delta > 0 ? '+' : ''}${fmt(delta)} ${label} → ${fmt(after)}${why}.`, 'gm'));
  };

  actions.setMode = (cat, st0, { hull, mode }) => {
    const st = clone(st0); hullId(hull);
    if (hull === 'kex' && mode === 'dormant') mode = 'cold';
    if (!MODES[hull].includes(mode)) fail('Unknown mode.');
    if (hull === 'shuttle' && !found(st)) fail('No such ship.');
    if (hull === 'shuttle' && mode !== 'docked' && !flightReady(cat, st)) fail(`${hullLabel(cat, st, 'shuttle')} stays docked until it is repaired: ${repairsLeft(cat, st).map((u) => u.name).join(', ')}.`);
    st.hulls[hull].mode = mode;
    const label = { active: 'maintenance mode', cold: 'cold storage (no draw, no generation, cloak down)', docked: 'docked', standby: 'occupied standby', flight: 'flight day' }[mode];
    return commit(st, entry(st, '', `${hullLabel(cat, st, hull)} set to ${label}.`, 'info'));
  };

  actions.setLey = (cat, st0, { on }) => {
    const st = clone(st0);
    if (!found(st)) fail('No such ship.');
    st.hulls.shuttle.leyAccess = !!on;
    return commit(st, entry(st, '', on ? `${hullLabel(cat, st, 'shuttle')} has usable ley access.` : `${hullLabel(cat, st, 'shuttle')} has no ley access.`, 'info'));
  };

  actions.setMarket = (cat, st0, { market: m }) => {
    const st = clone(st0); if (typeof m !== 'string' || !index(cat).market[m]) fail('Unknown market.');
    st.market = m;
    return commit(st, entry(st, 'GM', `set the going rate to ×${index(cat).market[m].multiplier}.`, 'gm'));
  };

  actions.setCrew = (cat, st0, { crew }) => {
    const st = clone(st0);
    const list = [...new Set((Array.isArray(crew) ? crew : []).map((c) => String(c).trim().slice(0, 40)).filter(Boolean))].slice(0, 24);
    if (!list.length) fail('Keep at least one name.');
    st.crew = list;
    return { state: st, log: [] };
  };

  actions.setLabel = (cat, st0, { label, day }) => {
    const st = clone(st0);
    if (label !== undefined) st.label = String(label).slice(0, 160);
    if (day !== undefined) { st.day = whole(day, 'days'); }
    checkBounds(st);
    return { state: st, log: [] };
  };

  function apply(cat, st, name, args) {
    const fn = (typeof name === 'string' && actions[name]) || fail('Unknown action.');
    return fn(cat, st, args || {});
  }

  function fmt(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  const channelName = (key) => key.replace(/^c:/, '');

  return {
    SCHEMA, ActionError, createState, normalize, apply, actions,
    projectStatus, power, capacity, slotCapacity, slotsUsed, tier, teams, busyTeams, installed, found, flightReady, repairsLeft, hullLabel, relaysRestored, decodeCost, decodeBlock,
    buyPrice, kitPrice, chunkPrice, puPerChunk, buyBlock, canFabricate, index, fmt, clone, channelName, has, itemValue, patternCount, materialStage,
    CHANNEL_CAP, REACTOR_CASK_PU, ARCHIVE_CAP, LOG_KINDS, DECODE,
  };
});
