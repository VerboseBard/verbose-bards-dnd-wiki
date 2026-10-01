/* Kex Shipyard — the refit drill: how to supply, build and unlock systems, and how days pass (link: #/tour/drill).
   GM request 2026-10-01: players could find every screen but not how upgrading works. Kubix walks through one job on a
   throwaway PRACTICE COPY of the ship (app.js practice()): each step names the button, then the next step shows what
   pressing it did. Nothing in the drill is saved; leaving it in any way puts the real session back exactly as it was.
   The copy starts from the catalog (not anyone's record) with the hangar checklist emptied, so every kind of line can
   be shown. Every step's position in the demonstration is fixed ("at" = how many of ACTS have been applied), so Back,
   Next and chapter jumps always show the same screen. The drill never finishes the hangar: what is inside stays a secret.
   Voiced: each line's recording plays only while its text is unchanged (voice/README.md). */
(function () {
  'use strict';
  const APP = window.KexShipyard; const T = window.KexTour;
  if (!APP || !T || !T.register) return;
  const CAT = APP.catalog; const E = APP.engine; const fmt = APP.fmt;
  const KEX = E.index(CAT).hull.kex;
  const up = (id) => CAT.upgrades.find((u) => u.id === id);
  const HANGAR = up('k_hangar'); const FORGE = up('k_clean_forge');
  // The schematic decoded in the drill: the first one a player can decode at the start (never one the GM holds back).
  const START = (crew) => E.normalize(CAT, { label: 'Refit drill: practice ship', day: 1, treasury: 2000, rawChunks: 23, kits: HANGAR.kits, inventory: { repair_drone: 2 }, crew });
  const DECODE_ID = (CAT.upgrades.find((u) => u.hull === 'kex' && !E.decodeBlock(CAT, START(['Crew']), u.id)) || {}).id;
  const ACTS = [
    ['advanceDay'],
    ['payGold', { id: 'k_hangar', gp: HANGAR.gp }],
    ['giveKits', { id: 'k_hangar', qty: HANGAR.kits }],
    ['givePart', { id: 'k_hangar', line: 0, itemId: 'repair_drone', qty: HANGAR.components[0].qty, route: 'owned' }],
    ['givePower', { id: 'k_hangar', pu: HANGAR.pu, source: 'kex' }],
    ['startWork', { id: 'k_hangar' }],
    ['advanceDay'],
    ['beginDecode', { id: DECODE_ID }],
    ['advanceDay'],
  ];
  function stateAt(k, crew) {
    let st = START(crew);
    for (let i = 0; i < k; i++) st = E.apply(CAT, st, ACTS[i][0], Object.assign({ who: crew[0] }, ACTS[i][1] || {})).state;
    return st;
  }

  // Figures in the text come from replaying the drill itself, so they always match what the screens show.
  let figures = null;
  function numbers() {
    if (figures) return figures;
    const at = (k) => stateAt(k, ['Crew']);
    const s = [0, 1, 5, 7, 8, 9].map(at);
    const dec = E.decodeCost(CAT, DECODE_ID); const tierOf = up(DECODE_ID).tier;
    const c = s.map((x) => fmt(x.hulls.kex.charge));
    figures = {
      ai: KEX.ai, alias: KEX.alias || KEX.ai, draw: fmt(KEX.baseDailyPu), perChunk: fmt(E.puPerChunk(CAT)),
      c0: c[0], c1: c[1], c2: c[2], c3: c[3], c4: c[4], c5: c[5], d1: fmt(s[1].day), d3: fmt(s[3].day),
      hName: HANGAR.name, hGp: fmt(HANGAR.gp), hKits: fmt(HANGAR.kits), hParts: fmt(HANGAR.components[0].qty), hPu: fmt(HANGAR.pu), hDays: fmt(HANGAR.days),
      left3: fmt(s[3].projects.k_hangar.daysLeft), left4: fmt(s[5].projects.k_hangar.daysLeft), decLeft4: fmt(s[5].decoding.kex.daysLeft),
      forge: FORGE.name.toLowerCase(), decPer: fmt(E.DECODE.puPerTier), dayPer: fmt(E.DECODE.daysPerTier), decTier: fmt(tierOf), decPu: fmt(dec.pu), decDays: fmt(dec.days),
    };
    return figures;
  }

  // origin: the screen the drill was started from. Leaving puts the reader back there (audit V14-5: never end on a
  // screen the real session would show differently, e.g. a GM device's view of the Upgrades tree).
  let crew = null; let origin = null; const cache = {};
  const decodeRoute = () => `#/kex/x${CAT.upgrades.findIndex((u) => u.id === DECODE_ID)}`;
  const AI_LABEL = `${KEX.ai}${KEX.alias ? ` / ${KEX.alias}` : ''}`;

  T.register('drill', { who: 'kubix', voice: 'drill', aliases: ['upgrades', 'refit'], home: '#/tree', doneLabel: 'End the drill ▸', numbers,
    label: `REFIT DRILL · ${AI_LABEL.toUpperCase()} · PRACTICE COPY`, title: 'Refit drill: how upgrades work',
    returnToStart: true,
    onStep(step) {
      if (!crew) { crew = APP.crew(); origin = location.hash; }
      const k = step.at || 0;
      if (!cache[k]) cache[k] = stateAt(k, crew);
      APP.practice(E.clone(cache[k]));
    },
    onEnd() {
      const back = origin && !/^#\/tour/.test(origin) ? origin : '#/bridge';
      crew = null; origin = null; Object.keys(cache).forEach((k) => delete cache[k]);
      APP.practice(null, back);
    },
    chapters: [
      { name: 'The drill', steps: [
        { splash: true, route: '#/bridge', title: 'Refit drill',
          text: (v) => `This is <b>${v.ai}</b> again, with a drill: how to unlock and build my systems, and how days pass while the work goes on.<br><br>I have set up a <b>practice ship</b> for this: a copy of my systems, with the hangar's checklist emptied and a few supplies in the hold, so you can see every kind of line filled. I will press the buttons, one step at a time, and show you where they are. Nothing in the drill is saved.` },
        { route: '#/bridge', target: '#banner', title: 'A practice copy',
          text: () => 'While this bar shows, you are in the drill. When it ends, your own ship comes back exactly as you left it.' },
      ] },
      { name: 'How days pass', steps: [
        { route: '#/bridge', target: '.chip.day', title: 'The day counter',
          text: () => 'Everything I do is measured in <b>days</b>. This is the day counter. Days do not pass on their own: they move when your GM says a day has passed in the story — travel, rest, downtime.' },
        { route: '#/bridge', target: '[data-act="advanceDay"]', title: 'Next day',
          text: () => 'This is your GM\'s <b>Next day</b> button; players do not have it. Each press is one day:<br>• I pay my daily draw from the reserve.<br>• Every job under construction does one day of work.<br>• Decoding moves one day.<br>• Casters may channel again.<br><br>Watch my reserve. I will press it.' },
        { at: 1, route: '#/bridge', target: '.res.hullres', title: 'One day passes',
          text: (v) => `Day ${v.d1}. My reserve fell from <b>${v.c0}</b> to <b>${v.c1} PU</b>: ${v.draw} for a day of maintenance. Under the meter I show my daily balance, and how many days are left at this rate.` },
      ] },
      { name: 'Finding work', steps: [
        { at: 1, route: '#/tree', target: '.view-head .legend', title: 'What the colours mean',
          text: () => '<b>Upgrades</b> shows every system I could have, tier by tier. The colours:<br>• <b>Available</b>: it can be supplied now.<br>• <b>Supplying</b>: partly supplied.<br>• <b>Ready to build</b>: everything is in.<br>• <b>Under construction</b>, then <b>Online</b>.<br>• <b>Locked</b>: it needs other systems first.<br>• <b>Encrypted</b>: I cannot read the schematic yet.' },
        { at: 1, route: '#/tree', target: '.node[data-node="k_hangar"]', title: 'Open a project',
          text: (v) => `Tap any card to open its page. For the drill, we open the hangar job: <b>${v.hName}</b>.` },
      ] },
      { name: 'Reading a project', steps: [
        { at: 1, route: '#/kex/k_hangar', target: '.pd-head', title: 'Its name and state',
          text: () => 'The top of the page tells you what the system is, its tier and its state. Below that: what it does for the ship.' },
        { at: 1, route: '#/kex/k_hangar', target: '.req', title: 'The supply checklist',
          text: (v) => `Then the <b>supply checklist</b>: everything the job uses up. This one needs <b>${v.hGp} gp</b> of coin metal, <b>${v.hKits} fabrication kits</b>, <b>${v.hParts} repair-drone chassis</b> and <b>${v.hPu} PU</b> of commissioning power. Each bar fills as it is supplied.` },
        { at: 1, route: '#/kex/k_hangar', target: '.work-box', title: 'The work',
          text: (v) => `At the bottom: the work itself. This job takes <b>${v.hDays} work days</b> once everything is in. <b>Start work</b> stays off until every line is full.` },
      ] },
      { name: 'Supplying it', steps: [
        { at: 1, route: '#/kex/k_hangar', target: '.chip select[data-ui-change="actor"]', title: 'Choose who is giving',
          text: () => 'First, choose who is giving, up here. Every contribution is logged under that name.' },
        { at: 1, route: '#/kex/k_hangar', target: '[data-act="payGold"]', title: 'Feed coins',
          text: () => 'Metal first. Type how much in the box — it starts at what is still needed — and tap <b>Feed coins</b>. The treasury pays, and the coins go into my smelter. I will press it.' },
        { at: 2, route: '#/kex/k_hangar', target: '.req.met', title: 'One line done',
          text: (v) => `Done: ${v.hGp} gp fed. The line fills and gets a tick, and the log records who gave it.` },
        { at: 2, route: '#/kex/k_hangar', target: '[data-act="giveKits"]', title: 'Kits from the hold',
          text: () => 'Kits come from the hold: tap <b>From hold</b>. If the hold is short, <b>Add to list</b> puts them on your shopping list. Nothing is bought on this board: purchases happen in play, and your GM records them.' },
        { at: 3, route: '#/kex/k_hangar', target: '[data-act="givePart"]', title: 'Parts',
          text: () => 'Parts: <b>Install from hold</b> uses ones you carry. <b>Fabricate</b> makes a copy, once I know the pattern. <b>Add to list</b> plans a purchase. The drill hold has the drones, so: install from hold.' },
        { at: 4, route: '#/kex/k_hangar', target: '[data-act="givePower"]', title: 'Power',
          text: (v) => `Last, power. <b>From Kex reserve</b> spends my stored charge. <b>Feed raw chunks</b> burns ether straight in: one chunk is ${v.perChunk} PU, and anything left over goes into my reserve. I will use my reserve: ${v.hPu} PU.` },
        { at: 5, route: '#/kex/k_hangar', target: '.work-box', title: 'Ready to build',
          text: (v) => `Every line is full: <b>Ready to build</b>. My reserve paid the power: ${v.c1} down to ${v.c2} PU.` },
      ] },
      { name: 'Building it', steps: [
        { at: 5, route: '#/kex/k_hangar', target: '[data-act="startWork"]', title: 'Start work',
          text: (v) => `Now tap <b>Start work</b>. My drones are one work team, so one job at a time; ${v.forge} would add a second team. I will press it.` },
        { at: 6, route: '#/kex/k_hangar', target: '.work-box', title: 'Under construction',
          text: (v) => `Under construction: <b>${v.hDays} of ${v.hDays} work days</b> left. There is nothing more to supply. Now the days do the work.` },
        { at: 6, route: '#/kex/k_hangar', target: '[data-act="advanceDay"]', title: 'Days do the work',
          text: () => 'Your GM presses <b>Next day</b> as time passes in the story. Watch.' },
        { at: 7, route: '#/kex/k_hangar', target: '.work-box', title: 'A day later',
          text: (v) => `Day ${v.d3}: <b>${v.left3} of ${v.hDays}</b> work days left. Overnight my reserve also paid its ${v.draw} units: ${v.c3} PU now.` },
      ] },
      { name: 'Unlocking schematics', steps: [
        { at: 7, route: '#/tree', target: () => `.node[data-node="${DECODE_ID}"]`, title: 'Encrypted schematics',
          text: () => 'Violet cards are schematics I cannot read yet. One opens in three ways:<br>• <b>Build</b> what it depends on, and the next tier reveals itself.<br>• <b>Decode</b> it.<br>• Or your GM reveals it, when the story gets there.' },
        { at: 7, route: decodeRoute, target: '.work-box', title: 'Decoding',
          text: (v) => `Tap an encrypted card to open it. Decoding costs <b>${v.decPer} PU per tier</b> from my reserve and takes <b>${v.dayPer} day per tier</b>, one schematic at a time. Some open to say <b>Out of reach</b>: those are for your GM to reveal.` },
        { at: 7, route: decodeRoute, target: '[data-act="beginDecode"]', title: 'Begin decoding',
          text: (v) => `This one is tier ${v.decTier}: ${v.decPu} PU and ${v.decDays} days. I will press <b>Begin decoding</b>.` },
        { at: 8, route: decodeRoute, target: '.work-box', title: 'Decoding under way',
          text: (v) => `Decoding: <b>${v.decDays} days</b> left. The ${v.decPu} PU came from my reserve, ${v.c3} down to ${v.c4}. It runs alongside the construction, and it pauses if I am put into cold storage.` },
        { at: 9, route: '#/tree', target: '.node[data-node="k_hangar"]', title: 'Both move together',
          text: (v) => `One more <b>Next day</b>, and both moved on: the hangar job has <b>${v.left4} work day</b> left, and the decoding <b>${v.decLeft4} days</b>. The cards show the progress.` },
        { at: 9, splash: true, route: '#/tree', title: 'When the work is done',
          text: () => 'When the last day passes, it happens by itself: <b>System online</b>, a line in the log, the deck plan updates, and the systems that build on it appear on the tree. A decoded schematic opens with everything it needs.<br><br>The drill stops one day short. The real job is yours to finish.' },
        { at: 9, route: '#/kex/k_pattern_archive', target: '.prereq', title: 'Locked systems',
          text: () => 'A <b>locked</b> system lists what it is waiting for under <b>Requires</b>. This one needs the hangar, and a system I cannot show you yet. Bring those online and it unlocks itself.' },
      ] },
      { name: 'Keeping track', steps: [
        { at: 9, route: '#/log', target: '#view .panel', title: 'The log',
          text: () => 'Every press is in the log, day by day: who gave what, what started, and what it cost. It can be copied for your notes.' },
        { at: 9, route: '#/bridge', target: '.res.hullres', title: 'Watch the reserve',
          text: (v) => `In this drill my reserve went from ${v.c0} to ${v.c5} PU in three days: maintenance, commissioning power and decoding. Every plan you make spends the same reserve, so keep an eye on the days left.` },
      ] },
      { name: 'Your GM\'s part', steps: [
        { at: 9, route: '#/bridge', target: '[data-ui="office"]', title: 'Making it official',
          text: () => 'What you press changes your own device only. Your GM keeps the official record: at the end of a session, the GM publishes it from the <b>Office</b>, and everyone loads the same ship.' },
        { at: 9, splash: true, route: '#/bridge', title: 'What your GM does',
          text: () => 'In GM mode, your GM:<br>• presses <b>Next day</b>;<br>• marks <b>field objectives</b> complete — some systems need something to happen in play;<br>• <b>reveals</b> schematics the story has reached;<br>• records what was <b>bought in play</b> or found;<br>• and <b>publishes</b> the record.' },
        { at: 9, splash: true, route: '#/bridge', title: 'End of drill',
          text: (v) => `That is the drill. When you close it, the practice copy is gone and your ship is back as you left it.<br><br>Replay it from <b>Tutorial</b>, or from <b>How upgrades work</b> on the Upgrades page.<br><br>— ${v.ai} / ${v.alias}` },
      ] },
    ] });
})();
