/* Kex Shipyard — guided tours.
   The message packet: Kubix's recording, relayed by the droid at the end of Session 14 (link: #/tour or #/tour/<chapter>).
   Other tours register themselves from their own files. The hangar orientation (assets/tour-hangar.js) is fetched
   only once the hangar is open, so its text is not sent early. (The catalog still carries the bay's data: the site's
   secrecy is table tidiness, not security.)
   Each step moves to a screen, spotlights a real element and explains it. While a tour runs, the page behind it
   is inert (no clicks, no keyboard), so a tour can never change the ship record. The packet's numbers are its
   recorded projection (catalog start values), not live readings. */
(function () {
  'use strict';
  const APP = window.KexShipyard;
  if (!APP) return;
  const CAT = APP.catalog; const E = APP.engine; const fmt = APP.fmt;
  const DONE_KEY = 'kex-shipyard:tour-done';
  const EXTRA = { id: 'hangar', file: 'assets/tour-hangar.js' };
  const $ = (s, r) => (r || document).querySelector(s);
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const storeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const storeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };

  // The packet was recorded as Kubix dropped into maintenance mode: its figures are that projection.
  function packet() {
    const kex = E.index(CAT).hull.kex;
    const perChunk = E.puPerChunk(CAT);
    const hangar = CAT.upgrades.find((u) => u.id === 'k_hangar');
    const full = CAT.upgrades.find((u) => u.id === 'k_full_cloak');
    const rare = E.itemValue(CAT, 'rare', false);
    return {
      ai: kex.ai, alias: kex.alias || kex.ai,
      charge: fmt(kex.startCharge), draw: fmt(kex.baseDailyPu), days: fmt(Math.floor(kex.startCharge / kex.baseDailyPu)),
      perChunk: fmt(perChunk), perLb: fmt(perChunk * CAT.economy.rawChunksPerLb), chunksPerLb: fmt(CAT.economy.rawChunksPerLb),
      disk: fmt(CAT.economy.refinedPuEach), cap: E.CHANNEL_CAP,
      hangarPu: fmt(hangar.pu), hangarDays: fmt(hangar.days), hangarPerDay: fmt(hangar.pu / hangar.days),
      kitLb: fmt(CAT.itemRules.metalLbPerKit), multiples: full ? full.components[0].qty : 8,
      rareLearn: fmt(rare.learnPu), rareGp: fmt(rare.blueprint.gp), rareKits: rare.blueprint.kits, rarePu: fmt(rare.blueprint.pu), rareDays: fmt(rare.blueprint.days),
    };
  }

  // ---- the packet ------------------------------------------------------------------------------------------
  // step: { title, text(v), route, whenHangarOpen (route to use instead once the hangar is open), deck, target, splash }
  // The pledging chapter demonstrates on the hangar checklist; once the hangar is open, on the pattern archive.
  const KEX = E.index(CAT).hull.kex;
  const AI_LABEL = `${KEX.ai}${KEX.alias ? ` / ${KEX.alias}` : ''}`;
  const PACKET = { who: 'kubix', label: `MESSAGE PACKET · ${AI_LABEL.toUpperCase()} · RECORDED`, title: "Kubix's message packet", home: '#/bridge', numbers: packet, chapters: [
    { name: 'Sound', steps: [
      { splash: true, route: '#/bridge', choice: 'sound', title: 'Sound on or off?',
        text: () => 'This packet comes with my voice and the ship\'s sounds: a soft hum, and a chime as we go.<br><br>Would you like sound on?' },
      { route: '#/bridge', target: '[data-ui="sound"]', title: 'Change it any time',
        text: () => (window.KexSound && KexSound.on() ? 'Sound is on. You may change your mind at any time: tap <b>Sound</b>, up here, to turn it off.' : 'Sound is off. You may change your mind at any time: tap <b>Sound</b>, up here, to turn it on.') },
    ] },
    { name: 'Incoming message', steps: [
      { splash: true, route: '#/bridge', title: 'Message packet from the Kex',
        text: (v) => `Captain. Crew. This is <b>${v.ai}</b>, steward of the Kex. <b>${v.alias}</b> now, by the captain's order; I answer to both.<br><br>This packet is <b>recorded</b>. My relay cannot reach you with live readings, so every figure in it is my projection at the time of sending. Follow along — I will point at things.` },
      { route: '#/bridge', target: '.nav', title: 'A copy of my refit board',
        text: () => 'This console mirrors my refit board: what the ship needs, what it would take, and who gave what.<br><br>The tabs: <b>Bridge</b> (overview), <b>Kex</b> (my decks), <b>Hangar</b>, <b>Upgrades</b>, <b>Hold</b> (fuel, parts, workshop, material analysis), the item <b>Codex</b> and the <b>Log</b>.' },
    ] },
    { name: 'Why I need power', steps: [
      { route: '#/bridge', target: '.hero', title: 'The fog fed me',
        text: () => 'For all the years I sat in Driftvale, the fog kept me alive. It was never just weather: it was a seam between realities, and I drew on the <b>transdimensional current</b> that bled through it to hold my systems together.' },
      { route: '#/bridge', target: '.res.hullres', title: 'Now everything costs',
        text: () => 'The fog is gone. The current is cut. Every light I keep on now has to be paid for — with <b>ether</b>, with <b>magic</b>, or with <b>salvage</b>. That reading is my reserve.' },
    ] },
    { name: 'Power units', steps: [
      { route: '#/bridge', target: '.res.ether', title: 'Raw ether is real fuel',
        text: (v) => `I count energy in <b>power units (PU)</b>.<br><br>One golf-ball chunk of <b>raw ether</b> gives <b>${v.perChunk} PU</b>. ${v.chunksPerLb} chunks weigh a pound: <b>${v.perLb} PU per pound</b>. Nothing you can carry does better.` },
      { route: '#/bridge', target: '#resources .res:nth-child(3)', title: 'Refined disks are ammunition',
        text: (v) => `A refined disk burns for only <b>${v.disk} PU</b>. Keep them for your weapons unless you are desperate.` },
      { route: '#/hold', target: '.hold-grid > section:nth-child(2)', title: 'Casters can feed me',
        text: (v) => `A spellcaster can spend a <b>two-hour watch</b> pouring expended spell slots into me: <b>1 PU per slot level</b>, up to <b>${v.cap} PU per caster per day</b>. Cantrips give nothing. I checked.<br><br>Every caster aboard helps, every day.` },
      { route: '#/hold', target: '.hold-grid > section:nth-child(1)', title: 'Loading fuel',
        text: () => 'When you bring fuel aboard, load it here, into whichever reserve needs it. Every unit is logged.' },
    ] },
    { name: 'Surviving three weeks', steps: [
      { route: '#/bridge', target: '.res.hullres', title: 'Maintenance mode',
        text: (v) => `I have dropped from your last orders into <b>maintenance mode</b>: baseline systems only, <b>${v.draw} PU a day</b>. My reserve is <b>${v.charge} PU</b>. That lasts about <b>${v.days} days</b> — roughly three weeks, about as long as your journey back.<br><br>Please do not stop for sightseeing.` },
      { route: '#/kex/engineering', target: '#side .room-map', title: 'Watch the reactor lights',
        text: () => 'You will know how I am doing from the reactor room. <b>Red</b> lighting means the reserve is draining faster than it fills. <b>Blue</b> means I am holding.' },
      { route: '#/bridge', target: '.hero', title: 'Other methods',
        text: () => 'I am working on <b>other ways to power myself</b>. I should have a report for you once you restore power to certain systems on your arrival.<br><br>Until then: crystals, casters, and patience.' },
    ] },
    { name: 'The hangar', steps: [
      { route: '#/kex/k_hangar', target: '.pd-benefit', title: 'We stopped halfway',
        text: (v) => `My drones were halfway through the collapsed hangar approach when I dropped into maintenance mode to save power. The materials are already in place. The rest is cutting: <b>${v.hangarDays} work days</b> that need <b>${v.hangarPu} PU</b> of power (${v.hangarPerDay} for each day), loaded before the drones start.` },
      { route: '#/kex/hangar', target: '#stage .zone[data-zone="hangar"]', title: 'Behind the wreckage',
        text: () => 'I cannot read what survived behind the wreckage. My sensors return nothing. You will have to open it to find out.' },
    ] },
    { name: 'Metal, not money', steps: [
      { route: '#/kex/k_pattern_archive', target: '.req', title: 'I do not take payment',
        text: () => 'My fabricators do not want your gold as <i>payment</i>. They want it as <b>metal</b>. Platinum, gold and silver make conductors, lattices and field coils — coins are simply the purest metal you carry. <b>Platinum pieces</b> are best of all: my own circuits were built from it. Gems and bullion count at their trade value too.' },
      { route: '#/hold', target: '.hold-grid > section:nth-child(3)', title: 'Fabrication kits are base metal',
        text: (v) => `A <b>fabrication kit</b> is ordinary base metal: steel, copper, ceramic, fasteners. Buy them, or melt down scrap — every <b>${v.kitLb} lb</b> of mundane metal gear makes one kit.` },
    ] },
    { name: 'Patterns and the replicator', steps: [
      { route: '#/hold', target: '#workshop', title: 'One item, one job',
        text: () => 'Feed me a magic item and it does <b>one</b> job:<br>• <b>Install</b> it — it becomes part of a system.<br>• <b>Learn</b> it — it is destroyed completely, nothing returned, and I keep its pattern.<br>• <b>Recycle</b> it — it is destroyed for a little fuel.<br><br>I cannot un-melt a cloak. Choose carefully.' },
      { route: '#/codex', target: '.codex-rules', title: 'Blueprints',
        text: (v) => `A learned pattern becomes a <b>blueprint</b>: each copy costs metal, kits, power and time. A rare pattern costs ${v.rareLearn} PU to learn, then <b>${v.rareGp} gp of coin metal, ${v.rareKits} kits, ${v.rarePu} PU and ${v.rareDays} days per copy</b>. Copies are hull-bound modules, never wearable.` },
      { route: '#/codex', target: '.codex-rules .rules-list', title: 'Big systems need many copies',
        text: (v) => `My hull is large. A system spread across it needs <b>many</b> copies of a pattern — cloaking the whole hull would take <b>${v.multiples}</b> displacement matrices. Smaller systems need one or two. Learn one, build the rest.` },
      { route: '#/codex', target: '.codex-tabs', title: 'Look anything up',
        text: () => 'Every magic item, piece of gear and spell is listed here with what it is worth to me: fuel if recycled, the cost to learn it, and its blueprint. Before you sacrifice something, look it up.' },
      { route: '#/hold', target: '.materials-panel .panel-head', title: 'Metals I do not know',
        text: () => 'My records cover the metals of my own world and a few I have met here. The rest are <b>unknown</b> to me.<br><br>Feed me a sample of anything new — an ingot, a blade, a crystal — and I will identify it. Feed me enough and I will understand what it can do for the ship, and how it is made.' },
    ] },
    { name: 'Reading my decks', steps: [
      { route: '#/kex', deck: 'mid', target: '#deckpick', title: 'Three decks',
        text: () => '<b>Top deck:</b> the elevated bridge, my sensor mast and my core.<br><b>Middle deck:</b> where you came in — quarters, labs, storage.<br><b>Lower deck:</b> engineering, the workshop, maintenance and the drive.<br><br>Tap the side view or a tab to switch decks.' },
      { route: '#/kex', deck: 'mid', target: '#stage', title: 'Colours mean something',
        text: () => 'Rooms tell you where things stand: <b style="color:var(--amber)">amber pulses</b> mean work is available, <b style="color:var(--teal)">teal</b> means online, grey means locked or quiet.' },
      { route: '#/kex/corridors', target: '#side .room-map', title: 'Every room has a map',
        text: () => 'Tap a room to see its <b>battle map</b> and its systems. The drones have been cleaning since you left. <i>Full screen</i> puts the map on the big display.' },
      { route: '#/kex/armory', target: '#stage .zone[data-zone="armory"]', title: 'The missing armory',
        text: () => 'Directly across from the hangar, my armory tore away in the crash. With the fog gone, it may finally be findable.' },
    ] },
    { name: 'Pledging and building', steps: [
      { route: '#/kex/k_hangar', whenHangarOpen: '#/kex/k_pattern_archive', target: '.chip select[data-ui-change="actor"]', title: 'Who is giving?',
        text: () => 'Choose who is acting here. Every pledge is logged under that name — metal, kits, power or parts.' },
      { route: '#/kex/k_hangar', whenHangarOpen: '#/kex/k_pattern_archive', target: '.req:not(.met)', title: 'Pledge line by line',
        text: () => 'Each unfilled line takes what it needs: coins for metal, kits from the hold, power from my reserve — or feed raw chunks straight in. Leftover energy goes into my reserve.' },
      { route: '#/kex/k_hangar', whenHangarOpen: '#/kex/k_pattern_archive', target: '.work-box', title: 'Then the work',
        text: () => 'When every bar is full, start the work. My drones build while you do other things; your GM advances the days. When it is done, the system comes online and the map changes.' },
    ] },
    { name: 'Records & replay', steps: [
      { route: '#/tree', target: '#tree', title: 'The upgrade tree',
        text: () => 'My recovery comes in tiers. Each tier needs named systems online. <b>Encrypted</b> schematics decode as I recover — there is more to me than I can show you yet.' },
      { route: '#/log', target: '#view .panel', title: 'The log',
        text: () => 'Everything you pledge or build is logged. Your changes live on your own device until your GM publishes the official record — then everyone sees the same ship.' },
      { route: '#/bridge', target: '[data-ui="tour-menu"]', title: 'Replay any time',
        text: () => 'Replay this packet from the <b>Tutorial</b> button — you can jump straight to any chapter.' },
      { splash: true, route: '#/bridge', title: 'End of packet',
        text: (v) => `I will hold the lights as long as I can.<br><br><b>Bring crystals.</b><br><br>— ${v.ai} / ${v.alias}, steward of the Kex` },
    ] },
  ] };

  const TOURS = {}; const ALIAS = {};
  function register(id, def) {
    def.id = id; def.steps = [];
    def.chapters.forEach((c, ci) => c.steps.forEach((s) => def.steps.push(Object.assign({ chapter: ci }, s))));
    TOURS[id] = def;
    (def.aliases || []).forEach((a) => { ALIAS[a] = id; });
  }
  register('kubix', PACKET);

  // Extra tours load on demand, and only once the hangar is open. One attempt per page load: if the file cannot be
  // fetched (offline, partial upload), the menu simply shows the packet alone.
  let waiting = null; let extraTried = false;
  function loadExtra(cb) {
    if (TOURS[EXTRA.id] || extraTried || !APP.found()) { cb(); return; }
    if (waiting) { waiting.push(cb); return; }
    waiting = [cb];
    const s = document.createElement('script');
    s.src = `${EXTRA.file}?v=${encodeURIComponent(window.KEX_ASSET_VERSION || CAT.version)}`;
    const done = () => { extraTried = true; const list = waiting; waiting = null; list.forEach((f) => f()); };
    s.onload = done; s.onerror = done;
    document.body.appendChild(s);
  }

  // ---- rendering ------------------------------------------------------------------------------------------
  let tour = null; let idx = -1; let layer = null; let targetEl = null; let returnFocus = null; let inerted = []; let locked = false;

  // While a tour or its chapter menu is open, everything else on the page is inert (no clicks, no keyboard).
  function lockPage(on) {
    if (on === locked) return;
    locked = on;
    if (on) {
      inerted = Array.from(document.body.children).filter((el) => el !== layer && !el.classList.contains('tour-menu') && el.tagName !== 'SCRIPT' && !el.inert);
      inerted.forEach((el) => { el.inert = true; });
      document.body.classList.add('touring');
    } else {
      inerted.forEach((el) => { el.inert = false; }); inerted = [];
      document.body.classList.remove('touring');
    }
  }
  const remember = () => { const a = document.activeElement; if (a && a !== document.body && !a.closest('.tour-layer, .tour-menu')) returnFocus = a; };
  function restoreFocus() {
    const back = returnFocus && returnFocus !== document.body && document.body.contains(returnFocus) ? returnFocus : document.querySelector('[data-ui="tour-menu"]');
    if (back) setTimeout(() => back.focus({ preventScroll: true }), 50);
  }

  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'tour-layer';
    layer.innerHTML = `<div class="tour-block"></div><div class="tour-hole"></div>
      <section class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <div class="tc-head"><div class="tc-avatar"></div>
          <div><div class="tc-k"></div><div class="tc-chapter"></div></div>
          <button class="tc-x" data-tour="exit" aria-label="Close tutorial">✕</button></div>
        <h3 class="tc-title" id="tour-title"></h3>
        <div class="tc-body"></div>
        <div class="tc-foot"><span class="tc-count"></span><span class="tc-spacer"></span>
          <button class="btn sm ghost" data-tour="menu">Chapters</button>
          <button class="btn sm" data-tour="back">◂ Back</button>
          <button class="btn sm primary" data-tour="next">Next ▸</button></div>
      </section>`;
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tour]'); if (!b) return;
      const a = b.dataset.tour;
      if (a === 'next') show(idx + 1); else if (a === 'back') show(idx - 1); else if (a === 'exit' || a === 'skip') finish(false);
      else if (a === 'sound-on' || a === 'sound-off') { if (window.KexSound) KexSound.set(a === 'sound-on'); show(idx + 1); }
      else if (a === 'menu') menu();
    });
    document.body.appendChild(layer);
    lockPage(true);
    return layer;
  }

  function show(i) {
    if (!tour) return;
    if (i < 0) i = 0;
    if (i >= tour.steps.length) { finish(true); return; }
    idx = i;
    const step = tour.steps[i];
    // Start the line inside the tap itself: Safari only lets sound start there, not from the timer below (audit V10-1).
    if (window.KexSound) { if (tour.id === 'kubix') KexSound.speak(voiceId(step), step.text(tour.numbers())); else KexSound.stopVoice(); }
    APP.closeOverlays(); APP.quiet();
    ensureLayer();
    const route = step.whenHangarOpen && E.installed(APP.state(), 'k_hangar') ? step.whenHangarOpen : step.route;
    const needsRoute = route && location.hash !== route;
    if (needsRoute) location.hash = route;
    if (step.deck) APP.deck(step.deck);
    // Give the screen a moment to render; lazy screens (the codex) may need longer, so wait for the target.
    const at = idx; let tries = 0;
    const attempt = () => {
      if (!tour || idx !== at) return;
      if (step.target && !step.splash && !document.querySelector(step.target) && tries++ < 16) { setTimeout(attempt, 150); return; }
      place(step);
    };
    setTimeout(attempt, needsRoute || step.deck ? 280 : 30);
  }

  function place(step) {
    const L = ensureLayer();
    const card = $('.tour-card', L); const hole = $('.tour-hole', L);
    L.classList.toggle('splash', !!step.splash);
    $('.tc-avatar', L).innerHTML = window.KexArt.avatar(tour.who);
    $('.tc-k', L).textContent = tour.label;
    $('.tc-chapter', L).textContent = `Chapter ${step.chapter + 1} of ${tour.chapters.length} · ${tour.chapters[step.chapter].name}`;
    $('.tc-title', L).textContent = step.title;
    $('.tc-count', L).textContent = `${idx + 1} / ${tour.steps.length}`;
    $('[data-tour="back"]', L).disabled = idx === 0;
    const nextBtn = $('[data-tour="next"]', L);
    nextBtn.textContent = idx === 0 ? 'Play ▸' : idx === tour.steps.length - 1 ? (tour.id === 'kubix' ? 'Enter the shipyard ▸' : 'Done ▸') : 'Next ▸';
    let choice = $('.tc-choice', L);
    if (step.choice && !choice) {
      choice = document.createElement('span'); choice.className = 'tc-choice';
      choice.innerHTML = '<button class="btn sm primary" data-tour="sound-on">Sound on</button><button class="btn sm" data-tour="sound-off">Sound off</button>';
      nextBtn.before(choice);
    }
    if (!step.choice && choice) choice.remove();
    nextBtn.hidden = !!step.choice; $('[data-tour="back"]', L).hidden = !!step.choice;
    let skip = $('[data-tour="skip"]', L);
    if (idx === 0 && !skip) { skip = document.createElement('button'); skip.className = 'btn sm ghost'; skip.dataset.tour = 'skip'; skip.textContent = 'Skip'; nextBtn.before(skip); }
    if (idx !== 0 && skip) skip.remove();
    const body = $('.tc-body', L);
    const html = step.text(tour.numbers());
    body.innerHTML = html;
    if (window.KexSound) { if (step.splash) KexSound.fx.open(); else KexSound.fx.step(); } // the voice already started in show()
    if (!reduceMotion) { body.classList.remove('reveal'); void body.offsetWidth; body.classList.add('reveal'); }
    targetEl = step.target ? document.querySelector(step.target) : null;
    if (targetEl && !step.splash) {
      // Far targets jump instead of gliding (smooth scrolling also never runs in a hidden tab); the spotlight is placed
      // again once the page has settled.
      const instant = reduceMotion || document.hidden || Math.abs(targetEl.getBoundingClientRect().top) > window.innerHeight * 1.5;
      if (window.innerWidth < 720) {
        // Phones: the card docks at the bottom, so bring the target up to just under the sticky header.
        const head = document.querySelector('.topbar');
        const el = targetEl;
        el.style.scrollMarginTop = `${(head ? head.getBoundingClientRect().bottom : 0) + 10}px`;
        el.scrollIntoView({ block: 'start', behavior: instant ? 'auto' : 'smooth' });
        setTimeout(() => { el.style.scrollMarginTop = ''; }, 1000);
      } else targetEl.scrollIntoView({ block: 'center', behavior: instant ? 'auto' : 'smooth' });
      setTimeout(() => position(card, hole), instant ? 30 : 320);
      setTimeout(() => {
        if (!targetEl || !layer) return;
        // A browser can cut a smooth scroll short (audit V7-3): if the target is still off screen, jump there.
        const r = targetEl.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) targetEl.scrollIntoView({ block: window.innerWidth < 720 ? 'start' : 'center', behavior: 'auto' });
        position(card, hole);
      }, 900);
    } else {
      hole.style.display = 'none'; card.classList.remove('docked'); card.style.left = ''; card.style.top = ''; card.classList.add('centered');
    }
    const firstChoice = step.choice && $('.tc-choice button', L);
    (firstChoice || nextBtn).focus({ preventScroll: true });
  }

  function position(card, hole) {
    if (!targetEl || !document.body.contains(targetEl)) { hole.style.display = 'none'; card.classList.add('centered'); return; }
    const r = targetEl.getBoundingClientRect();
    const pad = 8;
    hole.style.display = 'block';
    hole.style.left = `${r.left - pad}px`; hole.style.top = `${r.top - pad}px`;
    hole.style.width = `${r.width + pad * 2}px`; hole.style.height = `${r.height + pad * 2}px`;
    if (window.innerWidth < 720) { card.classList.remove('centered'); card.classList.add('docked'); card.style.left = ''; card.style.top = ''; return; }
    card.classList.remove('centered', 'docked');
    const cw = card.offsetWidth; const ch = card.offsetHeight; const vw = window.innerWidth; const vh = window.innerHeight; const gap = 16;
    let top; let left;
    if (r.bottom + gap + ch < vh) top = r.bottom + gap;
    else if (r.top - gap - ch > 0) top = r.top - gap - ch;
    else { top = Math.max(gap, Math.min(vh - ch - gap, r.top)); left = r.right + gap + cw < vw ? r.right + gap : Math.max(gap, r.left - gap - cw); }
    if (left === undefined) left = Math.max(gap, Math.min(vw - cw - gap, r.left + r.width / 2 - cw / 2));
    card.style.left = `${left}px`; card.style.top = `${top}px`;
  }

  function finish(completed) {
    if (window.KexSound) KexSound.stopVoice();
    const done = tour;
    if (done && done.id === 'kubix') storeSet(DONE_KEY, '1');
    tour = null; idx = -1;
    lockPage(false);
    if (layer) { layer.remove(); layer = null; }
    closeMenu();
    if (completed || /^#\/tour/.test(location.hash)) location.hash = (done && done.home) || '#/bridge';
    restoreFocus();
  }

  function begin(t, chapter) {
    if (!layer) remember();
    closeMenu(true);
    tour = t;
    const i = tour.steps.findIndex((s) => s.chapter === (chapter || 0));
    show(i < 0 ? 0 : i);
  }

  // start('kubix' | a registered id or alias, chapter index)
  function start(id, chapter) {
    const direct = TOURS[id || 'kubix'] || TOURS[ALIAS[id]];
    if (direct && (!direct.needsFound || APP.found())) { begin(direct, chapter); return; }
    if (!APP.found()) { if (/^#\/tour/.test(location.hash)) location.hash = '#/bridge'; return; }
    loadExtra(() => {
      const t = TOURS[id] || TOURS[ALIAS[id]];
      if (t) begin(t, chapter); else if (/^#\/tour/.test(location.hash)) location.hash = '#/bridge';
    });
  }

  function menu() {
    if (APP.found() && !TOURS[EXTRA.id] && !extraTried) { loadExtra(menu); return; }
    if (!layer) remember();
    closeMenu(true);
    const list = Object.values(TOURS).filter((t) => !t.needsFound || APP.found());
    const back = document.createElement('div');
    back.className = 'modal-back tour-menu';
    back.innerHTML = `<section class="panel modal" role="dialog" aria-modal="true" aria-label="Tutorial chapters"><div class="panel-head"><h2>Tutorials</h2><button class="btn sm icon-only ghost" data-tour-menu="close" aria-label="Close">✕</button></div>
      <div class="panel-body">${list.map((t) => `<div><h2>${t.title}</h2><div class="tour-chapters">${t.chapters.map((c, i) => `<button class="pcard" data-tour-menu="chapter" data-t="${t.id}" data-c="${i}"><div class="pd-icon"><b>${i + 1}</b></div><div><div class="p-name">${c.name}</div><div class="p-sub">${c.steps.length} step${c.steps.length > 1 ? 's' : ''}</div></div></button>`).join('')}</div>
      <div class="form-row" style="margin-top:10px"><button class="btn primary" data-tour-menu="chapter" data-t="${t.id}" data-c="0">Play from the beginning</button></div></div>`).join('')}</div></section>`;
    back.addEventListener('click', (e) => {
      if (e.target === back) { closeMenu(); return; }
      const b = e.target.closest('[data-tour-menu]'); if (!b) return;
      if (b.dataset.tourMenu === 'close') closeMenu(); else start(b.dataset.t, Number(b.dataset.c));
    });
    if (layer) { layer.remove(); layer = null; tour = null; idx = -1; }
    document.body.appendChild(back);
    lockPage(true);
    const f = back.querySelector('button'); if (f) f.focus();
  }
  // keep = a tour is about to take over (it keeps the page locked and handles focus itself)
  function closeMenu(keep) {
    const open = document.querySelectorAll('.tour-menu');
    open.forEach((m) => m.remove());
    if (open.length && !keep && !layer) { lockPage(false); restoreFocus(); }
  }

  // Keyboard inside the chapter menu: Esc closes it, Tab stays inside it.
  document.addEventListener('keydown', (e) => {
    const m = document.querySelector('.tour-menu');
    if (!m || idx >= 0) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeMenu(); return; }
    if (e.key !== 'Tab') return;
    const f = Array.from(m.querySelectorAll('button:not([disabled])'));
    if (!f.length) return;
    const first = f[0]; const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!m.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (idx < 0) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
    else if (e.key === 'ArrowRight') show(idx + 1);
    else if (e.key === 'ArrowLeft') show(idx - 1);
    else if (e.key === 'Tab' && layer) { // keep focus inside the card
      const f = Array.from(layer.querySelectorAll('button:not([disabled])'));
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!layer.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  }, true);
  window.addEventListener('resize', () => { if (idx >= 0 && layer && tour && !tour.steps[idx].splash) position($('.tour-card', layer), $('.tour-hole', layer)); });
  window.addEventListener('scroll', () => { if (idx >= 0 && layer && targetEl && tour && !tour.steps[idx].splash) position($('.tour-card', layer), $('.tour-hole', layer)); }, { passive: true });

  // Voice lines are keyed by step title; script() lists the packet's lines with the exact HTML each recording must match.
  function voiceId(step) { return `kubix-${step.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`; }
  const script = () => TOURS.kubix.steps.map((s) => ({ id: voiceId(s), chapter: s.chapter + 1, title: s.title, html: s.text(TOURS.kubix.numbers()) }));

  window.KexTour = { start, menu, register, script, chapter: (c) => start('kubix', c), active: () => idx >= 0 };

  // Entry points: #/tour, #/tour/<n>, #/tour/<name> — or the first visit on this device, from the bridge only.
  const m = location.hash.match(/^#\/tour(?:\/([a-z]+|\d+))?/i);
  const opening = () => (window.KexSound && KexSound.chosen() ? 1 : 0); // the sound choice is asked once per device
  if (m) setTimeout(() => (m[1] && !/^\d+$/.test(m[1]) ? start(m[1].toLowerCase()) : start('kubix', m[1] ? Math.max(0, Number(m[1]) - 1) : opening())), 300);
  else if (!storeGet(DONE_KEY) && /^(#\/?|#\/bridge)?$/.test(location.hash)) setTimeout(() => start('kubix', opening()), 700);
})();
