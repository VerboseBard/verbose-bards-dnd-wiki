/* Kex Shipyard — interface. Depends on data/catalog.js, data/state.js, engine.js, art.js, voices.js.
   Rule for this file: every value placed into HTML goes through esc() (strings) or fmt() (numbers). */
(function () {
  'use strict';
  const CAT = window.KEX_CATALOG;
  const E = window.KexEngine;
  const ART = window.KexArt;
  const VOICE = window.KexVoices;
  const IX = E.index(CAT);
  const KEY = 'kex-shipyard:v1';
  const GM_DEVICE_KEY = 'kex-shipyard:gm-device';
  const fmt = E.fmt;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const attr = (o) => esc(JSON.stringify(o));
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MAPS = 'assets/maps/';

  const STATE_LABEL = { installed: 'Online', building: 'Under construction', ready: 'Ready to build', funding: 'Supplying', open: 'Available', locked: 'Locked', classified: 'Encrypted', unknown: 'Not worked out yet' };
  const ROUTES = ['bridge', 'kex', 'hangar', 'tree', 'hold', 'codex', 'log'];
  const HULL_OF_ROUTE = { kex: 'kex', hangar: 'shuttle' };
  const ROUTE_OF_HULL = { kex: 'kex', shuttle: 'hangar' };

  // ------------------------------------------------------------------ state & storage
  const official = E.normalize(CAT, window.KEX_OFFICIAL_STATE || {});
  const officialJSON = JSON.stringify(official);
  const S = {
    state: null, base: official.revision || 0, undo: [], gm: false, gmDevice: false, actor: '', route: 'bridge',
    sel: { kex: { zone: null, project: null }, shuttle: { zone: null, project: null } },
    pendingUpdate: false, commsMin: false, peek: false, logFilter: 'all', marketFilter: '', mounted: null,
    mapIndex: {}, lightbox: null, kexDeck: 'mid',
  };

  const storeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const storeSet = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  function readStore() { try { return JSON.parse(storeGet(KEY)); } catch (e) { return null; } }
  function writeStore() { storeSet(KEY, JSON.stringify({ state: S.state, base: S.base, ui: { gm: S.gm, actor: S.actor, commsMin: S.commsMin } })); }

  function load() {
    // GM tools only appear on a device opened once with ?gm in the address (not security — a tidy table).
    if (/[?&]gm\b/.test(location.search)) {
      storeSet(GM_DEVICE_KEY, '1');
      history.replaceState(null, '', location.pathname + location.hash);
    }
    S.gmDevice = storeGet(GM_DEVICE_KEY) === '1';
    const saved = readStore();
    if (saved && typeof saved === 'object' && saved.state) {
      S.state = E.normalize(CAT, saved.state);
      S.base = Number.isFinite(saved.base) ? saved.base : 0;
      const ui = saved.ui && typeof saved.ui === 'object' ? saved.ui : {};
      S.gm = S.gmDevice && ui.gm === true;
      S.actor = typeof ui.actor === 'string' ? ui.actor : '';
      S.commsMin = ui.commsMin === true;
      if ((official.revision || 0) > S.base) S.pendingUpdate = true;
    } else S.state = E.clone(official);
    if (!S.state.crew.includes(S.actor)) S.actor = S.state.crew[0];
  }
  const dirty = () => JSON.stringify(S.state) !== officialJSON;
  const found = () => E.found(S.state);
  const hullName = (h) => E.hullLabel(CAT, S.state, h);
  const status = (id) => E.projectStatus(CAT, S.state, id, S.gm);
  const snapshot = () => ({ state: S.state, base: S.base, pendingUpdate: S.pendingUpdate });
  const pushUndo = () => { S.undo.push(snapshot()); if (S.undo.length > 50) S.undo.shift(); };

  // ------------------------------------------------------------------ actions
  function act(name, args) {
    try {
      const res = E.apply(CAT, S.state, name, Object.assign({ who: S.actor, gm: S.gm }, args || {}));
      const prev = S.state;
      pushUndo();
      S.state = res.state;
      writeStore();
      react(name, args || {}, res.log, prev);
      render();
    } catch (e) {
      if (e instanceof E.ActionError) { toast(e.message, 'err'); if (window.KexSound) KexSound.fx.err(); }
      else { console.error(e); toast('Something went wrong with that action.', 'err'); }
    }
  }

  function react(name, args, log, prev) {
    const installs = log.filter((l) => l.kind === 'install');
    const revealed = log.some((l) => l.kind === 'reveal');
    const shown = log.filter((l) => l.kind !== 'day');
    (shown.length ? shown : log).slice(0, 3).forEach((l) => toast(l.text, l.kind === 'install' || l.kind === 'reveal' ? 'install' : l.kind === 'gm' ? 'gm' : l.kind === 'warn' ? 'err' : '', l.who));
    if ((installs.length || revealed) && window.KexSound) KexSound.fx.ok();
    if (revealed) setTimeout(showRevealModal, installs.length ? 1400 : 0);
    if (installs.length) {
      const u = CAT.upgrades.find((x) => installs[0].text.startsWith(`${x.name} commissioned`));
      celebrate(u ? u.name : 'System');
      const shuttle = u && u.hull === 'shuttle';
      if (!revealed) say(shuttle && found() ? 'tyndr' : 'kubix', shuttle && u.track === 'weapons' ? 'weapons' : 'install');
      return;
    }
    const map = { recycle: 'recycle', learn: 'learn', refuel: 'power', channel: 'power', givePart: 'part', advanceDay: 'day' };
    if (map[name]) say(speakerFor(args.id), map[name]);
    const low = ['kex', 'shuttle'].find((h) => (h === 'kex' || found()) && S.state.hulls[h].charge < 15 && prev.hulls[h].charge >= 15);
    if (low) say(low === 'shuttle' ? 'tyndr' : 'kubix', 'lowpower');
  }

  function speakerFor(projectId) {
    if (projectId && IX.up[projectId] && IX.up[projectId].hull === 'shuttle' && found()) return 'tyndr';
    return S.route === 'hangar' && found() ? 'tyndr' : 'kubix';
  }

  // ------------------------------------------------------------------ small renderers
  const icon = ART.icon;
  const gp = (n) => `${fmt(n)} gp`;
  const pill = (state) => `<span class="pill s-${state}">${STATE_LABEL[state]}</span>`;
  const ringColor = { installed: 'var(--teal)', building: 'var(--amber)', ready: 'var(--green)', funding: 'var(--amber)', open: 'var(--cyan)', locked: 'var(--dim)', classified: 'var(--violet)', unknown: 'var(--violet)' };
  function ring(s) {
    const pct = Math.round((s.state === 'building' ? 1 - s.p.daysLeft / Math.max(1, s.workDays) : s.progress) * 100);
    return `<div class="ring" style="--p:${pct};--c:${ringColor[s.state]}">${icon(s.u.track)}</div>`;
  }
  // A prerequisite's name, unless the player may not see it yet.
  const prereqLabel = (m) => (m.ids.every((id) => status(id).state !== 'classified') ? m.label : 'an encrypted system');
  // Parts tied to a still-hidden system (item.revealWith) stay encrypted for players until the GM reveals that system.
  const secretItem = (st, o) => !S.gm && !!IX.item[o].revealWith && !st.projects[IX.item[o].revealWith].revealed && !(st.inventory[o] > 0);
  const partMasked = (st, c, locked) => !locked && c.options.every((o) => secretItem(st, o));
  function needSummary(s) {
    if (s.state === 'installed') return 'Online';
    if (s.state === 'building') return `${fmt(s.p.daysLeft)} work day${s.p.daysLeft === 1 ? '' : 's'} left`;
    if (s.state === 'ready') return 'Everything supplied — ready to start work';
    if (s.state === 'locked') return `Needs ${s.missingPrereqs.map(prereqLabel).join(', ')}`;
    if (s.state === 'unknown') return 'Not worked out yet: your GM sets it when the time comes';
    if (s.exclusive) return s.exclusive;
    const out = [];
    s.u.components.forEach((c, i) => { if (s.need.parts[i]) out.push(`${s.need.parts[i]} × ${partMasked(S.state, c, s.p.partItem[i]) ? 'encrypted part' : c.label}`); });
    if (s.need.quest) out.push('field objective');
    if (s.need.gp) out.push(`${fmt(s.need.gp)} gp of coin metal`);
    if (s.need.kits) out.push(`${s.need.kits} kits`);
    if (s.need.pu) out.push(`${fmt(s.need.pu)} PU`);
    return `Needs ${out.slice(0, 4).join(' · ')}${out.length > 4 ? ' …' : ''}`;
  }
  function powerTags(u) {
    const t = [];
    if (u.generationPu) t.push(u.generationCondition === 'ley' ? `+${fmt(u.generationPu)} PU/day with a core and ley access` : u.generationCondition === 'reactor_fueled' ? `+${fmt(u.generationPu)} PU/day per loaded cask` : `Generates +${fmt(u.generationPu)} PU/day`);
    if (u.capacityPu) t.push(`+${fmt(u.capacityPu)} PU capacity`);
    if (u.slotCapacity) t.push(`+${u.slotCapacity} system slots`);
    if (u.dailyPu) t.push(`Draws ${fmt(u.dailyPu)} PU/day online`);
    if (u.slots) t.push(`Uses ${u.slots} system slot${u.slots > 1 ? 's' : ''}`);
    t.push(`${fmt(u.pu)} PU to commission`);
    return t.map((x) => `<span class="tag">${esc(x)}</span>`).join('');
  }
  // The reactor room goes to red alarm lighting while the Kex is losing power.
  function kexAlarm() {
    const pw = E.power(CAT, S.state, 'kex');
    return S.state.hulls.kex.mode === 'active' && (pw.net < 0 || pw.charge < 15);
  }
  // Maps behind a sealed door stay hidden until its project is installed (`needs`); `after` swaps in the later state
  // once its project is installed (the hangar after the wreckage is lifted off the shuttle).
  // A gated place counts as reached once its project is installed or the GM has ticked its objective (the armory is found).
  const reached = (id) => E.installed(S.state, id) || !!(S.state.projects[id] && S.state.projects[id].questDone);
  const shownMaps = (zone) => ((zone && zone.maps) || []).filter((m) => !m.needs || reached(m.needs));
  const later = (m) => !!(m.after && E.installed(S.state, m.after.project));
  const mapSrc = (m) => `${MAPS}${m.alarm && kexAlarm() ? m.alarm : later(m) ? m.after.file : m.file}`;
  const mapCap = (m) => (later(m) && m.after.caption) || m.caption;

  // ------------------------------------------------------------------ top bar, resources, banner
  function renderTop() {
    $$('.nav a').forEach((a) => {
      a.classList.toggle('active', a.dataset.route === S.route);
      if (a.dataset.route === 'hangar') a.innerHTML = `${icon('ship')}<span>${found() ? esc(IX.hull.shuttle.name) : 'Hangar'}</span>${found() ? '' : '<i class="lock-dot" title="Sealed"></i>'}`;
    });
    const m = IX.market[S.state.market] || CAT.markets[0];
    const marketCtl = S.gm
      ? `<select data-ui-change="market" aria-label="Market">${CAT.markets.map((x) => `<option value="${esc(x.id)}" ${x.id === m.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`
      : `<b title="${esc(m.name)}">${esc(m.name.split(' ')[0])} ×${fmt(m.multiplier)}</b>`;
    $('#tools').innerHTML = `
      <span class="chip day">${icon('day')}<span class="lbl">Day</span> <b>${fmt(S.state.day)}</b></span>
      <span class="chip market">${icon('gold')}${marketCtl}</span>
      <label class="chip" title="Who is acting? Contributions are logged under this name.">${icon('bridge')}<select data-ui-change="actor" aria-label="Acting crew member">${S.state.crew.map((c) => `<option ${c === S.actor ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      ${S.gm ? `<button class="btn warn sm" data-act="advanceDay" title="Advance one day: power, projects and daily limits">${icon('day')}<span class="lbl">Next day</span></button>` : ''}
      <button class="btn sm icon-only" data-ui="undo" title="Undo last change" ${S.undo.length ? '' : 'disabled'}>${icon('undo')}</button>
      ${S.gmDevice ? `<button class="btn sm gm toggle-gm ${S.gm ? 'on' : ''}" data-ui="toggle-gm" title="GM mode">${icon('gm')}GM</button>` : ''}
      ${window.KexSound ? `<button class="btn sm ${KexSound.on() ? 'on' : ''}" data-ui="sound" aria-pressed="${KexSound.on()}" title="Sound on or off: voice, interface sounds and the ship's hum"><svg class="icon" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/>${KexSound && KexSound.on() ? '<path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>' : '<path d="M16 9l5 6M21 9l-5 6"/>'}</svg><span class="lbl">Sound</span></button>` : ''}
      <button class="btn sm" data-ui="tour-menu" title="Replay the ship's message packet (tutorial)">${icon('guide')}<span class="lbl">Tutorial</span></button>
      <button class="btn sm" data-ui="office" title="Save and share">${icon('save')}<span class="lbl">Office</span></button>`;
  }

  function hullRes(h) {
    if (h === 'shuttle' && !found()) return `<div class="res hullres sealed"><div class="res-k">${icon('lock')}Hangar bay</div><div class="res-v">SEALED</div><div class="meter-row"><span>No readings</span></div></div>`;
    const pw = E.power(CAT, S.state, h);
    const pct = Math.min(100, (pw.charge / pw.capacity) * 100);
    const netCls = pw.net > 0 ? 'net-pos' : pw.net < 0 ? 'net-neg' : 'net-zero';
    const days = pw.net < 0 ? ` · ${fmt(pw.daysLeft)} day${pw.daysLeft === 1 ? '' : 's'} left` : '';
    return `<div class="res hullres ether"><div class="res-k">${icon('power')}${esc(IX.hull[h].name)} reserve</div>
      <div class="res-v">${fmt(pw.charge)}<small>/ ${fmt(pw.capacity)} PU</small></div>
      <div class="meter ${pct < 15 ? 'low' : ''}"><i style="width:${pct}%"></i></div>
      <div class="meter-row"><span>+${fmt(pw.generation.total)} / ${pw.draw.total ? '−' : ''}${fmt(pw.draw.total)} a day</span><span class="${netCls}">${pw.net > 0 ? '+' : ''}${fmt(pw.net)}/day${days}</span></div></div>`;
  }
  function renderResources() {
    const st = S.state;
    const lb = st.rawChunks / CAT.economy.rawChunksPerLb;
    $('#resources').innerHTML = `
      <div class="res gold"><div class="res-k">${icon('gold')}Treasury</div><div class="res-v">${fmt(st.treasury)}<small>gp</small></div><div class="meter-row"><span>${fmt(st.treasury / CAT.economy.gpPerPp)} pp</span></div></div>
      <div class="res ether"><div class="res-k">${icon('ether')}Raw ether</div><div class="res-v">${fmt(st.rawChunks)}<small>chunks</small></div><div class="meter-row"><span>${fmt(lb)} lb · ${fmt(st.rawChunks * E.puPerChunk(CAT))} PU</span></div></div>
      <div class="res"><div class="res-k">${icon('ether')}Refined disks</div><div class="res-v">${fmt(st.refinedDisks)}</div><div class="meter-row"><span>ammunition</span></div></div>
      <div class="res"><div class="res-k">${icon('kit')}Fabrication kits</div><div class="res-v">${fmt(st.kits)}</div><div class="meter-row"><span>${fmt(Object.values(st.inventory).reduce((a, b) => a + b, 0))} parts in hold</span></div></div>
      ${hullRes('kex')}${hullRes('shuttle')}`;
  }

  function renderBanner() {
    const el = $('#banner');
    let html = ''; let cls = 'banner';
    if (S.pendingUpdate) html = `${icon('save')}<span>The GM has published a newer ship record (revision ${fmt(official.revision)}).</span><button class="btn sm primary" data-ui="load-official">Load it</button><button class="btn sm ghost" data-ui="keep-local">Keep my version</button>`;
    else if (S.gm) { cls += ' gm'; html = `${icon('gm')}<span><b>GM mode.</b> Advance days, confirm objectives, reveal schematics, sell limited stock and correct the hold. Publish from the Office when the session ends.</span>`; }
    else if (dirty()) html = `${icon('save')}<span>You have local changes on this device. The official record only changes when the GM publishes.</span><button class="btn sm ghost" data-ui="reset">Reset to official</button>`;
    el.className = cls; el.innerHTML = html; el.hidden = !html;
  }

  // ------------------------------------------------------------------ ship svg state
  const FIRST_SIX = [0, 2, 4, 7, 9, 11];
  function zoneState(hull, zone) {
    const ids = CAT.upgrades.filter((u) => u.hull === hull && u.zone === zone).map((u) => u.id);
    if (!ids.length) return 'none';
    const states = ids.map((id) => status(id).state);
    if (states.some((x) => ['building', 'ready', 'funding', 'open'].includes(x))) return 'active';
    if (states.includes('installed')) return 'installed';
    return 'locked';
  }
  function applyShip(svg, hull, selectedZone) {
    const st = S.state;
    $$('.feature', svg).forEach((f) => { const on = E.installed(st, f.dataset.feature); f.classList.toggle('on', f.dataset.invert ? !on : on); });
    if (hull === 'kex') {
      svg.classList.toggle('hangar-open', E.installed(st, 'k_hangar'));
      svg.classList.toggle('armory-back', E.installed(st, 'k_armory_recovery'));
      const lit1 = E.installed(st, 'k_fog_cloak'); const lit2 = E.installed(st, 'k_fog_redundancy');
      const sup1 = st.projects.k_fog_cloak.parts[0]; const sup2 = st.projects.k_fog_redundancy.parts[0];
      let second = 0;
      $$('.emitter', svg).forEach((el) => {
        const i = Number(el.dataset.slot); const a = FIRST_SIX.indexOf(i);
        const b = a >= 0 ? -1 : second++;
        const cls = a >= 0 ? (lit1 ? 'lit' : a < sup1 ? 'supplied' : '') : (lit2 ? 'lit' : b < sup2 ? 'supplied' : '');
        el.classList.remove('lit', 'supplied'); if (cls) el.classList.add(cls);
      });
    }
    const pw = E.power(CAT, st, hull);
    svg.classList.toggle('powered', pw.charge > 0 && pw.net >= 0);
    svg.classList.toggle('draining', pw.charge > 0 && pw.net < 0);
    $$('.zone', svg).forEach((z) => {
      const zs = zoneState(hull, z.dataset.zone);
      z.classList.remove('z-installed', 'z-active', 'z-locked', 'z-selected');
      if (zs !== 'none') z.classList.add(`z-${zs}`);
      if (z.dataset.zone === selectedZone) z.classList.add('z-selected');
    });
  }

  // ------------------------------------------------------------------ battle maps
  const zoneOf = (hull, id) => IX.hull[hull].zones.find((z) => z.id === id);
  function roomMaps(hull, zone) {
    const maps = shownMaps(zone);
    if (!maps.length) return '';
    const key = `${hull}:${zone.id}`;
    const i = Math.min(S.mapIndex[key] || 0, maps.length - 1);
    const m = maps[i];
    const alarm = m.alarm && kexAlarm();
    const cold = m.alarm && S.state.hulls.kex.mode === 'cold';
    return `<figure class="room-map ${alarm ? 'alarm' : ''} ${cold ? 'cold' : ''}">
      <button class="map-main" data-ui="lightbox" data-hull="${hull}" data-zone="${esc(zone.id)}" data-i="${i}" aria-label="Open ${esc(mapCap(m))} full screen">
        <img src="${esc(mapSrc(m))}" alt="${esc(mapCap(m))} battle map" loading="lazy">
        <span class="map-zoom">${icon('plus')}Full screen</span>
      </button>
      <figcaption>${esc(mapCap(m))}${alarm ? ' <span class="alarm-tag">RESERVE DRAINING · ALARM LIGHTING</span>' : ''}${cold ? ' <span class="alarm-tag cold">POWERED DOWN</span>' : ''}</figcaption>
      ${maps.length > 1 ? `<div class="map-thumbs">${maps.map((x, j) => `<button class="${j === i ? 'on' : ''}" data-ui="map-pick" data-key="${esc(key)}" data-i="${j}" aria-label="${esc(mapCap(x))}"><img src="${esc(mapSrc(x))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
    </figure>`;
  }
  function openLightbox(hull, zoneId, i) {
    const zone = zoneOf(hull, zoneId); const n = shownMaps(zone).length; if (!n) return;
    S.lightbox = { hull, zoneId, i: Math.max(0, Math.min(i, n - 1)) };
    renderLightbox();
  }
  function renderLightbox() {
    $$('.lightbox').forEach((x) => x.remove());
    if (!S.lightbox) return;
    const zone = zoneOf(S.lightbox.hull, S.lightbox.zoneId); const maps = shownMaps(zone); const m = maps[Math.min(S.lightbox.i, maps.length - 1)]; if (!m) { S.lightbox = null; return; }
    const el = document.createElement('div');
    el.className = 'lightbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', `${mapCap(m)} battle map`);
    el.innerHTML = `<img src="${esc(mapSrc(m))}" alt="${esc(mapCap(m))} battle map">
      <div class="lb-bar"><span class="lb-cap">${esc(zone.name)} · ${esc(mapCap(m))}${maps.length > 1 ? ` (${S.lightbox.i + 1}/${maps.length})` : ''}</span>
      ${maps.length > 1 ? `<button class="btn sm" data-ui="lb-step" data-d="-1" aria-label="Previous map">◂</button><button class="btn sm" data-ui="lb-step" data-d="1" aria-label="Next map">▸</button>` : ''}
      <button class="btn sm" data-ui="lb-close" aria-label="Close">${icon('x')}Close</button></div>`;
    el.addEventListener('click', (e) => { if (e.target === el) closeLightbox(); });
    document.body.appendChild(el);
    el.querySelector('[data-ui="lb-close"]').focus();
  }
  function closeLightbox() { S.lightbox = null; renderLightbox(); }

  // ------------------------------------------------------------------ views: bridge
  function shipCard(hull) {
    const route = ROUTE_OF_HULL[hull];
    if (hull === 'shuttle' && !found()) {
      const hs = status('k_hangar');
      return `<section class="panel ship-card"><div class="sealed-card"><div><div class="sc-title">HANGAR SEALED</div><div class="sc-sub">Collapsed framing blocks the bay. Kubix cannot read what is inside.</div></div></div>
        <div class="info"><div class="ship-title"><h3>Hangar bay</h3><span class="tier-badge">No signal</span></div>
        <p class="lede" style="margin:0">Open it with <b>${esc(hs.u.name)}</b> — ${esc(needSummary(hs).toLowerCase())}.</p>
        <div><button class="btn primary" data-ui="open-project" data-id="k_hangar">${icon('access')}Clear the hangar</button></div></div></section>`;
    }
    const t = E.tier(CAT, S.state, hull);
    const h = IX.hull[hull];
    const pw = E.power(CAT, S.state, hull);
    const all = CAT.upgrades.filter((u) => u.hull === hull).map((u) => status(u.id));
    const online = all.filter((s) => s.state === 'installed').length;
    const moving = all.filter((s) => ['building', 'ready', 'funding'].includes(s.state)).length;
    const open = all.filter((s) => s.state === 'open').length;
    return `<section class="panel ship-card">
      <div class="mini card-link" data-hull="${hull}" data-ui="go" data-route="${route}" tabindex="0" role="link" aria-label="Open ${esc(h.name)} deck">${hull === 'kex' ? ART.kex('mid', { hangarOpen: found() }) : ART.tyndr()}</div>
      <div class="info">
        <div class="ship-title"><h3>${esc(h.name)}</h3><span class="tier-badge">Tier ${t} · ${esc(h.tiers[t - 1].name)}</span></div>
        <div class="tier-pips">${h.tiers.map((x) => `<i class="${x.tier <= t ? 'on' : ''}"></i>`).join('')}</div>
        <div class="statline"><span><b>${online}</b> online</span><span><b>${moving}</b> in progress</span><span><b>${open}</b> available</span><span>Reserve <b>${fmt(pw.charge)}</b>/${fmt(pw.capacity)}</span><span class="${pw.net >= 0 ? 'net-pos' : 'net-neg'}">${pw.net > 0 ? '+' : ''}${fmt(pw.net)} PU/day</span></div>
        <div><button class="btn primary" data-ui="go" data-route="${route}">${icon('arrow')}Open ${esc(h.short)} deck</button></div>
      </div></section>`;
  }
  const ORDER = { building: 0, ready: 1, funding: 2, open: 3 };
  function objectives() {
    return CAT.upgrades.map((u) => status(u.id)).filter((s) => s.state in ORDER)
      .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.u.tier - b.u.tier || (a.u.hull > b.u.hull ? 1 : -1));
  }
  function objCard(s) {
    return `<button class="obj" data-ui="open-project" data-id="${esc(s.id)}">${ring(s)}
      <div><div class="o-hull">${esc(hullName(s.u.hull))} · Tier ${s.u.tier}</div><div class="o-name">${esc(s.u.name)}</div><div class="o-need">${esc(needSummary(s))}</div></div>${pill(s.state)}</button>`;
  }
  function logItems(list) {
    if (!list.length) return '<p class="empty">Nothing logged yet.</p>';
    return `<ul class="log-list">${list.map((l) => `<li class="k-${esc(l.kind)}"><span class="l-day">DAY ${fmt(l.day)}</span><span class="l-text">${l.kind === 'day' ? esc(l.text) : `${l.who ? `<span class="l-who">${esc(l.who)}</span> ` : ''}${esc(l.text)}`}</span></li>`).join('')}</ul>`;
  }
  function viewBridge() {
    const objs = objectives();
    const ext = shownMaps(zoneOf('kex', 'hull'))[0];
    return `<section class="hero ${ext ? 'has-img' : ''}">${ext ? `<img class="hero-img" src="${esc(MAPS + ext.file)}" alt="">` : ''}
      <div class="hero-text"><div class="eyebrow">Ship's bridge · Day ${fmt(S.state.day)}</div><h1>Kex <span class="accent">Shipyard</span></h1><p class="lede">${esc(S.state.label)}</p>
      <div class="legend" style="margin-top:14px">${S.gm ? `<button class="btn warn" data-act="advanceDay">${icon('day')}Advance to day ${fmt(S.state.day + 1)}</button>` : ''}<button class="btn" data-ui="go" data-route="tree">${icon('tree')}Upgrade tree</button><button class="btn" data-ui="go" data-route="hold">${icon('hold')}Hold & workshop</button></div></div></section>
      <div class="bridge-grid">
        ${shipCard('kex')}${shipCard('shuttle')}
        <section class="panel side-col" style="grid-row: span 2"><div class="panel-head"><h2>Work orders</h2><span class="chip">${objs.length} open</span></div>
          <div class="panel-body"><div class="obj-list">${objs.slice(0, 9).map(objCard).join('') || '<p class="empty">No open work. Reveal new schematics or recover more of the ship.</p>'}</div>
          ${objs.length > 9 ? `<p class="help" style="margin-top:10px">+ ${objs.length - 9} more on the <a href="#/tree">upgrade tree</a>.</p>` : ''}</div></section>
        <section class="panel span-2"><div class="panel-head"><h2>Ship's log</h2><a class="btn sm ghost" href="#/log">Full log</a></div><div class="panel-body">${logItems(S.state.log.slice(0, 8))}</div></section>
      </div>`;
  }

  // ------------------------------------------------------------------ views: deck
  const sealedNow = (hull) => hull === 'shuttle' && !found() && !S.peek;
  const deckOf = (hull) => (hull === 'kex' ? S.kexDeck : 'main');
  const mountKey = (hull) => `${hull}:${sealedNow(hull) ? 'sealed' : 'open'}:${deckOf(hull)}:${found()}`;
  // Show the deck a room lives on (the hull ring is on every deck).
  function followDeck(hull, zoneId) {
    const z = zoneOf(hull, zoneId);
    if (hull === 'kex' && z && z.deck !== 'all') S.kexDeck = z.deck;
  }
  function mountDeck(hull) {
    const sealed = sealedNow(hull);
    const svg = sealed ? ART.sealedBay() : hull === 'kex' ? ART.kex(S.kexDeck, { hangarOpen: found() }) : ART.tyndr();
    $('#view').innerHTML = `<div class="deck">
      <section class="panel deck-map"><div class="map-head" id="maphead"></div>
        ${hull === 'kex' ? '<div class="deck-picker" id="deckpick"></div>' : ''}
        <div class="map-scroll"><div class="map-stage ${hull === 'kex' ? 'kex' : ''}" id="stage">${svg}<div id="sealed"></div></div></div>
        <div class="zone-chips" id="zchips"></div></section>
      <aside class="panel side"><div class="panel-body" id="side"></div></aside></div>`;
    const svgEl = $('#stage > svg');
    if (!sealed) {
      $$('.zone', svgEl).forEach((z) => {
        const zone = zoneOf(hull, z.dataset.zone);
        z.setAttribute('tabindex', '0'); z.setAttribute('role', 'button');
        z.setAttribute('aria-label', zone ? zone.name : z.dataset.zone);
      });
      svgEl.addEventListener('click', (e) => { const z = e.target.closest('.zone'); if (z) selectZone(hull, z.dataset.zone); });
      svgEl.addEventListener('keydown', (e) => { const z = e.target.closest('.zone'); if (z && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectZone(hull, z.dataset.zone); } });
    }
    S.mounted = mountKey(hull);
  }
  function selectZone(hull, zone) {
    S.sel[hull] = { zone, project: null };
    followDeck(hull, zone);
    history.replaceState(null, '', `#/${ROUTE_OF_HULL[hull]}/${zone}`);
    renderView();
  }
  function selectDeck(deck) {
    if (!IX.hull.kex.decks.some((d) => d.id === deck)) return;
    S.kexDeck = deck;
    const sel = S.sel.kex; const zid = sel.project ? IX.up[sel.project].zone : sel.zone; const z = zid && zoneOf('kex', zid);
    if (z && z.deck !== 'all' && z.deck !== deck) { S.sel.kex = { zone: null, project: null }; history.replaceState(null, '', '#/kex'); }
    // The picker is re-drawn, so keep keyboard focus on the same control for the new deck.
    const a = document.activeElement; const pick = a && a.closest && a.closest('#deckpick');
    const kind = pick && (a.closest('.deck-band') ? '.deck-band' : '.deck-tabs button');
    renderView();
    if (kind) { const b = document.querySelector(`#deckpick ${kind}[data-deck="${deck}"]`); if (b) b.focus({ preventScroll: true }); }
  }
  function deckPicker() {
    const h = IX.hull.kex;
    return `${ART.kexElevation(S.kexDeck)}<div class="deck-tabs" role="group" aria-label="Decks">${h.decks.map((d, i) => `<button class="${d.id === S.kexDeck ? 'on' : ''}" data-ui="deck" data-deck="${esc(d.id)}"><b>${i + 1}</b>${esc(d.short)}</button>`).join('')}</div>`;
  }
  function zoneChip(hull, z, zoneId) {
    const zs = zoneState(hull, z.id);
    return `<button class="zchip ${zs !== 'none' ? `z-${zs}` : ''} ${z.id === zoneId ? 'on' : ''}" data-ui="zone" data-hull="${hull}" data-zone="${esc(z.id)}"><i></i>${esc(z.name)}${shownMaps(z).length ? ` ${icon('map', 'tiny-ic')}` : ''}</button>`;
  }
  function updateDeck(hull) {
    const h = IX.hull[hull];
    const sel = S.sel[hull];
    const sealed = sealedNow(hull);
    const zoneId = sel.project ? IX.up[sel.project].zone : sel.zone;
    const t = E.tier(CAT, S.state, hull);
    const pw = E.power(CAT, S.state, hull);
    const st = S.state.hulls[hull];
    const modes = hull === 'kex' ? [['active', 'Maintenance'], ['cold', 'Cold storage']] : [['docked', 'Docked'], ['standby', 'Standby'], ['flight', 'Flight day']];
    if (hull === 'kex' && $('#deckpick')) $('#deckpick').innerHTML = deckPicker();
    const slotCap = E.slotCapacity(CAT, S.state, hull); const slotUsed = E.slotsUsed(CAT, S.state, hull);
    $('#maphead').innerHTML = sealed ? `<div><div class="eyebrow">Kex · deck 2</div><h3>Hangar bay</h3></div><div class="spacer"></div><span class="pill s-classified">No signal</span>` : `
      <div><div class="eyebrow">Tier ${t} · ${esc(h.tiers[t - 1].name)}</div><h3>${esc(h.name)}</h3></div>
      <div class="tier-pips" style="width:120px">${h.tiers.map((x) => `<i class="${x.tier <= t ? 'on' : ''}" title="Tier ${x.tier}: ${esc(x.name)}"></i>`).join('')}</div>
      <div class="spacer"></div>
      <div class="power-read"><span>Reserve <b>${fmt(pw.charge)}</b>/${fmt(pw.capacity)}</span><span>Gen <b class="net-pos">+${fmt(pw.generation.total)}</b></span><span>Draw <b class="${pw.draw.total ? 'net-neg' : ''}">${pw.draw.total ? '−' : ''}${fmt(pw.draw.total)}</b></span><span>Net <b class="${pw.net >= 0 ? 'net-pos' : 'net-neg'}">${pw.net > 0 ? '+' : ''}${fmt(pw.net)}/day</b></span><span>Slots <b>${slotUsed}</b>/${slotCap}</span></div>
      <div class="seg" role="group" aria-label="Operating mode">${modes.map(([m, l]) => { const grounded = hull === 'shuttle' && m !== 'docked' && !E.flightReady(CAT, S.state); return `<button class="${st.mode === m ? 'on' : ''}" data-act="setMode" data-args="${attr({ hull, mode: m })}" ${grounded ? 'disabled title="Under repair: it stays docked until the wreckage is cleared and the hull, lift engines and flight controls are fixed"' : ''}>${l}</button>`; }).join('')}</div>
      ${hull === 'shuttle' && !E.flightReady(CAT, S.state) ? `<span class="pill s-funding" title="${esc(E.repairsLeft(CAT, S.state).map((u) => u.name).join(' · '))}">Under repair · ${E.repairsLeft(CAT, S.state).length} left</span>` : ''}
      ${hull === 'shuttle' && E.installed(S.state, 's_ley_tap') ? `<button class="btn sm ${st.leyAccess ? 'go' : ''}" data-act="setLey" data-args="${attr({ on: !st.leyAccess })}">${icon('ether')}Ley ${st.leyAccess ? 'on' : 'off'}</button>` : ''}`;
    if (!sealed) applyShip($('#stage > svg'), hull, zoneId);
    $('#sealed').innerHTML = sealed ? `<div class="sealed-overlay"><div><div class="sc-title">HANGAR SEALED</div><p class="lede" style="margin:10px auto 16px">Collapsed framing has blocked this bay since the crash. Kubix's sensors return nothing.</p>
      <button class="btn primary" data-ui="open-project" data-id="k_hangar">${icon('access')}Clear the hangar approach</button>
      ${S.gm ? `<div style="margin-top:12px"><button class="btn gm sm" data-ui="peek">GM: peek inside</button></div>` : ''}</div></div>` : '';
    $('#zchips').innerHTML = sealed ? '' : hull === 'kex'
      ? h.zones.filter((z) => z.deck === 'all').map((z) => zoneChip(hull, z, zoneId)).join('') + h.decks.map((d, i) => `<span class="zchip-deck">Deck ${i + 1}</span>${h.zones.filter((z) => z.deck === d.id).map((z) => zoneChip(hull, z, zoneId)).join('')}`).join('')
      : h.zones.map((z) => zoneChip(hull, z, zoneId)).join('');
    $('#side').innerHTML = sealed ? sealedSide() : sel.project ? projectDetail(sel.project) : sel.zone ? zoneDetail(hull, sel.zone) : shipOverview(hull);
  }
  function sealedSide() {
    const s = status('k_hangar');
    return `<div class="zone-intro"><div class="eyebrow">Kex · deck 2</div><h3>Hangar bay</h3><p>This bay has been cut off since the crash. Whatever is in there has been sitting in the dark for a long time.</p></div>
      <button class="pcard" data-ui="open-project" data-id="k_hangar">${ring(s)}<div><div class="p-name">${esc(s.u.name)}</div><div class="p-sub">${esc(needSummary(s))}</div></div>${pill(s.state)}</button>`;
  }
  function shipOverview(hull) {
    const h = IX.hull[hull];
    const tierNow = E.tier(CAT, S.state, hull);
    const next = h.tiers.find((t) => t.tier === tierNow + 1);
    const nextVisible = next && next.requires.every((id) => status(id).state !== 'classified');
    return `<div class="zone-intro"><div class="eyebrow">${esc(h.name)} · systems</div><h3>Tap a room on the map</h3>
      <p>${esc(h.tiers[tierNow - 1].meaning)}</p></div>
      ${next ? `<div class="objective"><span>${icon('arrow')}</span><div><div class="ob-k">Next tier · ${nextVisible ? esc(next.name) : 'Encrypted'}</div><p>${nextVisible ? `Bring online: ${next.requires.map((id) => `<b>${esc(IX.up[id].name)}</b>${E.installed(S.state, id) ? ' ✓' : ''}`).join(', ')}` : 'Restore more of the ship to decode the next milestone.'}</p></div></div>` : ''}
      ${(h.decks.length > 1 ? [{ id: 'all', name: 'Whole ship' }].concat(h.decks) : [{ id: null, name: 'Rooms' }]).map((d) => `<div class="pd-section">${esc(d.name)}</div>` + h.zones.filter((z) => d.id === null || z.deck === d.id).map((z) => { const ids = CAT.upgrades.filter((u) => u.hull === hull && u.zone === z.id).map((u) => status(u.id)); const on = ids.filter((s) => s.state === 'installed').length; const vis = ids.filter((s) => s.state !== 'classified').length; const zs = zoneState(hull, z.id);
        return `<button class="pcard" data-ui="zone" data-hull="${hull}" data-zone="${esc(z.id)}">${shownMaps(z).length ? `<img class="pcard-thumb" src="${esc(mapSrc(shownMaps(z)[0]))}" alt="" loading="lazy">` : `<div class="pd-icon">${icon(ids[0] ? ids[0].u.track : 'habitation')}</div>`}<div><div class="p-name">${esc(z.name)}</div><div class="p-sub">${ids.length ? `${on} online · ${vis} known${ids.length - vis ? ` · ${ids.length - vis} encrypted` : ''}` : 'No refit projects'}${shownMaps(z).length ? ` · ${shownMaps(z).length} map${shownMaps(z).length > 1 ? 's' : ''}` : ''}</div></div><span class="pill s-${zs === 'active' ? 'open' : zs === 'installed' ? 'installed' : 'locked'}">${zs === 'active' ? 'Work' : zs === 'installed' ? 'Online' : '—'}</span></button>`; }).join('')).join('')}`;
  }
  function zoneDetail(hull, zoneId) {
    const h = IX.hull[hull];
    const z = zoneOf(hull, zoneId) || h.zones[0];
    const list = CAT.upgrades.filter((u) => u.hull === hull && u.zone === z.id).map((u) => status(u.id)).sort((a, b) => a.u.tier - b.u.tier);
    const vis = list.filter((s) => s.state !== 'classified');
    const hidden = list.length - vis.length;
    return `<div class="crumbs"><button data-ui="zone" data-hull="${hull}" data-zone="">${esc(h.name)}</button> › ${esc(z.name)}</div>
      <div class="zone-intro"><h3>${esc(z.name)}</h3><p>${esc(z.blurb)}</p></div>
      ${roomMaps(hull, z)}
      ${list.length ? '<div class="pd-section">Systems</div>' : ''}
      ${vis.map((s) => `<button class="pcard" data-ui="open-project" data-id="${esc(s.id)}">${ring(s)}<div><div class="p-name">${esc(s.u.name)}</div><div class="p-sub">Tier ${s.u.tier} · ${esc(needSummary(s))}</div></div>${pill(s.state)}</button>`).join('')}
      ${hidden ? Array.from({ length: hidden }, () => `<div class="pcard classified"><div class="pd-icon">${icon('lock')}</div><div><div class="p-name">ENCRYPTED</div><div class="p-sub">A schematic Kubix cannot decode yet</div></div>${pill('classified')}</div>`).join('') : ''}
      ${!list.length ? '<p class="empty">No refit projects in this space.</p>' : ''}`;
  }

  // ------------------------------------------------------------------ project detail
  function reqRow(title, ic, done, total, unit, body, note, keepNote) {
    const met = done >= total - 1e-9;
    if (met && !keepNote) note = '';
    return `<div class="req ${met ? 'met' : ''}"><div class="req-top"><div class="req-name">${icon(met ? 'check' : ic)}${title}</div><div class="req-count">${fmt(done)} / ${fmt(total)}${unit ? ` ${unit}` : ''}</div></div>
      <div class="bar"><i style="width:${Math.min(100, total ? (done / total) * 100 : 100)}%"></i></div>${met ? '' : body || ''}${note ? `<div class="req-note">${note}</div>` : ''}</div>`;
  }
  const qtyInput = (id, val, max) => `<span class="qty"><input type="number" id="${esc(id)}" min="1" ${max ? `max="${max}"` : ''} value="${Math.max(1, Math.round(val * 100) / 100)}" aria-label="Amount"></span>`;
  function projectDetail(id) {
    const s = status(id);
    const u = s.u; const p = s.p;
    const hull = u.hull; const h = IX.hull[hull];
    const zone = zoneOf(hull, u.zone);
    const crumbs = `<div class="crumbs"><button data-ui="zone" data-hull="${hull}" data-zone="">${esc(hullName(hull))}</button> › <button data-ui="zone" data-hull="${hull}" data-zone="${esc(u.zone)}">${esc(zone.name)}</button></div>`;
    if (s.state === 'classified') return `${crumbs}<div class="zone-intro"><h3>Encrypted schematic</h3><p>Kubix cannot decode this system yet. Restore more of the ship.</p></div>`;
    const canAct = !['installed', 'building', 'locked', 'unknown'].includes(s.state) && !s.exclusive && (hull !== 'shuttle' || found());
    const st = S.state;
    const dis = (cond) => (cond ? '' : 'disabled');
    const first = shownMaps(zone)[0];
    const banner = first ? `<button class="map-banner" data-ui="lightbox" data-hull="${hull}" data-zone="${esc(zone.id)}" data-i="0" aria-label="Open ${esc(mapCap(first))} full screen"><img src="${esc(mapSrc(first))}" alt="" loading="lazy"><span>${esc(zone.name)}</span></button>` : '';
    let html = `${crumbs}${banner}
      <div class="pd-head"><div class="pd-icon">${icon(u.track, 'lg')}</div><div><h3>${esc(u.name)}</h3>
        <div class="pd-tags">${pill(s.state)}<span class="tag">Tier ${u.tier}</span><span class="tag">${esc(u.track)}</span>${s.hidden ? '<span class="tag" style="color:var(--violet)">Hidden from players</span>' : ''}</div></div></div>
      <p class="pd-summary">${esc(u.summary)}</p>
      <div class="pd-benefit">${esc(u.benefit)}</div>
      ${s.state === 'unknown' ? '' : `<div class="pd-powers">${powerTags(u)}</div>`}`;
    const groups = u.requires.map((r) => [r]).concat(u.requiresAny || []);
    if (groups.length) {
      html += `<div class="pd-section">Requires</div><div class="prereq">${groups.map((g) => {
        const ok = g.some((r) => E.installed(st, r)); const hiddenG = g.every((r) => status(r).state === 'classified');
        const label = hiddenG ? 'Encrypted system' : g.map((r) => IX.up[r].name).join(' or ');
        return `<button class="${ok ? 'done' : 'missing'}" data-ui="open-project" data-id="${esc(g[0])}" ${hiddenG ? 'disabled' : ''}>${icon(ok ? 'check' : 'lock')}${esc(label)}</button>`;
      }).join('')}</div>`;
    }
    if (s.exclusive) html += `<p class="req-note" style="color:var(--amber)">${esc(s.exclusive)}</p>`;
    if (u.quest) {
      html += `<div class="pd-section">Field objective</div><div class="objective ${p.questDone ? 'done' : ''}"><span>${icon(p.questDone ? 'check' : 'navigation')}</span><div><div class="ob-k">${p.questDone ? 'Complete' : 'Must happen in play'}</div><p>${esc(u.quest)}</p>
        ${S.gm && s.state !== 'installed' && (u.hull !== 'shuttle' || found()) ? `<div style="margin-top:8px"><button class="btn gm sm" data-act="setQuest" data-args="${attr({ id, done: !p.questDone })}">${p.questDone ? 'Reopen objective' : 'Mark objective complete'}</button></div>` : ''}</div></div>`;
    }
    if (s.state === 'unknown') {
      html += `<div class="work-box"><div class="wb-k">Status</div><div class="wb-v" style="color:var(--violet)">NOT WORKED OUT YET</div><div class="help" style="margin:0">Its cost and condition are unknown. Your GM sets them when the time comes.</div></div>`;
      return html + gmRow(s);
    }
    if (s.state === 'installed') {
      html += `<div class="work-box"><div class="wb-k">Status</div><div class="wb-v" style="color:var(--teal)">ONLINE</div><div class="help" style="margin:0">Built and commissioned.</div></div>`;
      return html + gmRow(s);
    }
    html += '<div class="pd-section">Supply checklist</div>';
    if (u.gp) {
      html += reqRow('Precious-metal feedstock', 'gold', p.paid.gp, u.gp, 'gp', canAct ? `<div class="req-actions">${qtyInput(`q-gp-${id}`, Math.min(s.need.gp, Math.max(1, st.treasury)))}<button class="btn sm" data-act="payGold" data-id="${esc(id)}" data-from="#q-gp-${esc(id)}" data-field="gp" ${dis(st.treasury > 0)}>${icon('gold')}Feed coins</button></div>` : '', `The ship takes metal, not payment: coins are melted for conductors and lattices. Treasury: ${gp(st.treasury)}`);
    }
    if (u.kits) {
      html += reqRow('Fabrication kits', 'kit', p.paid.kits, u.kits, '', canAct ? `<div class="req-actions">${qtyInput(`q-kit-${id}`, s.need.kits, s.need.kits)}<button class="btn sm" data-act="giveKits" data-id="${esc(id)}" data-from="#q-kit-${esc(id)}" data-field="qty" ${dis(st.kits > 0)}>${icon('kit')}From hold (${fmt(st.kits)})</button><button class="btn sm" data-act="giveKits" data-id="${esc(id)}" data-from="#q-kit-${esc(id)}" data-field="qty" data-args="${attr({ buy: true })}">${icon('gold')}Buy · ${gp(E.kitPrice(CAT))} ea</button></div>` : '', 'Graded metal, conductors and fasteners.');
    }
    if (u.pu) {
      const kexC = st.hulls.kex.charge; const shC = found() ? st.hulls.shuttle.charge : 0;
      const chunksNeed = Math.ceil(s.need.pu / E.puPerChunk(CAT));
      html += reqRow('Commissioning power', 'power', p.paid.pu, u.pu, 'PU', canAct ? `<div class="req-actions">${qtyInput(`q-pu-${id}`, Math.min(s.need.pu, Math.max(1, kexC)))}<button class="btn sm" data-act="givePower" data-id="${esc(id)}" data-from="#q-pu-${esc(id)}" data-field="pu" data-args="${attr({ source: 'kex' })}" ${dis(kexC > 0)}>${icon('power')}From Kex reserve</button>${found() ? `<button class="btn sm" data-act="givePower" data-id="${esc(id)}" data-from="#q-pu-${esc(id)}" data-field="pu" data-args="${attr({ source: 'shuttle' })}" ${dis(shC > 0)}>${icon('power')}From ${esc(IX.hull.shuttle.short)}</button>` : ''}</div>
        <div class="req-actions" style="margin-top:6px">${qtyInput(`q-ch-${id}`, Math.min(chunksNeed, Math.max(1, st.rawChunks)))}<button class="btn sm" data-act="givePower" data-id="${esc(id)}" data-from="#q-ch-${esc(id)}" data-field="chunks" data-args="${attr({ source: 'raw' })}" ${dis(st.rawChunks > 0)}>${icon('ether')}Feed raw chunks (${fmt(st.rawChunks)})</button></div>` : '', `${chunksNeed} raw chunk${chunksNeed === 1 ? '' : 's'} would cover the rest · 1 chunk = ${fmt(E.puPerChunk(CAT))} PU; leftovers go to the Kex reserve`);
    }
    u.components.forEach((c, line) => {
      const locked = p.partItem[line];
      const masked = partMasked(st, c, locked);
      const opts = locked ? [locked] : c.options.filter((o) => !secretItem(st, o));
      const need = s.need.parts[line];
      let body = '';
      if (canAct && !masked) {
        body = `<div class="req-actions">${qtyInput(`q-part-${id}-${line}`, need, need)}<span class="req-note" style="margin:0">units per click</span></div>` + opts.map((itemId) => {
          const it = IX.item[itemId]; const have = E.has(st.inventory, itemId) ? st.inventory[itemId] : 0;
          const buyWhy = E.buyBlock(CAT, st, itemId, S.gm); const fabWhy = E.canFabricate(CAT, st, itemId);
          const base = { id, line, itemId };
          return `<div class="opt"><div class="opt-name"><b>${esc(it.name)}</b><span>${have ? `${fmt(have)} in hold` : 'none in hold'}${st.patterns.includes(itemId) ? ' · <span class="badge-pattern">PATTERN</span>' : ''}</span></div>
            <div class="req-actions">
              <button class="btn sm" data-act="givePart" data-from="#q-part-${esc(id)}-${line}" data-field="qty" data-args="${attr(Object.assign({ route: 'owned' }, base))}" ${dis(have > 0)}>${icon('hold')}Install from hold</button>
              <button class="btn sm" data-act="givePart" data-from="#q-part-${esc(id)}-${line}" data-field="qty" data-args="${attr(Object.assign({ route: 'buy' }, base))}" ${dis(!buyWhy)} title="${esc(buyWhy)}">${icon('gold')}Buy · ${gp(E.buyPrice(CAT, st, it.marketGp))}</button>
              ${it.protected ? '' : `<button class="btn sm" data-act="givePart" data-from="#q-part-${esc(id)}-${line}" data-field="qty" data-args="${attr(Object.assign({ route: 'fabricate' }, base))}" ${dis(!fabWhy)} title="${esc(fabWhy || `Blueprint per copy: ${gp(it.replicaGp)} of coin metal, ${it.replicaKits || 0} kits, ${fmt(it.replicaPu)} PU, ${fmt(it.replicaDays)} days`)}">${icon('fabrication')}Fabricate · ${gp(it.replicaGp)} + ${it.replicaKits || 0} kits + ${fmt(it.replicaPu)} PU</button>`}
            </div>${buyWhy ? `<div class="req-note">${esc(buyWhy)}</div>` : ''}</div>`;
        }).join('');
      }
      const opted = masked ? 'Kubix cannot decode this part yet' : locked ? `using ${IX.item[locked].name}` : `any one of: ${opts.map((o) => IX.item[o].name).join(' / ')}`;
      html += reqRow(esc(masked ? 'Encrypted part' : c.label), 'item', p.parts[line], c.qty, '', body, esc(opted), true);
    });
    const teams = E.teams(st).bay; const busy = E.busyTeams(CAT, st);
    if (s.state === 'building') {
      html += `<div class="work-box building"><div class="wb-k">Under construction</div><div class="wb-v">${fmt(p.daysLeft)} <small style="font-size:14px;color:var(--muted)">of ${fmt(s.workDays)} work days left</small></div><div class="bar"><i style="width:${(1 - p.daysLeft / Math.max(1, s.workDays)) * 100}%;background:var(--amber)"></i></div><div class="help" style="margin:0">Work advances each day (GM: Next day).</div></div>`;
    } else if (s.state === 'locked') {
      html += `<div class="work-box"><div class="wb-k">Locked</div><div class="help" style="margin:0">Bring the required systems online first. ${fmt(s.workDays)} work days once supplied.</div></div>`;
    } else {
      const free = busy < teams;
      const slotCap = E.slotCapacity(CAT, st, hull); const slotUsed = E.slotsUsed(CAT, st, hull);
      const slotsOk = !u.slots || slotUsed + u.slots <= slotCap;
      html += `<div class="work-box ${s.funded ? 'ready' : ''}"><div class="wb-k">${s.funded ? 'Ready' : 'Work'}</div><div class="wb-v">${fmt(s.workDays)} work day${s.workDays === 1 ? '' : 's'}</div>
        <div class="help" style="margin:0">Work teams busy: ${busy} / ${teams}.${p.extraDays ? ` Includes ${fmt(p.extraDays)} fabrication days.` : ''}${u.slots ? ` System slots: ${slotUsed} of ${slotCap} used; this needs ${u.slots}.` : ''}</div>
        <button class="btn go" data-act="startWork" data-id="${esc(id)}" ${dis(s.funded && free && slotsOk && !s.exclusive)}>${icon('fabrication')}Start work</button>
        ${s.funded && !free ? '<div class="req-note">Every work team is busy.</div>' : ''}${!slotsOk ? '<div class="req-note">Not enough free system slots — a mounting upgrade adds more.</div>' : ''}</div>`;
    }
    return html + gmRow(s);
  }
  function gmRow(s) {
    if (!S.gm) return '';
    const p = s.p; const any = p.paid.gp > 0 || p.paid.kits > 0 || p.paid.pu > 0 || p.parts.some((n) => n > 0);
    return `<div class="gm-row"><button class="btn gm sm" data-act="reveal" data-args="${attr({ id: s.id, revealed: !p.revealed })}">${p.revealed ? 'Hide from players' : 'Reveal to players'}</button>
      ${s.state === 'building' ? `<button class="btn gm sm" data-act="finishNow" data-id="${esc(s.id)}">Finish now</button>` : ''}
      ${p.status === 'planned' && any ? `<button class="btn gm sm" data-act="refundProject" data-id="${esc(s.id)}">Refund supplies to the hold</button>` : ''}</div>`;
  }

  // ------------------------------------------------------------------ views: tree
  function viewTree() {
    const lane = (hull) => {
      const h = IX.hull[hull];
      const t = E.tier(CAT, S.state, hull);
      if (hull === 'shuttle' && !found() && !S.gm) {
        return `<div class="lane sealed-lane"><div class="lane-name"><h3>Hangar bay</h3><span>Sealed</span></div>
          <button class="node st-classified sealed-node" data-ui="open-project" data-id="k_hangar">${icon('lock')}<div><div class="n-name">NO SIGNAL</div><div class="n-sub">Open the hangar to find out what is in there</div></div></button></div>`;
      }
      return `<div class="lane" data-hull="${hull}"><div class="lane-name"><h3>${esc(hullName(hull))}</h3><span>${`Tier ${t} of ${h.maxTier}`}</span></div>
        ${h.tiers.map((tier) => {
          const nodes = CAT.upgrades.filter((u) => u.hull === hull && u.tier === tier.tier).map((u) => status(u.id));
          const known = nodes.some((n) => n.state !== 'classified');
          return `<div class="tier-col"><div class="tier-col-head ${tier.tier <= t && known ? 'reached' : ''}">Tier ${tier.tier}<b>${known ? esc(tier.name) : 'Encrypted'}</b></div>
            ${nodes.map((n) => `<button class="node st-${n.state}" data-node="${esc(n.id)}" ${n.state === 'classified' ? 'disabled' : `data-ui="open-project" data-id="${esc(n.id)}"`}>${icon(n.state === 'classified' ? 'lock' : n.u.track)}
              <div><div class="n-name">${n.state === 'classified' ? 'ENCRYPTED' : esc(n.u.name)}</div><div class="n-sub">${n.state === 'classified' ? `Tier ${n.u.tier} schematic` : STATE_LABEL[n.state]}</div></div>
              ${['funding', 'building'].includes(n.state) ? `<div class="mini-bar"><i style="width:${Math.round((n.state === 'building' ? 1 - n.p.daysLeft / Math.max(1, n.workDays) : n.progress) * 100)}%"></i></div>` : ''}</button>`).join('')}</div>`;
        }).join('')}</div>`;
    };
    return `<div class="view-head"><div><div class="eyebrow">Refit program</div><h1>Upgrade <span class="accent">tree</span></h1><p class="lede">Each tier needs named systems online. Money buys labor and ordinary parts; the rare pieces have to be found. Encrypted schematics decode as the ship recovers.</p></div>
      <div class="legend">${['installed', 'building', 'ready', 'funding', 'open', 'locked', 'classified'].concat(CAT.upgrades.some((u) => status(u.id).state === 'unknown') ? ['unknown'] : []).map(pill).join('')}</div></div>
      <section class="panel"><div class="panel-body tree-wrap"><div class="tree" id="tree"><svg class="links" id="links"></svg>${lane('kex')}${lane('shuttle')}</div></div></section>`;
  }
  function drawLinks() {
    const tree = $('#tree'); const svg = $('#links'); if (!tree || !svg) return;
    const box = tree.getBoundingClientRect();
    const pos = {};
    $$('.node[data-node]', tree).forEach((n) => { const r = n.getBoundingClientRect(); pos[n.dataset.node] = { l: r.left - box.left, r: r.right - box.left, y: r.top - box.top + r.height / 2 }; });
    const paths = [];
    CAT.upgrades.forEach((u) => {
      const s = status(u.id); if (s.state === 'classified') return;
      u.requires.concat(...(u.requiresAny || [])).forEach((r) => {
        const a = pos[r]; const b = pos[u.id]; if (!a || !b || status(r).state === 'classified') return;
        const x1 = a.r; const x2 = b.l; const mx = (x1 + x2) / 2;
        const cls = E.installed(S.state, u.id) ? 'done' : E.installed(S.state, r) && ['funding', 'building', 'ready'].includes(s.state) ? 'hot' : E.installed(S.state, r) ? 'done' : '';
        paths.push(`<path class="${cls}" d="M${x1} ${a.y}C${mx} ${a.y} ${mx} ${b.y} ${x2} ${b.y}"/>`);
      });
    });
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.innerHTML = paths.join('');
  }

  // ------------------------------------------------------------------ views: hold
  function viewHold() {
    const st = S.state; const m = IX.market[st.market] || CAT.markets[0];
    const hullOpts = (sel) => ['kex', 'shuttle'].filter((h) => h === 'kex' || found()).map((h) => `<option value="${h}" ${h === sel ? 'selected' : ''}>${esc(IX.hull[h].name)}</option>`).join('');
    const channeled = Object.entries(st.channeled || {});
    const inv = Object.entries(st.inventory).filter(([, q]) => q > 0).map(([id, q]) => ({ it: IX.item[id], q })).filter((x) => x.it).sort((a, b) => a.it.name.localeCompare(b.it.name));
    const archive = E.installed(st, 'k_pattern_archive');
    const filter = S.marketFilter.toLowerCase();
    // Some stock stays off the players' list until the schematic that needs it is revealed (the GM sees everything).
    const unrevealed = (i) => !!i.revealWith && !st.projects[i.revealWith].revealed && !(st.inventory[i.id] > 0);
    const market = CAT.items.filter((i) => (S.gm || !unrevealed(i)) && (!filter || `${i.name} ${i.family}`.toLowerCase().includes(filter)));
    return `<div class="view-head"><div><div class="eyebrow">Cargo · fuel · workshop</div><h1>Hold & <span class="accent">workshop</span></h1><p class="lede">Every magic item can do <b>one</b> job: <b>install</b> it into a system, <b>learn</b> it (destroyed so the archive can copy its pattern), or <b>recycle</b> it (destroyed for a little fuel). Raw ether is the real fuel.</p></div></div>
    <div class="hold-grid">
      <section class="panel"><div class="panel-head"><h2>Load fuel</h2></div><div class="panel-body">
        <p class="help">1 raw chunk = ${fmt(E.puPerChunk(CAT))} PU (4 chunks = 1 lb). 1 refined disk = ${fmt(CAT.economy.refinedPuEach)} PU — disks are ammunition; burning them is wasteful.</p>
        <div class="form-row"><label for="rf-hull">Into</label><select class="field" id="rf-hull">${hullOpts('kex')}</select></div>
        <div class="form-row"><label for="rf-ch">Chunks</label><input type="number" id="rf-ch" min="0" value="${Math.min(4, st.rawChunks)}"><label for="rf-dk">Disks</label><input type="number" id="rf-dk" min="0" value="0"></div>
        <button class="btn primary" data-ui="refuel">${icon('ether')}Load into reserve</button></div></section>
      <section class="panel"><div class="panel-head"><h2>Mage channeling</h2></div><div class="panel-body">
        <p class="help">A caster spends a two-hour watch pouring expended spell slots into the ship: 1 PU per slot level, max ${E.CHANNEL_CAP} PU per caster per day. No cantrips.</p>
        <div class="form-row"><label for="mc-name">Caster</label><input type="text" id="mc-name" list="crew-list" maxlength="40" value="${esc(S.actor === 'Party fund' ? '' : S.actor)}" placeholder="Name" style="width:130px"><datalist id="crew-list">${st.crew.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <div class="form-row"><label for="mc-lv">Slot levels</label><input type="number" id="mc-lv" min="1" max="${E.CHANNEL_CAP}" value="3"><label for="mc-hull">Into</label><select class="field" id="mc-hull">${hullOpts('kex')}</select></div>
        <button class="btn primary" data-ui="channel">${icon('power')}Channel</button>
        ${channeled.length ? `<p class="help" style="margin-top:10px">Today: ${channeled.map(([k, v]) => `${esc(E.channelName(k))} ${fmt(v)}/${E.CHANNEL_CAP}`).join(' · ')}</p>` : ''}</div></section>
      <section class="panel"><div class="panel-head"><h2>Supply run</h2><span class="chip">${esc(m.name)} ×${fmt(m.multiplier)}</span></div><div class="panel-body">
        <p class="help">Prices at the current market. ${esc(m.name)}: deliveries take about ${fmt(m.deliveryDays)} days. Fabrication kits (base metal) cost the same everywhere — or melt scrap: ${fmt(CAT.itemRules.metalLbPerKit)} lb of metal gear = 1 kit (the GM records it).</p>
        <div class="form-row"><input type="number" id="by-ch" min="1" value="20" aria-label="Raw chunks"><button class="btn" data-ui="buy-raw">${icon('ether')}Buy raw chunks · ${gp(E.chunkPrice(CAT, st))} ea</button></div>
        <div class="form-row"><input type="number" id="by-kit" min="1" value="5" aria-label="Kits"><button class="btn" data-ui="buy-kits">${icon('kit')}Buy kits · ${gp(E.kitPrice(CAT))} ea</button></div>
        ${found() ? `<div class="pd-section">Transfer charge</div><div class="form-row"><select class="field" id="tr-from"><option value="kex">Kex → ${esc(IX.hull.shuttle.name)}</option><option value="shuttle">${esc(IX.hull.shuttle.name)} → Kex</option></select><input type="number" id="tr-pu" min="1" value="20" aria-label="PU"><button class="btn" data-ui="transfer">${icon('power')}Transfer</button></div>` : ''}
        </div></section>
      <section class="panel span-3"><div class="panel-head"><h2>Workshop · items in the hold</h2><span class="chip">${archive ? `Pattern archive ${E.patternCount(st)}/${E.ARCHIVE_CAP}` : 'Pattern archive offline'}</span></div><div class="panel-body">
        ${inv.length ? `<div class="items">${inv.map(({ it, q }) => itemCard(it, q, archive)).join('')}</div>` : '<p class="empty">No components or donor items in the hold. Buy them below, or the GM records what the party brings aboard.</p>'}
        ${E.patternCount(st) ? `<div class="pd-section">Pattern archive · blueprints</div><div class="blueprints">${st.patterns.map((p) => { const it = IX.item[p]; return `<div class="bp"><b>${esc(it.name)}</b><span>${gp(it.replicaGp)} coin metal · ${it.replicaKits || 0} kits · ${fmt(it.replicaPu)} PU · ${fmt(it.replicaDays)} d per copy</span></div>`; }).join('')}${(st.codexPatterns || []).map((cp) => { const v = E.itemValue(CAT, cp.rarity, cp.consumable); return `<div class="bp"><b>${esc(cp.name)}</b><span>${gp(v.blueprint.gp)} coin metal · ${v.blueprint.kits} kits · ${fmt(v.blueprint.pu)} PU · ${fmt(v.blueprint.days)} d per copy · the GM decides which system can use it</span></div>`; }).join('')}</div>` : ''}
        <p class="help">Want to know what another item is worth? Look it up in the <a href="#/codex">item codex</a> — every D&amp;D item, piece of gear and spell.</p>
        </div></section>
      ${materialsPanel(st)}
      <section class="panel span-3"><div class="panel-head"><h2>Market & salvage catalog</h2><input type="text" id="mk-filter" placeholder="Filter…" value="${esc(S.marketFilter)}" style="width:200px" aria-label="Filter catalog"></div><div class="panel-body" style="overflow-x:auto">
        <table class="market-table"><thead><tr><th>Item</th><th>Family</th><th>Availability</th><th>Price here</th><th>Recycle</th><th></th></tr></thead><tbody>
        ${market.map((i) => { const why = E.buyBlock(CAT, st, i.id, S.gm); return `<tr><td><b>${esc(i.name)}</b>${unrevealed(i) ? ' <span class="tag" style="color:var(--violet)">Hidden from players</span>' : ''}<div class="req-note">${esc(i.description)}</div></td><td>${esc(i.family)}</td><td><span class="avail ${esc(i.availability)}">${esc(i.availability)}</span></td>
          <td class="num">${i.availability === 'quest' ? '—' : gp(E.buyPrice(CAT, st, i.marketGp))}</td><td class="num">${i.salvagePu ? `${fmt(i.salvagePu)} PU` : '—'}</td>
          <td style="white-space:nowrap">${i.availability === 'quest' ? (S.gm ? `<button class="btn gm sm" data-act="adjust" data-args="${attr({ field: `item:${i.id}`, delta: 1, reason: 'found in play' })}">Record find</button>` : '<span class="req-note">Must be found</span>') : `<button class="btn sm" data-act="buyItem" data-args="${attr({ itemId: i.id, qty: 1 })}" ${why ? 'disabled' : ''} title="${esc(why)}">${icon('plus')}Buy 1</button>`}</td></tr>`; }).join('')}
        </tbody></table></div></section>
    </div>`;
  }
  // Material analysis: Kubix only knows the metals it has been fed (GM ruling 2026-09-30).
  function materialsPanel(st) {
    const list = CAT.materials || [];
    if (!list.length) return '';
    const byId = Object.fromEntries(list.map((m) => [m.id, m]));
    const stageOf = (m) => E.materialStage(CAT, st, m.id);
    const nameIfKnown = (id) => (byId[id] && stageOf(byId[id]) !== 'unknown' ? esc(byId[id].name) : 'unknown material');
    const seen = list.filter((m) => stageOf(m) !== 'unknown');
    const unknown = list.length - seen.length;
    const card = (m) => {
      const s = stageOf(m); const fed = (st.materials || {})[m.id] || 0;
      const roles = m.roles.length ? m.roles.map(([r, n]) => `<span class="tag role">${esc(r)} ${'★'.repeat(n)}</span>`).join(' ') : '<span class="req-note">No ship use</span>';
      const more = `${m.note ? `<div class="req-note">${esc(m.note)}</div>` : ''}${m.recipe ? `<div class="req-note">Recipe: ${m.recipe.inputs.map(([id, q]) => `${fmt(q)} ${nameIfKnown(id)}`).join(' + ')}${m.recipe.ritual ? ' · needs a ritual Kubix cannot perform' : ''}</div>` : ''}`;
      const body = s === 'sampled'
        ? `<div class="bar"><i style="width:${Math.min(100, (fed / m.researchBars) * 100)}%"></i></div><div class="req-note">Analyzing: ${fmt(fed)} / ${fmt(m.researchBars)} bar-equivalents</div>`
        : `<div class="ic-meta">${roles}</div>${more ? `<details class="mat-more"><summary>Details</summary>${more}</details>` : ''}`;
      return `<div class="mat-card ${s}"><div class="ic-top"><div class="ic-name">${esc(m.name)}</div><span class="tag">${esc(m.tier)}</span></div>${body}</div>`;
    };
    const unknownRow = unknown ? `<div class="mat-unknown">${Array.from({ length: unknown }, () => '<span class="mat-q" title="Unknown material: feed Kubix a sample to identify it">Unknown</span>').join('')}<span class="req-note">${unknown} unknown material${unknown === 1 ? '' : 's'}: feed Kubix a sample to identify one.</span></div>` : '';
    const feedable = list.filter((m) => stageOf(m) !== 'analyzed');
    const gmForm = S.gm && feedable.length ? `<div class="form-row" style="margin-top:12px"><select class="field" id="fm-mat" aria-label="Material fed">${feedable.map((m) => `<option value="${esc(m.id)}" ${m.id === S.fmMat ? 'selected' : ''}>${esc(m.name)} (${esc(m.tier)}, ${fmt(m.researchPu)} PU per bar)</option>`).join('')}</select><input type="number" id="fm-bars" min="1" value="1" aria-label="Bar-equivalents"><button class="btn gm" data-ui="feed-material">Feed to the analyzer</button></div><p class="help">GM: record what the party feeds in. An item counts as the bars it was forged from (dagger 1, sword 3, plate 15). It is destroyed; bars beyond what analysis needs are not taken.</p>` : '';
    return `<section class="panel span-3 materials-panel"><div class="panel-head"><h2>Material analysis</h2><span class="chip">${seen.filter((m) => stageOf(m) === 'analyzed').length} understood · ${unknown} unknown</span></div><div class="panel-body">
      <p class="help">Kubix only knows the metals and crystals it has been fed. A sample identifies a new material; enough of it and Kubix understands what it can do for the ship.</p>
      <div class="mat-grid">${seen.map(card).join('')}</div>${unknownRow}${gmForm}</div></section>`;
  }
  function itemCard(it, q, archive) {
    const learnWhy = it.protected || !it.replicaPu ? 'Cannot be copied' : !archive ? 'Needs the pattern archive' : S.state.patterns.includes(it.id) ? 'Already learned' : '';
    return `<div class="item-card"><div class="ic-top"><div class="ic-name">${esc(it.name)}</div><div class="ic-qty">×${fmt(q)}</div></div>
      <div class="ic-meta">${esc(it.family)} · worth ${gp(it.marketGp)}${S.state.patterns.includes(it.id) ? ' · <span class="badge-pattern">PATTERN</span>' : ''}</div>
      <div class="ic-actions">
        ${it.protected ? '<span class="req-note">Unique — install only</span>' : `
        <button class="btn sm" data-act="learn" data-args="${attr({ itemId: it.id })}" ${learnWhy ? 'disabled' : ''} title="${esc(learnWhy || `Destroy one to learn its pattern (${fmt(it.learnPu)} PU)`)}">${icon('fabrication')}Learn · ${fmt(it.learnPu)} PU</button>
        <button class="btn sm warn" data-act="recycle" data-args="${attr({ itemId: it.id })}" title="Destroy one for fuel">${icon('power')}Recycle · +${fmt(it.salvagePu)} PU</button>`}
        ${S.gm ? `<button class="btn gm sm" data-act="adjust" data-args="${attr({ field: `item:${it.id}`, delta: 1 })}">+1</button><button class="btn gm sm" data-act="adjust" data-args="${attr({ field: `item:${it.id}`, delta: -1 })}">−1</button>` : ''}
      </div></div>`;
  }

  // ------------------------------------------------------------------ views: log
  const LOG_FILTERS = [['all', 'All'], ['build', 'Builds', ['build', 'install', 'reveal', 'quest']], ['power', 'Power', ['power', 'recycle', 'warn']], ['gold', 'Purchases', ['gold', 'kits']], ['part', 'Parts', ['part', 'learn']], ['gm', 'GM', ['gm']]];
  function viewLog() {
    const f = LOG_FILTERS.find((x) => x[0] === S.logFilter) || LOG_FILTERS[0];
    const list = f[2] ? S.state.log.filter((l) => f[2].includes(l.kind) || l.kind === 'day') : S.state.log;
    return `<div class="view-head"><div><div class="eyebrow">Day ${fmt(S.state.day)}</div><h1>Ship's <span class="accent">log</span></h1><p class="lede">Every contribution, build and correction, newest first.</p></div>
      <div class="legend"><div class="seg">${LOG_FILTERS.map(([k, l]) => `<button class="${k === f[0] ? 'on' : ''}" data-ui="log-filter" data-k="${k}">${l}</button>`).join('')}</div><button class="btn sm" data-ui="copy-log">${icon('log')}Copy as text</button></div></div>
      <section class="panel"><div class="panel-body">${logItems(list)}</div></section>`;
  }


  // ------------------------------------------------------------------ views: codex (every item's worth to the ship)
  const CODEX_TABS = [['magic', 'Magic items'], ['gear', 'Equipment & salvage'], ['spells', 'Spells'], ['campaign', 'Campaign items']];
  S.codex = { tab: 'magic', q: '', rarity: '', role: '', limit: 120 };
  function loadCodex() {
    if (window.KEX_CODEX || S.codexLoading) return;
    S.codexLoading = true;
    const sc = document.createElement('script');
    sc.src = `data/codex.js?v=${encodeURIComponent(window.KEX_ASSET_VERSION || CAT.version)}`;
    sc.onload = () => { S.codexLoading = false; if (S.route === 'codex') renderView(); };
    sc.onerror = () => { S.codexLoading = false; toast('Could not load the item codex.', 'err'); };
    document.body.appendChild(sc);
  }
  const rarityChip = (key, star) => `<span class="rar r-${key.replace(' ', '-')}">${esc(key)}${star ? ' *' : ''}</span>`;
  const roleChips = (idx, names) => idx.map((i) => `<span class="tag role">${esc(names[i])}</span>`).join('');
  function valueCells(v) {
    return `<td class="num">${fmt(v.fuel)} PU</td><td class="num">${v.copyable ? `${fmt(v.learnPu)} PU` : '—'}</td>
      <td class="num">${v.blueprint ? `${fmt(v.blueprint.gp)} gp · ${v.blueprint.kits} kit${v.blueprint.kits === 1 ? '' : 's'} · ${fmt(v.blueprint.pu)} PU · ${fmt(v.blueprint.days)} d` : 'cannot copy'}</td>`;
  }
  const feedButtons = (name, key, consumable) => `<button class="btn sm" data-act="feedItem" data-args="${attr({ name, rarity: key, consumable: !!consumable, mode: 'learn' })}" title="Destroy it to learn its pattern">${icon('fabrication')}Learn</button>
      <button class="btn sm warn" data-act="feedItem" data-args="${attr({ name, rarity: key, consumable: !!consumable, mode: 'recycle' })}" title="Destroy it for fuel">${icon('power')}Recycle</button>`;
  function codexRules() {
    const rows = Object.entries(CAT.itemRules.rarity).map(([key, r]) => { const v = E.itemValue(CAT, key, false);
      return `<tr><td>${rarityChip(key)}</td><td class="num">${fmt(r.fuel)} PU</td><td class="num">${v.copyable ? `${fmt(v.learnPu)} PU` : '—'}</td><td class="num">${v.blueprint ? `${fmt(v.blueprint.gp)} gp · ${v.blueprint.kits} kits · ${fmt(v.blueprint.pu)} PU · ${fmt(v.blueprint.days)} d` : 'never copied'}</td></tr>`; }).join('');
    return `<section class="panel codex-rules"><div class="panel-head"><h2>How the ship values things</h2></div><div class="panel-body">
      <div class="rules-grid"><div class="rules-table"><table class="market-table"><thead><tr><th>Rarity</th><th>Recycle (fuel)</th><th>Learn (item destroyed)</th><th>Blueprint, per copy</th></tr></thead><tbody>${rows}</tbody></table></div>
      <ul class="rules-list">
        <li><b>The ship takes metal, not payment.</b> Coins are melted as precious-metal feedstock (conductors, lattices, field coils). Gems, bullion and jewelry count at their trade value.</li>
        <li><b>Fabrication kits are base metal.</b> Buy them, or melt mundane metal gear: every ${CAT.itemRules.metalLbPerKit} lb of metal is 1 kit.</li>
        <li><b>Learning</b> destroys the item completely — no fuel back — and stores its pattern. Every copy after that costs the blueprint.</li>
        <li><b>Copies are hull-bound modules,</b> never wearable items. Big systems on the Kex need many copies; smaller systems need one or two.</li>
        <li><b>Consumables</b> (potions, scrolls, ammunition, dusts) count half. <b>Artifacts</b> are never copied; recycling one needs the GM's approval.</li>
        <li><b>Raw ether is the real fuel:</b> ${fmt(E.puPerChunk(CAT))} PU a chunk. A legendary relic is worth only a few pounds of it.</li>
        <li>* “Varies” or unknown rarity: the uncommon line is shown — check the item's actual rarity.</li>
      </ul></div></div></section>`;
  }
  function viewCodex() {
    const head = `<div class="view-head"><div><div class="eyebrow">Replicator reference</div><h1>Item <span class="accent">codex</span></h1><p class="lede">Every magic item, piece of gear and spell — and what it is worth to the ship: fuel, the cost to learn its pattern, and the blueprint for each copy. Names link to D&amp;D Beyond.</p></div></div>`;
    if (!window.KEX_CODEX) { loadCodex(); return `${head}<section class="panel"><div class="panel-body"><p class="empty">Loading the codex…</p></div></section>`; }
    const C = window.KEX_CODEX; const c = S.codex; const q = c.q.trim().toLowerCase();
    const tabs = `<div class="seg codex-tabs">${CODEX_TABS.map(([k, l]) => `<button class="${k === c.tab ? 'on' : ''}" data-ui="codex-tab" data-k="${k}">${l}</button>`).join('')}</div>`;
    const rarityOpts = `<option value="">Any rarity</option>${C.rules.rarity.map((r, i) => `<option value="${i}" ${String(i) === c.rarity ? 'selected' : ''}>${esc(r.key)}</option>`).join('')}`;
    const roleOpts = `<option value="">Any ship system</option>${C.roles.map((r, i) => `<option value="${i}" ${String(i) === c.role ? 'selected' : ''}>${esc(r)}</option>`).join('')}`;
    const filters = `<div class="form-row codex-filters"><input type="text" id="codex-q" placeholder="Search…" value="${esc(c.q)}" aria-label="Search the codex">
      ${c.tab === 'magic' || c.tab === 'campaign' ? `<select class="field" data-ui-change="codex-rarity" aria-label="Rarity">${rarityOpts}</select><select class="field" data-ui-change="codex-role" aria-label="Ship system">${roleOpts}</select>` : ''}</div>`;
    let rows = []; let table = '';
    if (c.tab === 'magic') {
      rows = C.magic.filter((m) => (!q || `${m[0]} ${m[2]} ${m[3]} ${m[5]}`.toLowerCase().includes(q)) && (c.rarity === '' || String(m[1]) === c.rarity) && (c.role === '' || m[7].includes(Number(c.role))));
      table = `<thead><tr><th>Item</th><th>Rarity</th><th>Ship systems</th><th>Recycle</th><th>Learn</th><th>Blueprint / copy</th><th></th></tr></thead><tbody>${rows.slice(0, c.limit).map((m) => {
        const key = C.rules.rarity[m[1]].key; const v = E.itemValue(CAT, key, !!m[6]);
        return `<tr><td><a href="https://www.dndbeyond.com/magic-items/${esc(m[8])}" target="_blank" rel="noopener">${esc(m[0])}</a>${m[4] ? ' <span class="tag">attune</span>' : ''}<div class="req-note">${esc(m[2])}${m[3] ? ` · ${esc(m[3])}` : ''}${m[5] ? ` · ${esc(m[5])}` : ''}</div></td>
          <td>${rarityChip(key, m[9])}${m[6] ? '<div class="req-note">consumable ×½</div>' : ''}</td><td>${roleChips(m[7], C.roles)}</td>${valueCells(v)}<td class="acts">${feedButtons(m[0], key, m[6])}</td></tr>`; }).join('')}</tbody>`;
    } else if (c.tab === 'gear') {
      rows = C.equipment.filter((e) => !q || `${e[0]} ${e[1]}`.toLowerCase().includes(q));
      const val = (e) => (e[4] === 'metal' ? `≈ ${fmt(e[5])} kit${e[5] === 1 ? '' : 's'} of base metal` : e[4] === 'precious' ? `${fmt(e[5])} gp of feedstock` : e[4] === 'magic' ? 'consumable magic: see Magic items' : e[4] === 'vehicle' ? 'salvage hull — the GM decides' : '—');
      table = `<thead><tr><th>Item</th><th>Category</th><th>Cost</th><th>Weight</th><th>Worth to the ship</th></tr></thead><tbody>${rows.slice(0, c.limit).map((e) => `<tr><td>${e[6] ? `<a href="https://www.dndbeyond.com${esc(e[6])}" target="_blank" rel="noopener">${esc(e[0])}</a>` : esc(e[0])}</td><td>${esc(e[1])}</td><td class="num">${e[2] === null ? '—' : `${fmt(e[2])} gp`}</td><td class="num">${e[3] === null ? '—' : `${fmt(e[3])} lb`}</td><td class="gear-${esc(e[4])}">${val(e)}</td></tr>`).join('')}</tbody>`;
    } else if (c.tab === 'spells') {
      rows = C.spells.filter((s) => !q || `${s[0]} ${s[2]}`.toLowerCase().includes(q));
      table = `<thead><tr><th>Spell</th><th>Level</th><th>Channeled</th><th>Ship uses</th><th>Its scroll, fed to the archive</th></tr></thead><tbody>${rows.slice(0, c.limit).map((s) => {
        const key = C.rules.scrollRarity[s[1]] || 'common'; const v = E.itemValue(CAT, key, true);
        return `<tr><td><a href="https://www.dndbeyond.com/spells/${esc(s[5])}" target="_blank" rel="noopener">${esc(s[0])}</a><div class="req-note">${esc(s[2])} · ${esc(s[3])}</div></td><td>${s[1] ? `${s[1]}` : 'cantrip'}</td>
          <td class="num">${s[1] ? `${s[1]} PU per slot` : '0 (no cantrips)'}</td><td>${s[4].map((i) => `<span class="tag role">${esc(C.spellUses[i])}</span>`).join('') || '<span class="req-note">—</span>'}</td>
          <td class="num">${rarityChip(key)} learn ${fmt(v.learnPu)} PU</td></tr>`; }).join('')}</tbody>`;
    } else {
      rows = C.campaign.filter((i) => (!q || i[0].toLowerCase().includes(q)) && (c.rarity === '' || String(i[1]) === c.rarity) && (c.role === '' || i[4].includes(Number(c.role))));
      table = `<thead><tr><th>Item</th><th>Rarity</th><th>Ship systems</th><th>Recycle</th><th>Learn</th><th>Blueprint / copy</th><th></th></tr></thead><tbody>${rows.slice(0, c.limit).map((i) => {
        const key = i[1] >= 0 ? C.rules.rarity[i[1]].key : ''; const v = key && !i[5] ? E.itemValue(CAT, key, !!i[3]) : null;
        return `<tr><td><a href="../items/${esc(i[8])}.html" target="_blank" rel="noopener">${esc(i[0])}</a>${i[5] ? ' <span class="tag prot">protected</span>' : ''}${i[7] ? `<div class="req-note">${esc(i[7])}</div>` : ''}</td>
          <td>${key ? rarityChip(key) : '—'}${i[2] ? '<div class="req-note">estimated</div>' : ''}</td><td>${roleChips(i[4], C.roles)}</td>
          ${v ? valueCells(v) : `<td class="num" colspan="3">${esc(i[6] || '—')}</td>`}<td class="acts">${v ? feedButtons(i[0], key, i[3]) : ''}</td></tr>`; }).join('')}</tbody>`;
    }
    const more = rows.length > c.limit ? `<div class="form-row" style="margin-top:10px"><button class="btn" data-ui="codex-more">Show more (${rows.length - c.limit} left)</button></div>` : '';
    return `${head}${codexRules()}<section class="panel"><div class="panel-head">${tabs}<span class="chip">${rows.length} match${rows.length === 1 ? '' : 'es'}</span></div><div class="panel-body">${filters}
      <p class="help">Learn needs the pattern archive online. Anything you feed here is logged; the item itself is handed over at the table.</p>
      <div style="overflow-x:auto"><table class="market-table codex-table">${table}</table></div>${more}</div></section>`;
  }

  // ------------------------------------------------------------------ office modal
  function openOffice() {
    const st = S.state;
    const fields = [['treasury', 'Treasury (gp)'], ['rawChunks', 'Raw chunks'], ['refinedDisks', 'Refined disks'], ['kits', 'Fabrication kits'], ['charge:kex', 'Kex charge'], ['strain:kex', 'Kex strain'], ['reactorFuel', 'Reactor fuel (PU)']]
      .concat(found() ? [['charge:shuttle', `${IX.hull.shuttle.name} charge`], ['strain:shuttle', `${IX.hull.shuttle.name} strain`]] : []);
    modal(`<section class="panel modal" role="dialog" aria-modal="true" aria-label="Ship's office"><div class="panel-head"><h2>Ship's office</h2><button class="btn sm icon-only ghost" data-ui="close" aria-label="Close">${icon('x')}</button></div><div class="panel-body">
      <div><h2>Save & share</h2><p class="help">Changes save automatically in this browser. Download a save to move it to another device or send a proposed plan to the GM.</p>
        <div class="form-row"><button class="btn" data-ui="export">${icon('save')}Download save</button><button class="btn" data-ui="import">${icon('undo')}Load save…</button><input type="file" id="import" accept=".json,application/json" hidden><button class="btn danger" data-ui="reset">Reset to official record</button></div>
        <p class="help">Official record: revision ${fmt(official.revision || 0)}${official.label ? ` · ${esc(official.label)}` : ''}. ${dirty() ? 'This device differs from it.' : 'This device matches it.'}</p></div>
      ${S.gm ? `
      <div><h2>Publish (GM)</h2><p class="help">Downloads <b>state.js</b>. Replace <code>public/data/state.js</code> with it and push; every player's page then offers to load it.${S.pendingUpdate ? ' <b style="color:var(--amber)">Load the newer official record first (banner at the top).</b>' : ''}</p>
        <div class="form-row"><button class="btn primary" data-ui="publish" ${S.pendingUpdate ? 'disabled' : ''}>${icon('save')}Publish official record</button></div></div>
      <div><h2>Session</h2><div class="form-row"><label for="of-label">Label</label><input type="text" id="of-label" maxlength="160" value="${esc(st.label)}" style="flex:1;min-width:200px"><label for="of-day">Day</label><input type="number" id="of-day" min="1" value="${fmt(st.day).replace(/,/g, '')}"><button class="btn gm" data-ui="set-label">Apply</button></div></div>
      <div><h2>Crew names</h2><p class="help">One per line. Used to credit contributions and for mage channeling.</p><textarea id="of-crew" rows="4" style="width:100%;background:rgba(3,10,18,.85);border:1px solid var(--line-2);border-radius:7px;color:var(--text);padding:8px">${esc(st.crew.join('\n'))}</textarea><div class="form-row" style="margin-top:8px"><button class="btn gm" data-ui="set-crew">Save crew</button></div></div>
      <div><h2>Reveal schematics</h2><div class="form-row"><select class="field" id="of-rh"><option value="kex">Kex</option><option value="shuttle">${found() ? esc(IX.hull.shuttle.name) : 'Hangar bay'}</option></select><select class="field" id="of-rt">${[1, 2, 3, 4, 5].map((t) => `<option value="${t}">Tier ${t}</option>`).join('')}</select><button class="btn gm" data-ui="reveal-tier">Reveal tier</button></div></div>
      <div><h2>Correct the record</h2><p class="help">For things that happened at the table: donations, loot, damage, spent ammunition.</p>
        <div class="form-row"><select class="field" id="of-field">${fields.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('')}</select><input type="number" id="of-delta" value="0" step="any" aria-label="Change"><input type="text" id="of-reason" maxlength="120" placeholder="Reason (optional)" style="flex:1;min-width:160px"><button class="btn gm" data-ui="adjust">Apply</button></div></div>` : ''}
      ${S.gmDevice ? `<div><h2>This device</h2><p class="help">GM tools are enabled on this browser.</p><div class="form-row"><button class="btn ghost" data-ui="forget-gm">Remove GM tools from this device</button></div></div>` : ''}
      <div><h2>About</h2><p class="help">Catalog ${esc(CAT.version)} (${esc(CAT.sourceDate)}), generated from the GM's ship catalog. All numbers are draft homebrew and may be tuned between sessions.</p></div>
    </div></section>`);
    const imp = $('#import');
    if (imp) imp.addEventListener('change', importSave);
  }
  function modal(html) { const back = document.createElement('div'); back.className = 'modal-back'; back.innerHTML = html; back.addEventListener('click', (e) => { if (e.target === back) closeModal(); }); document.body.appendChild(back); const f = back.querySelector('button, input, select'); if (f) f.focus(); }
  function closeModal() { $$('.modal-back').forEach((m) => m.remove()); }

  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function importSave(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    if (file.size > 2e6) { toast('That file is too large to be a ship save.', 'err'); return; }
    const r = new FileReader();
    r.onload = () => {
      try {
        const raw = JSON.parse(r.result);
        const st = raw && typeof raw === 'object' && raw.state && typeof raw.state === 'object' ? raw.state : raw;
        if (!st || typeof st !== 'object' || !st.projects || typeof st.projects !== 'object') throw new Error('not a Kex Shipyard save');
        pushUndo(); S.state = E.normalize(CAT, st); writeStore(); closeModal(); render(); toast('Save loaded.', 'install');
      } catch (err) { toast(`Could not load that file: ${err.message}.`, 'err'); }
    };
    r.readAsText(file);
  }
  function publish() {
    if (S.pendingUpdate) { toast('A newer official record exists. Load it first (banner at the top), then publish.', 'err'); return; }
    const rev = Math.max(official.revision || 0, S.base || 0, S.state.revision || 0) + 1;
    const st = E.clone(S.state); st.revision = rev; st.channeled = {};
    const text = `// Official Kex Shipyard record — revision ${rev}, day ${st.day}, published ${new Date().toISOString().slice(0, 10)}.\n// Replace public/data/state.js with this file and push to update every player's view.\nwindow.KEX_OFFICIAL_STATE = ${JSON.stringify(st, null, 1)};\n`;
    download('state.js', text, 'text/javascript');
    S.state.revision = rev; S.base = rev; writeStore(); render();
    toast(`Published revision ${rev}. Replace public/data/state.js and push.`, 'install');
  }

  // ------------------------------------------------------------------ comms, toasts, celebrations
  let typing = null; let quietTimer = null; const lastLine = {};
  function pick(who, kind) {
    const bank = (VOICE[who] && (VOICE[who][kind] || VOICE[who].idle)) || [''];
    let line = bank[Math.floor(Math.random() * bank.length)];
    if (bank.length > 1 && line === lastLine[who]) line = bank[(bank.indexOf(line) + 1) % bank.length];
    lastLine[who] = line;
    return line;
  }
  function say(who, kind, text) {
    const box = $('#comms'); if (!box) return;
    if (who === 'tyndr' && !found()) who = 'kubix';
    const line = text || pick(who, kind);
    const btn = box.querySelector('.avatar-btn');
    btn.innerHTML = ART.avatar(who);
    btn.setAttribute('aria-label', `Talk to ${who === 'tyndr' ? IX.hull.shuttle.ai : IX.hull.kex.ai}`);
    const whoEl = box.querySelector('.b-who'); whoEl.textContent = who === 'tyndr' ? IX.hull.shuttle.ai : `${IX.hull.kex.ai}${IX.hull.kex.alias ? ` / ${IX.hull.kex.alias}` : ''}`; whoEl.className = `b-who ${who}`;
    const t = box.querySelector('.b-text');
    clearInterval(typing); clearTimeout(quietTimer);
    box.classList.remove('quiet');
    quietTimer = setTimeout(() => box.classList.add('quiet'), 9000);
    box.dataset.who = who;
    if (reduceMotion) { t.textContent = line; return; }
    let i = 0; t.textContent = '';
    typing = setInterval(() => { i += 2; t.textContent = line.slice(0, i); if (i >= line.length) clearInterval(typing); }, 18);
  }
  function greet() {
    const who = S.route === 'hangar' && found() ? 'tyndr' : 'kubix';
    const pw = E.power(CAT, S.state, 'kex');
    if (who === 'kubix' && pw.net < 0 && Math.random() < 0.6) return say('kubix', '', `Reserve at ${fmt(pw.charge)} units. At current draw, that lasts about ${fmt(pw.daysLeft)} days.`);
    say(who, Math.random() < 0.5 ? 'greet' : 'idle');
  }
  // Toasts are plain text; nothing from saves or names is ever parsed as HTML.
  function toast(text, cls, who) {
    const el = document.createElement('div'); el.className = `toast ${cls || ''}`; el.setAttribute('role', 'status');
    if (who) { const b = document.createElement('b'); b.textContent = `${who} `; el.appendChild(b); }
    el.appendChild(document.createTextNode(String(text)));
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, cls === 'err' ? 5200 : 3800);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  }
  function celebrate(name) {
    if (reduceMotion) return;
    const el = document.createElement('div'); el.className = 'celebrate';
    el.innerHTML = `<div class="burst"></div><div class="burst b2"></div><div class="c-text"><div class="c-k">SYSTEM ONLINE</div><div class="c-v">${esc(name)}</div></div>`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
  }
  function showRevealModal() {
    const line = VOICE.tyndr.reveal[0];
    modal(`<section class="panel modal reveal-modal" role="dialog" aria-modal="true" aria-label="New contact"><div class="panel-body">
      <div class="rv-k">HANGAR OPEN · NEW CONTACT</div>${ART.avatar('tyndr')}<h3>${esc(IX.hull.shuttle.name.toUpperCase())}</h3>
      <p class="lede" style="margin:0 auto">A shuttle with its own intelligence, buried under the fallen framing. Dig it out, survey the damage and repair it, and it will fly.</p>
      <blockquote>“${esc(line)}”</blockquote>
      <div class="form-row" style="justify-content:center"><button class="btn primary" data-ui="meet-tyndr">${icon('guide')}Meet ${esc(IX.hull.shuttle.name)} (orientation)</button><button class="btn" data-ui="go" data-route="hangar">${icon('ship')}Go to the hangar</button></div></div></section>`);
    say('tyndr', 'reveal', line);
  }

  // ------------------------------------------------------------------ routing & render
  function parseHash() {
    const parts = (location.hash || '#/bridge').replace(/^#\/?/, '').split(/[/?]/);
    const route = ROUTES.includes(parts[0]) ? parts[0] : 'bridge';
    const hull = HULL_OF_ROUTE[route];
    if (hull && parts[1]) {
      const u = IX.up[parts[1]];
      if (u && u.hull !== hull) { location.replace(`#/${ROUTE_OF_HULL[u.hull]}/${u.id}`); return false; }
      if (u) { S.sel[hull] = { zone: u.zone, project: u.id }; followDeck(hull, u.zone); }
      else if (zoneOf(hull, parts[1])) { S.sel[hull] = { zone: parts[1], project: null }; followDeck(hull, parts[1]); }
      else S.sel[hull] = { zone: null, project: null };
    } else if (hull) S.sel[hull] = { zone: null, project: null };
    if (route !== S.route) { S.route = route; S.mounted = null; S.peek = false; window.scrollTo(0, 0); }
    return true;
  }
  function go(route, sub) { location.hash = `#/${route}${sub ? `/${sub}` : ''}`; }
  function openProject(id) {
    const u = IX.up[id]; if (!u) return;
    closeModal();
    go(ROUTE_OF_HULL[u.hull], id);
  }

  function renderView() {
    const hull = HULL_OF_ROUTE[S.route];
    if (hull) {
      if (S.mounted !== mountKey(hull)) mountDeck(hull);
      updateDeck(hull);
      return;
    }
    S.mounted = null;
    const v = { bridge: viewBridge, tree: viewTree, hold: viewHold, codex: viewCodex, log: viewLog }[S.route] || viewBridge;
    $('#view').innerHTML = v();
    if (S.route === 'bridge') $$('.ship-card .mini').forEach((m) => applyShip($('svg', m), m.dataset.hull, null));
    if (S.route === 'tree') requestAnimationFrame(drawLinks);
  }
  function render() {
    try {
      renderTop(); renderResources(); renderBanner(); renderView();
      document.body.classList.toggle('gm-mode', S.gm);
      setTopHeight();
    } catch (e) {
      console.error(e);
      $('#view').innerHTML = `<section class="panel crash"><div class="panel-body"><h2>Something on this device can't be displayed</h2>
        <p class="lede">The saved ship data in this browser looks damaged. Resetting reloads the official record; nothing on the website changes.</p>
        <div class="form-row"><button class="btn danger" data-ui="hard-reset">Reset this device</button></div></div></section>`;
    }
  }
  function setTopHeight() { document.documentElement.style.setProperty('--top-h', `${$('.topbar').offsetHeight}px`); }

  // ------------------------------------------------------------------ events
  function num(sel) { const el = $(sel); return el ? Number(el.value) : NaN; }
  function restoreOfficial(msg) { pushUndo(); S.state = E.clone(official); S.base = official.revision || 0; S.pendingUpdate = false; writeStore(); closeModal(); render(); toast(msg, 'install'); }
  const UI = {
    'toggle-gm': () => { if (!S.gmDevice) return; S.gm = !S.gm; S.peek = false; S.mounted = null; writeStore(); render(); toast(S.gm ? 'GM mode on.' : 'GM mode off.', 'gm'); },
    'forget-gm': () => { storeSet(GM_DEVICE_KEY, null); S.gmDevice = false; S.gm = false; S.mounted = null; writeStore(); closeModal(); render(); toast('GM tools removed from this device.', 'gm'); },
    undo: () => { const u = S.undo.pop(); if (!u) return; S.state = u.state; S.base = u.base; S.pendingUpdate = u.pendingUpdate; writeStore(); render(); toast('Undone.'); },
    office: openOffice,
    close: closeModal,
    import: () => { const f = $('#import'); if (f) f.click(); },
    go: (b) => { closeModal(); go(b.dataset.route); },
    'open-project': (b) => openProject(b.dataset.id),
    zone: (b) => { const hull = b.dataset.hull; if (b.dataset.zone) selectZone(hull, b.dataset.zone); else { S.sel[hull] = { zone: null, project: null }; history.replaceState(null, '', `#/${ROUTE_OF_HULL[hull]}`); updateDeck(hull); } },
    deck: (b) => selectDeck(b.dataset.deck),
    'tour-menu': () => { if (window.KexTour) window.KexTour.menu(); },
    sound: () => { if (window.KexSound) { KexSound.toggle(); render(); } },
    peek: () => { if (!S.gm) return; S.peek = true; renderView(); },
    lightbox: (b) => openLightbox(b.dataset.hull, b.dataset.zone, Number(b.dataset.i) || 0),
    'lb-step': (b) => { if (!S.lightbox) return; const n = shownMaps(zoneOf(S.lightbox.hull, S.lightbox.zoneId)).length; if (!n) return; S.lightbox.i = (S.lightbox.i + Number(b.dataset.d) + n) % n; renderLightbox(); },
    'lb-close': closeLightbox,
    'map-pick': (b) => { S.mapIndex[b.dataset.key] = Number(b.dataset.i) || 0; renderView(); },
    'load-official': () => restoreOfficial(`Loaded official revision ${fmt(official.revision || 0)}.`),
    'keep-local': () => { S.base = official.revision || 0; S.pendingUpdate = false; writeStore(); render(); },
    reset: () => { if (!window.confirm('Discard this device\'s changes and load the official record?')) return; restoreOfficial('Reset to the official record.'); },
    'hard-reset': () => { storeSet(KEY, null); location.reload(); },
    export: () => download(`kex-shipyard-day${S.state.day}.json`, JSON.stringify({ kind: 'kex-shipyard-save', exported: new Date().toISOString(), catalog: CAT.version, state: S.state }, null, 1)),
    publish,
    'set-label': () => { act('setLabel', { label: $('#of-label').value, day: num('#of-day') }); },
    'set-crew': () => { act('setCrew', { crew: $('#of-crew').value.split('\n') }); if (!S.state.crew.includes(S.actor)) S.actor = S.state.crew[0]; writeStore(); render(); },
    'reveal-tier': () => act('revealTier', { hull: $('#of-rh').value, tier: num('#of-rt') }),
    adjust: () => act('adjust', { field: $('#of-field').value, delta: num('#of-delta'), reason: $('#of-reason').value.trim() }),
    refuel: () => act('refuel', { hull: $('#rf-hull').value, chunks: num('#rf-ch') || 0, disks: num('#rf-dk') || 0 }),
    channel: () => act('channel', { hull: $('#mc-hull').value, levels: num('#mc-lv'), caster: $('#mc-name').value }),
    'buy-raw': () => act('buyRaw', { chunks: num('#by-ch') }),
    'feed-material': () => { S.fmMat = $('#fm-mat').value; act('feedMaterial', { material: S.fmMat, bars: num('#fm-bars') }); },
    'buy-kits': () => act('buyKits', { qty: num('#by-kit') }),
    transfer: () => { const from = $('#tr-from').value; act('transfer', { from, to: from === 'kex' ? 'shuttle' : 'kex', pu: num('#tr-pu') }); },
    'log-filter': (b) => { S.logFilter = b.dataset.k; renderView(); },
    'codex-tab': (b) => { S.codex.tab = b.dataset.k; S.codex.limit = 120; S.codex.rarity = ''; S.codex.role = ''; renderView(); },
    'codex-more': () => { S.codex.limit += 200; renderView(); },
    'meet-tyndr': () => { closeModal(); if (window.KexTour) window.KexTour.start('tyndr'); },
    'copy-log': () => {
      const text = S.state.log.map((l) => `Day ${l.day}: ${l.who ? `${l.who} ` : ''}${l.text}`).join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard'))).then(() => toast('Log copied.'), () => download('kex-log.txt', text, 'text/plain'));
    },
    'comms-next': () => { if (S.commsMin) { S.commsMin = false; $('#comms').classList.remove('min'); writeStore(); } say($('#comms').dataset.who || 'kubix', 'idle'); },
    'comms-close': () => { S.commsMin = true; $('#comms').classList.add('min'); writeStore(); },
  };

  document.addEventListener('click', (e) => {
    const u = e.target.closest('[data-ui]');
    if (u && !u.disabled) { e.preventDefault(); const fn = E.has(UI, u.dataset.ui) ? UI[u.dataset.ui] : null; if (fn) fn(u); return; }
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    let args = {};
    try { args = b.dataset.args ? JSON.parse(b.dataset.args) : {}; } catch (err) { return; }
    if (b.dataset.id) args.id = b.dataset.id;
    if (b.dataset.from) args[b.dataset.field] = num(b.dataset.from);
    act(b.dataset.act, args);
  });
  document.addEventListener('keydown', (e) => {
    if (S.lightbox) {
      if (e.key === 'Escape') { closeLightbox(); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { UI['lb-step']({ dataset: { d: e.key === 'ArrowRight' ? 1 : -1 } }); return; }
    }
    if (e.key === 'Escape') closeModal();
    const band = e.target.closest && e.target.closest('.deck-band');
    if (band && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectDeck(band.dataset.deck); return; }
    const link = e.target.closest && e.target.closest('.card-link');
    if (link && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); link.click(); }
  });
  document.addEventListener('change', (e) => {
    const k = e.target.dataset && e.target.dataset.uiChange;
    if (k === 'actor') { S.actor = e.target.value; writeStore(); }
    if (k === 'market') act('setMarket', { market: e.target.value });
    if (k === 'codex-rarity') { S.codex.rarity = e.target.value; S.codex.limit = 120; renderView(); }
    if (k === 'codex-role') { S.codex.role = e.target.value; S.codex.limit = 120; renderView(); }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'codex-q') {
      S.codex.q = e.target.value; S.codex.limit = 120; const pos = e.target.selectionStart;
      renderView(); const f = $('#codex-q'); if (f) { f.focus(); f.setSelectionRange(pos, pos); }
      return;
    }
    if (e.target.id === 'mk-filter') {
      S.marketFilter = e.target.value; const pos = e.target.selectionStart;
      renderView(); const f = $('#mk-filter'); if (f) { f.focus(); f.setSelectionRange(pos, pos); }
    }
  });
  window.addEventListener('hashchange', () => { if (!parseHash()) return; closeModal(); closeLightbox(); render(); });
  window.addEventListener('kex-sound', () => renderTop());
  window.addEventListener('resize', () => { setTopHeight(); if (S.route === 'tree') drawLinks(); });
  // Another tab changed the save: reload it and drop this tab's undo history (it no longer applies).
  window.addEventListener('storage', (e) => { if (e.key === KEY) { S.undo = []; load(); render(); } });

  // Small surface for the guided tour (assets/tour.js).
  window.KexShipyard = {
    catalog: CAT, engine: E, fmt,
    state: () => S.state,
    official: () => official,
    found: () => found(),
    deck: (d) => selectDeck(d),
    closeOverlays: () => { closeModal(); closeLightbox(); },
    quiet: () => { const c = $('#comms'); if (c) c.classList.add('quiet'); },
  };

  // ------------------------------------------------------------------ boot
  load();
  parseHash();
  $('#comms .avatar-btn').innerHTML = ART.avatar('kubix');
  $('#comms').classList.toggle('min', S.commsMin);
  render();
  setTimeout(greet, 600);
})();
