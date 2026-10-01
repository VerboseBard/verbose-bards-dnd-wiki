/* Kex Shipyard — the hangar orientation, in the shuttle AI's own voice (link: #/tour/tyndr or #/tour/hangar).
   tour.js fetches this file only after the hangar is open, then it registers itself. Numbers are live catalog
   values; the name comes from the catalog, so renaming the shuttle is one line in tools/build-catalog.cjs. */
(function () {
  'use strict';
  const APP = window.KexShipyard; const T = window.KexTour;
  if (!APP || !T || !T.register) return;
  const CAT = APP.catalog; const E = APP.engine; const fmt = APP.fmt;
  const H = E.index(CAT).hull.shuttle; const NAME = H.name;

  function numbers() {
    const food = CAT.upgrades.find((u) => u.id === 's_food');
    const rail = CAT.upgrades.find((u) => u.id === 's_weapon_mount');
    return { name: NAME, buried: !E.flightReady(CAT, APP.state()), day: fmt(H.baseDailyPu), food: fmt(food ? food.dailyPu : 1), slots: H.baseSlots, railSlots: H.baseSlots + (rail ? rail.slotCapacity : 2), cap: fmt(H.baseCapacity) };
  }

  T.register('hangar', { who: 'tyndr', aliases: ['tyndr', NAME.toLowerCase()], needsFound: true, home: '#/hangar', numbers,
    label: `${NAME.toUpperCase()} · ORIENTATION · LIVE`, title: `${NAME}'s orientation`, chapters: [
      { name: 'Who you are dealing with', steps: [
        { splash: true, route: '#/hangar', title: `Name's ${NAME}`,
          text: (v) => `Name's <b>${v.name}</b>. Not "Shuttle." Not "Buddy." Not whatever cute thing you're about to try.<br><br>Boots. Mat. Then the floor. I put 'em in that order for a reason.<br><br>${v.buried ? "And get this junk off me. I ain't flyin' nowhere till the wreckage is cut off, the drones have surveyed what's busted, and my <b>hull</b>, <b>lift engines</b> and <b>flight controls</b> are fixed. It's all on the board." : "And thanks for diggin' me out. I mean it. Don't make it weird."} Now — the tour.` },
      ] },
      { name: 'What I cost', steps: [
        { route: '#/hangar', target: '.seg[aria-label="Operating mode"]', title: 'Docked, standby, flying',
          text: (v) => `Docked in the hangar I sip <b>nothin'</b>. Sittin' ready with you aboard: <b>2 PU a day</b> plus whatever you bolted on. A full <b>flight day is ${v.day} PU</b> — life support and cleaning included — and <b>+${v.food}</b> once the ration replicator's stocked.${v.buried ? " Till I'm repaired, I stay docked." : ''}` },
        { route: '#/hangar', target: '.power-read', title: 'My own reserve',
          text: (v) => `I carry my own charge — <b>${v.cap} PU</b> of room to start. When I'm docked, the big gal and I can pass charge back and forth. Fill me up before a long haul.` },
      ] },
      { name: 'My deck', steps: [
        { route: '#/hangar', target: '#stage', title: 'The layout',
          text: () => 'Nose: the <b>intake and replicator</b> behind the thickest plating. Middle: the <b>holotable</b> — no windows, no pilot seat, I fly, you point. Four <b>cabins</b>, two bunks each. Back: the <b>working bay</b>, first aid, drone dock and the cargo ramp. Belly hatch is how you come in.' },
        { route: '#/hangar/cabins', target: '#side', title: 'Cabin C',
          text: () => 'Cabin C\'s latch is busted. Not me. The <b>latch</b>. Big difference. Fix it and you get eight proper berths instead of six.' },
      ] },
      { name: 'Upgrades and slots', steps: [
        { route: '#/hangar/hull', target: '.power-read', title: 'Slots are the deal',
          text: (v) => `I got <b>${v.slots} slots</b> for extras — weapons, wards, masks. The mounting rail makes it <b>${v.railSlots}</b>. That's it. You wanna fit a fireball projector, somethin' else comes off. Choose.` },
        { route: '#/hangar/hull', target: '#side', title: 'Hardpoints',
          text: () => 'Hardpoints take a <b>force emitter</b> (one slot) or a <b>fire projector</b> (two). Bolt on both if you got the room — I still only fire <b>one shot a round</b>. And firing drops any cloak I\'m holdin\'. Physics. Don\'t argue with physics.' },
      ] },
      { name: 'Working with the big gal', steps: [
        { route: '#/tree', target: '#tree', title: 'My own tree',
          text: () => 'I upgrade on my own ladder. Some of my big stuff needs the hangar\'s heavy tools, and when I\'m docked I share the archive\'s patterns. My bench works at half speed — I\'m a shuttle, not a shipyard.' },
        { splash: true, route: '#/hangar', title: 'That\'s the tour',
          text: () => 'Questions? Ask the big gal, she loves questions.<br><br>And hey — <b>ask first</b>. Manners. You don\'t go shovin\' stuff in a fella\'s intake without askin\'.' },
      ] },
    ] });
})();
