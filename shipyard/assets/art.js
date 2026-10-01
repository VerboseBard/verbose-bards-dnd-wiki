/* Ship schematics, icons and AI avatars as SVG strings.
   Rooms are <g class="zone" data-zone="…">; installed hardware is <g class="feature" data-feature="upgrade_id">
   and appears only when that upgrade is installed (the UI toggles .on). Colors come from CSS. */
(function (root) {
  'use strict';

  const defs = (id) => `
  <defs>
    <pattern id="${id}-grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M20 0H0V20" class="grid-line"/>
    </pattern>
    <pattern id="${id}-grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#${id}-grid)"/>
      <path d="M100 0H0V100" class="grid-line major"/>
    </pattern>
    <pattern id="${id}-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M0 0V10" class="hatch-line"/>
    </pattern>
    <radialGradient id="${id}-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" class="glow-stop-a"/>
      <stop offset="1" class="glow-stop-b"/>
    </radialGradient>
    <filter id="${id}-bloom" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>`;

  const label = (x, y, num, name, sub) => `
    <g class="room-label" transform="translate(${x} ${y})">
      ${num ? `<text class="rl-num" y="-18">${num}</text>` : ''}
      <text class="rl-name">${name}</text>
      ${sub ? `<text class="rl-sub" y="18">${sub}</text>` : ''}
    </g>`;

  // ------------------------------------------------------------------ TYNDR (top-down, 20 px = 1 ft)
  // Two stub-nosed bullets base to base: ogive nose forward, tapered tail around the cargo aperture.
  const T_OUT = 'M22 360C22 292 232 38 404 30H896C1118 38 1240 178 1252 262V458C1240 542 1118 682 896 690H404C232 682 22 428 22 360Z';
  const T_IN = 'M48 360C48 302 244 62 406 54H894C1100 62 1212 186 1228 268V452C1212 534 1100 658 894 666H406C244 658 48 418 48 360Z';

  function tyndr() {
    const id = 'ty';
    return `<svg class="ship-svg" viewBox="-20 -40 1400 800" role="img" aria-labelledby="ty-t ty-d">
  <title id="ty-t">Tyndr deck plan</title>
  <desc id="ty-d">Top-down plan of the shuttle Tyndr: shielded nose intake, central holotable control room, four cabins, rear working bay and cargo ramp.</desc>
  ${defs(id)}
  <rect x="-20" y="-40" width="1400" height="800" fill="url(#${id}-grid-major)" class="bg-grid"/>
  <ellipse cx="650" cy="360" rx="700" ry="400" fill="url(#${id}-glow)" class="bg-glow"/>

  <!-- scale bar -->
  <g class="dim">
    <path d="M40 -12V-28M1250 -12V-28M40 -20H560M730 -20H1250"/>
    <text x="645" y="-14" text-anchor="middle">65 FT</text>
    <path d="M1310 30V690M1302 30H1318M1302 690H1318"/>
    <text x="1322" y="366" class="dim-v">35 FT</text>
  </g>

  <!-- features that sit outside the hull -->
  <g class="feature" data-feature="s_cloak"><path d="${T_OUT}" class="f-halo" transform="translate(-28 -26) scale(1.04 1.075)"/></g>
  <g class="feature" data-feature="s_armor"><path d="${T_OUT}" class="f-armor"/></g>
  <g class="feature" data-feature="s_orbit"><path d="M404 18H896M404 702H896" class="f-seal"/></g>

  <!-- HULL zone: the ring between outer and inner skin -->
  <g class="zone" data-zone="hull">
    <path d="${T_OUT} ${T_IN}" fill-rule="evenodd" class="zone-hit hull-ring"/>
    <path d="${T_OUT}" class="hull-outer"/>
    <path d="${T_IN}" class="hull-inner"/>
    <path d="M420 30H880M420 690H880" class="fieldband"/>
    <path d="M190 132C120 210 50 300 48 360C50 420 120 510 190 588" class="fieldband"/>
    <path d="M1150 120C1200 170 1222 220 1226 268M1150 600C1200 550 1222 500 1226 452" class="fieldband"/>
    <g class="hardpoint"><circle cx="620" cy="30" r="12"/><circle cx="620" cy="690" r="12"/></g>
    <g class="feature" data-feature="s_weapon_mount"><g class="hardpoint extra"><circle cx="880" cy="36" r="10"/><circle cx="880" cy="684" r="10"/></g></g>
    <g class="feature" data-feature="s_force_projector"><g class="turret" transform="translate(620 30)"><circle r="18"/><path d="M0 -8V-40"/></g></g>
    <g class="feature" data-feature="s_fire_projector"><g class="turret hot" transform="translate(620 690)"><circle r="22"/><path d="M-6 8V44M6 8V44"/></g></g>
  </g>

  <!-- 01 INTAKE -->
  <g class="zone" data-zone="intake">
    <path d="M330 196V524H198C140 482 100 420 98 360C100 300 140 238 198 196Z" class="zone-hit room"/>
    <rect x="176" y="286" width="112" height="148" rx="16" class="deco"/>
    <circle cx="232" cy="360" r="34" class="deco"/>
    <path d="M198 360H266M232 326V394" class="deco thin"/>
    <path d="M330 300V420" class="door"/>
    <g class="feature" data-feature="s_food"><circle cx="232" cy="360" r="20" class="f-glow"/><text x="232" y="468" class="f-tag" text-anchor="middle">RATIONS ONLINE</text></g>
    <g class="feature" data-feature="s_core_cradle"><rect x="150" y="224" width="60" height="44" rx="6" class="f-line"/><rect x="150" y="452" width="60" height="44" rx="6" class="f-line"/></g>
    <g class="feature" data-feature="s_inverse_pair"><path d="M232 318L270 360L232 402L194 360Z" class="f-core"/></g>
    <g class="feature" data-feature="s_inverse_salvage"><path d="M232 318L270 360L232 402L194 360Z" class="f-core"/></g>
    <g class="feature" data-feature="s_ley_tap"><path d="M120 360H60M110 300L56 270M110 420L56 450" class="f-ley"/></g>
    ${label(232, 530, '01', 'INTAKE', 'replicator · fuel cradle')}
  </g>

  <!-- 06 CONTROL -->
  <g class="zone" data-zone="control">
    <rect x="330" y="262" width="500" height="196" class="zone-hit room"/>
    <ellipse cx="500" cy="360" rx="78" ry="48" class="holotable"/>
    <path d="M462 360L500 336L538 360L500 384Z" class="holo-glyph"/>
    <g class="hatch-panel"><rect x="646" y="326" width="68" height="68" fill="url(#${id}-hatch)"/><rect x="646" y="326" width="68" height="68" class="deco"/></g>
    <text x="680" y="416" class="tiny" text-anchor="middle">BELLY HATCH</text>
    <g class="feature" data-feature="s_scan_mask"><ellipse cx="500" cy="360" rx="112" ry="72" class="f-ring"/></g>
    <g class="feature" data-feature="s_worldgate"><circle cx="500" cy="360" r="26" class="f-portal"/></g>
    ${label(500, 446, '06', 'CONTROL', '')}
  </g>

  <!-- 02–05 CABINS -->
  <g class="zone" data-zone="cabins">
    <rect x="350" y="74" width="210" height="188" class="zone-hit room"/>
    <rect x="560" y="74" width="210" height="188" class="zone-hit room"/>
    <rect x="350" y="458" width="210" height="188" class="zone-hit room"/>
    <rect x="560" y="458" width="210" height="188" class="zone-hit room"/>
    <g class="deco">
      <rect x="366" y="90" width="120" height="34" rx="4"/><rect x="576" y="90" width="120" height="34" rx="4"/>
      <rect x="366" y="596" width="120" height="34" rx="4"/><rect x="576" y="596" width="120" height="34" rx="4"/>
      <rect x="520" y="90" width="24" height="70" rx="3"/><rect x="730" y="90" width="24" height="70" rx="3"/>
      <rect x="520" y="560" width="24" height="70" rx="3"/><rect x="730" y="560" width="24" height="70" rx="3"/>
    </g>
    <path d="M430 262H480M640 262H690M430 458H480M640 458H690" class="door"/>
    <g class="feature off-when" data-feature="s_cabin_repair" data-invert="1"><rect x="350" y="458" width="210" height="188" fill="url(#${id}-hatch)" class="damage"/><text x="455" y="540" class="warn-tag" text-anchor="middle">BERTHS OFFLINE</text></g>
    <g class="feature" data-feature="s_living_quarters"><rect x="780" y="-30" width="210" height="70" rx="8" class="f-ghost"/><text x="885" y="10" class="f-tag" text-anchor="middle">+ FOLDED ROOM</text></g>
    ${label(455, 200, '02', 'CABIN A', '')}${label(665, 200, '03', 'CABIN B', '')}
    ${label(455, 526, '04', 'CABIN C', '')}${label(665, 526, '05', 'CABIN D', '')}
  </g>

  <!-- 08–11 REAR BAY -->
  <g class="zone" data-zone="bay">
    <path d="M830 70H894C1072 70 1190 170 1212 268V452C1190 550 1072 650 894 650H830Z" class="zone-hit room"/>
    <rect x="850" y="84" width="190" height="62" rx="6" class="deco"/>
    <path d="M866 146V156M896 146V156M926 146V156M956 146V156M986 146V156M1016 146V156" class="deco thin"/>
    <rect x="1066" y="96" width="46" height="96" rx="4" class="deco"/>
    <rect x="910" y="226" width="250" height="250" rx="6" class="tiedown"/>
    <path d="M960 226V476M1010 226V476M1060 226V476M1110 226V476M910 276H1160M910 326H1160M910 376H1160M910 426H1160" class="tiedown-grid"/>
    <rect x="1046" y="578" width="92" height="52" rx="6" class="deco"/>
    <path d="M830 300V420" class="door"/>
    <path d="M1226 272L1330 246V474L1226 448" class="ramp"/>
    <path d="M1250 290H1320M1250 330H1320M1250 370H1320M1250 410H1320" class="ramp-rung"/>
    <g class="feature" data-feature="s_workshop"><rect x="850" y="84" width="190" height="62" rx="6" class="f-glow-rect"/></g>
    <g class="feature" data-feature="s_capacitor"><g class="f-cells"><rect x="1120" y="200" width="24" height="40" rx="3"/><rect x="1120" y="250" width="24" height="40" rx="3"/><rect x="1120" y="300" width="24" height="40" rx="3"/></g></g>
    <g class="feature" data-feature="s_cleanbots"><circle cx="1092" cy="604" r="16" class="f-glow"/><rect x="1150" y="506" width="44" height="60" rx="4" class="f-line"/></g>
    ${label(945, 116, '08', 'ENGINEERING', '')}
    ${label(1035, 360, '10', 'CARGO BAY', 'tie-down grid')}
    ${label(1092, 660, '', 'DRONE DOCK', '')}
    ${label(1280, 510, '11', 'RAMP', '')}
  </g>

  <!-- 09 FIRST AID -->
  <g class="zone" data-zone="aid">
    <rect x="850" y="560" width="170" height="80" rx="6" class="zone-hit room"/>
    <path d="M935 578V622M913 600H957" class="deco thin"/>
    <g class="feature" data-feature="s_medical"><path d="M935 578V622M913 600H957" class="f-cross"/></g>
    ${label(935, 552, '09', 'FIRST AID', '')}
  </g>

  <g class="compass"><path d="M-6 700L10 690L-6 680" /><text x="18" y="696">FWD ◂</text></g>
</svg>`;
  }

  // ------------------------------------------------------------------ KEX (three deck plans, schematic, not to scale)
  // Decks (GM ruling): top = elevated bridge + command systems; middle = entry level, quarters, labs, storage;
  // lower = engineering, workshop, maintenance, drive. The armory broke off one side of the MIDDLE deck, and its tear is
  // where the party first came aboard (sealed by the drones since). The hangar bay is directly opposite on the same deck,
  // still intact (GM rulings 2026-09-30). The lower deck keeps the secondary armory in engineering (Session 5).
  const TEAR = 'H762L746 656L722 632L696 662L670 634L642 654L618 638H560'; // the torn edge where the armory broke away (middle deck)
  const K_OUT = `M70 380L112 252L262 204L334 232L520 202L560 122H1100L1140 202L1262 192L1300 132L1480 152L1522 252V508L1480 608L1300 628L1262 568L1140 558L1100 638${TEAR}L520 558L334 528L262 556L112 508Z`;
  const K_OUT_SOLID = K_OUT.replace(TEAR, 'H560');
  const K_IN = 'M100 380L134 272L266 230L336 256L532 226L578 146H1082L1120 222L1270 214L1310 158L1466 174L1500 262V498L1466 586L1310 602L1270 546L1120 538L1082 614H578L532 534L336 504L266 530L134 488Z';
  const EMITTERS = [[190, 232], [420, 214], [700, 122], [960, 122], [1210, 196], [1420, 148], [190, 528], [420, 546], [650, 638], [980, 638], [1210, 564], [1420, 612]];
  const BOW = 'M140 300L262 262L320 280V480L262 498L140 460L118 380Z';
  const NECK = 'M340 268L528 244V516L340 492Z';
  const AFT = 'M1198 232L1270 224L1320 176L1400 184V580L1320 590L1270 540L1198 532Z';
  const STERN = 'M1410 186L1466 192L1494 266V494L1466 568L1410 574Z';
  const DECK_TITLES = { upper: 'DECK 1 · COMMAND', mid: 'DECK 2 · HABITATION', lower: 'DECK 3 · ENGINEERING' };

  function kexShell(deck, body) {
    const id = `kx${deck[0]}`;
    const out = deck === 'mid' ? K_OUT : K_OUT_SOLID;
    const em = EMITTERS.map(([x, y], i) => `<g class="emitter" data-slot="${i}" transform="translate(${x} ${y})"><circle r="11"/><circle r="4" class="em-core"/></g>`).join('');
    return `<svg class="ship-svg kex-deck deck-${deck}" viewBox="0 20 1640 780" role="img" aria-labelledby="${id}-t ${id}-d">
  <title id="${id}-t">The Kex — ${DECK_TITLES[deck].toLowerCase()}</title>
  <desc id="${id}-d">Deck plan of the goblin trading ship Kex, ${DECK_TITLES[deck].toLowerCase()}, with the outer hull and its ring of empty sockets.</desc>
  ${defs(id)}
  <rect x="0" y="20" width="1640" height="780" fill="url(#${id}-grid-major)" class="bg-grid"/>
  <ellipse cx="800" cy="390" rx="820" ry="420" fill="url(#${id}-glow)" class="bg-glow"/>
  <text x="70" y="86" class="deck-watermark">${DECK_TITLES[deck]}</text>

  <g class="feature" data-feature="k_shield"><ellipse cx="796" cy="392" rx="790" ry="330" class="f-shield"/></g>
  <g class="feature" data-feature="k_fog_cloak"><path d="${out}" class="f-halo soft" transform="translate(-24 -18) scale(1.03 1.05)"/></g>
  <g class="feature" data-feature="k_full_cloak"><path d="${out}" class="f-halo" transform="translate(-44 -34) scale(1.055 1.09)"/></g>
  ${deck === 'mid' ? armoryLost(id) : ''}

  <!-- HULL & SOCKET RING (on every deck) -->
  <g class="zone" data-zone="hull">
    <path d="${out} ${K_IN}" fill-rule="evenodd" class="zone-hit hull-ring"/>
    <path d="${out}" class="hull-outer"/>
    <path d="${K_IN}" class="hull-inner"/>
    <path d="M600 146H1060M600 614H1060" class="plating"/>
    <g class="emitters">${em}</g>
  </g>
  ${body(id)}
  <g class="compass"><path d="M40 760L56 750L40 740"/><text x="64" y="756">BOW ◂</text><text x="1600" y="780" text-anchor="end" class="tiny">SCHEMATIC · NOT TO SCALE</text></g>
</svg>`;
  }

  function armoryLost(id) {
    return `<!-- ARMORY: torn off this side of the middle deck; its tear is where the party first came aboard, sealed since.
       The armory itself drifts as a ghost until recovered. -->
  <g class="zone" data-zone="armory">
    <g class="armory-lost">
      <path d="M620 690L660 676L800 676L836 690V752H620Z" class="zone-hit room ghost"/>
      <path d="M620 690L660 676L800 676L836 690V752H620Z" fill="url(#${id}-hatch)" class="ghost-hatch"/>
      <text x="728" y="720" class="warn-tag" text-anchor="middle">SIGNAL LOST</text>
      <text x="728" y="740" class="tiny" text-anchor="middle">somewhere in Driftvale</text>
      <path d="M700 662L706 674M730 664L726 676M756 660L760 674" class="debris"/>
    </g>
    <rect x="600" y="468" width="220" height="136" rx="4" class="zone-hit room breached"/>
    <rect x="600" y="468" width="220" height="136" rx="4" fill="url(#${id}-hatch)" class="ghost-hatch"/>
    <path d="M640 610H780" class="f-seal"/>
    <text x="710" y="596" class="tiny" text-anchor="middle">BREACH · SEALED</text>
    <g class="feature" data-feature="k_armory_recovery"><path d="M638 604H782V638H638Z" class="f-glow-rect"/><text x="710" y="568" class="f-tag" text-anchor="middle">ARMORY BUS RECONNECTED</text></g>
    ${label(710, 516, '11', 'ARMORY MOUNT', 'you came in here')}
    ${label(930, 716, '', 'ARMORY', 'detached in the crash')}
  </g>`;
  }

  function kexUpper() {
    return kexShell('upper', (id) => `
  <!-- dorsal hull: no rooms on this level aft of the command block -->
  <path d="M790 160H1082L1120 222L1270 214L1310 158L1466 174L1500 262V498L1466 586L1310 602L1270 546L1120 538L1082 606H790Z" fill="url(#${id}-hatch)" class="dorsal"/>
  <text x="1140" y="390" class="tiny dorsal-tag" text-anchor="middle">DORSAL HULL · OPEN TO THE SKY</text>

  <g class="zone" data-zone="bridge">
    <path d="${BOW}" class="zone-hit room"/>
    <path d="M150 330L178 320M150 430L178 440" class="deco"/>
    <path d="M176 300A90 90 0 0 0 176 460" class="deco"/>
    <circle cx="232" cy="380" r="22" class="deco"/>
    <g class="feature" data-feature="k_navigation"><path d="M232 340L240 372L272 380L240 388L232 420L224 388L192 380L224 372Z" class="f-star"/></g>
    ${label(236, 476, '01', 'BRIDGE', 'elevated')}
  </g>

  <g class="zone" data-zone="comms">
    <path d="${NECK}" class="zone-hit room"/>
    <circle cx="434" cy="372" r="30" class="deco"/><circle cx="434" cy="372" r="8" class="deco"/>
    <path d="M434 342V300M404 320L434 300L464 320" class="deco thin"/>
    <g class="feature" data-feature="k_captain_network"><path d="M392 330A60 60 0 0 0 392 414M476 330A60 60 0 0 1 476 414M372 312A86 86 0 0 0 372 432M496 312A86 86 0 0 1 496 432" class="f-waves"/></g>
    ${label(434, 460, '02', 'SENSOR MAST', 'comms relay')}
  </g>

  <g class="zone" data-zone="core">
    <rect x="546" y="292" width="226" height="176" rx="6" class="zone-hit room"/>
    <path d="M659 322L704 348V400L659 426L614 400V348Z" class="deco"/>
    <path d="M659 346L682 360V388L659 402L636 388V360Z" class="deco thin"/>
    <text x="740" y="456" class="tiny" text-anchor="end">▼ STAIRS</text>
    ${label(659, 452, '03', 'KUBIX CORE', '')}
  </g>`);
  }

  function kexMid(hangarOpen) {
    return kexShell('mid', (id) => `
  <g class="zone" data-zone="storage">
    <path d="${BOW}" class="zone-hit room"/>
    <path d="M1310 190L1466 200L1494 266V494L1466 560L1310 570Z" class="zone-hit room"/>
    <path d="M150 350H300M150 410H300M1330 300H1470M1330 460H1470" class="deco thin"/>
    ${label(232, 392, '', 'FWD HOLD', '')}${label(1400, 392, '', 'AFT HOLD', '')}
  </g>

  <g class="zone" data-zone="hangar">
    <rect x="590" y="156" width="482" height="140" rx="4" class="zone-hit room"/>
    <g class="hangar-sealed">
      <rect x="590" y="156" width="482" height="140" fill="url(#${id}-hatch)"/>
      <path d="M610 170L700 240L660 280M1050 170L960 250L1020 284" class="debris"/>
      <text x="831" y="262" class="warn-tag" text-anchor="middle">SEALED</text>
    </g>
    ${hangarOpen ? `<g class="feature" data-feature="k_hangar">
      <g transform="translate(831 232) scale(0.16) translate(-645 -360)" class="mini-shuttle">
        <path d="${T_OUT}"/><path d="M420 30H880M420 690H880" class="fieldband"/>
      </g>
      <path d="M640 146H1020" class="f-seal"/>
    </g>` : ''}
    ${label(700, 196, '08', 'HANGAR BAY', '')}
  </g>

  <g class="zone" data-zone="quarters">
    <path d="${NECK}" class="zone-hit room"/>
    <path d="M360 300H500M360 340H500M360 420H500M360 460H500" class="deco thin"/>
    ${label(434, 392, '04', 'CREW QUARTERS', 'galley · bunks')}
  </g>

  <g class="zone" data-zone="medbay">
    <rect x="832" y="468" width="240" height="136" rx="4" class="zone-hit room"/>
    <g class="deco"><rect x="850" y="482" width="36" height="84" rx="18"/><rect x="898" y="482" width="36" height="84" rx="18"/><rect x="946" y="482" width="36" height="84" rx="18"/><rect x="994" y="482" width="52" height="52" rx="6"/></g>
    <g class="feature" data-feature="k_nanite_clinic"><path d="M1020 542V582M1000 562H1040" class="f-cross"/></g>
    ${label(952, 594, '05', 'SCIENCE LABS', '')}
  </g>

  <g class="zone" data-zone="corridors">
    <rect x="540" y="318" width="650" height="128" rx="4" class="zone-hit room"/>
    <rect x="1200" y="318" width="96" height="128" rx="4" class="zone-hit room"/>
    <path d="M560 382H1180" class="deco"/>
    <rect x="830" y="352" width="60" height="60" class="deco thin"/>
    <path d="M1212 330V434M1228 330V434M1244 330V434M1260 330V434M1276 330V434" class="deco thin"/>
    <text x="1248" y="468" class="tiny" text-anchor="middle">▲▼ STAIRS</text>
    ${label(860, 440, '06', 'MAIN CORRIDOR', '')}
  </g>`);
  }

  function kexLower() {
    return kexShell('lower', () => `
  <g class="zone" data-zone="maintenance">
    <path d="${BOW}" class="zone-hit room"/>
    <path d="${NECK}" class="zone-hit room"/>
    <g class="deco"><circle cx="220" cy="340" r="18"/><circle cx="220" cy="420" r="18"/><circle cx="400" cy="320" r="18"/><circle cx="470" cy="320" r="18"/><circle cx="400" cy="440" r="18"/><circle cx="470" cy="440" r="18"/></g>
    <g class="feature" data-feature="k_slow_repair"><path d="M434 372l10 -18l10 18l-10 18z" class="f-spark"/></g>
    ${label(434, 392, '07', 'MAINTENANCE', 'drone bays')}
  </g>

  <g class="zone" data-zone="workshop">
    <rect x="540" y="306" width="364" height="152" rx="4" class="zone-hit room"/>
    <rect x="700" y="470" width="220" height="134" rx="4" class="zone-hit room"/>
    <path d="M720 500H900M720 536H900M720 572H900" class="deco thin"/>
    ${label(810, 556, '', 'METAL STOCK', 'fabricator feed')}
    <rect x="560" y="324" width="150" height="56" rx="6" class="deco"/>
    <circle cx="820" cy="382" r="44" class="deco"/>
    <path d="M820 338V426M776 382H864" class="deco thin"/>
    <g class="feature" data-feature="k_pattern_archive"><path d="M620 404L640 424L620 444L600 424Z" class="f-core"/><path d="M660 404L680 424L660 444L640 424Z" class="f-core"/></g>
    <g class="feature" data-feature="k_clean_forge"><rect x="720" y="324" width="40" height="120" rx="4" class="f-line"/></g>
    ${label(722, 452, '09', 'WORKSHOP', 'fabrication bay')}
  </g>

  <g class="zone" data-zone="engineering">
    <path d="${AFT}" class="zone-hit room"/>
    <rect x="590" y="156" width="482" height="140" rx="4" class="zone-hit room"/>
    <path d="M610 186H1052M610 222H1052M610 258H1052" class="deco thin"/>
    ${label(831, 232, '', 'SECONDARY ARMORY', 'stripped for drone parts')}
    <rect x="914" y="318" width="274" height="128" rx="4" class="zone-hit room"/>
    <path d="M930 340H1170M930 424H1170" class="deco thin"/>
    <circle cx="1300" cy="382" r="58" class="deco"/>
    <circle cx="1300" cy="382" r="30" class="deco"/>
    <text x="1170" y="306" class="tiny" text-anchor="end">▲ STAIRS</text>
    <g class="feature" data-feature="k_reactor"><circle cx="1300" cy="382" r="24" class="f-reactor"/></g>
    <g class="feature" data-feature="k_battery"><g class="f-cells"><rect x="1222" y="258" width="26" height="46" rx="3"/><rect x="1256" y="250" width="26" height="46" rx="3"/><rect x="1222" y="462" width="26" height="46" rx="3"/><rect x="1256" y="470" width="26" height="46" rx="3"/></g></g>
    <g class="feature" data-feature="k_repair_crew"><circle cx="1360" cy="260" r="12" class="f-glow"/><circle cx="1360" cy="504" r="12" class="f-glow"/><circle cx="1380" cy="382" r="12" class="f-glow"/></g>
    ${label(1300, 470, '10', 'ENGINEERING', 'reactor')}
    ${label(1050, 440, '', 'CONDUITS', '')}
  </g>

  <g class="zone" data-zone="drive">
    <path d="${STERN}" class="zone-hit room"/>
    <g class="nozzles"><rect x="1522" y="262" width="40" height="64" rx="6"/><rect x="1522" y="348" width="40" height="64" rx="6"/><rect x="1522" y="434" width="40" height="64" rx="6"/></g>
    <g class="feature" data-feature="k_thrusters"><path d="M1562 294H1620M1562 380H1630M1562 466H1620" class="f-flare"/></g>
    <g class="feature" data-feature="k_phase_drive"><circle cx="1450" cy="380" r="40" class="f-portal"/></g>
    ${label(1452, 250, '12', 'DRIVE', '')}
  </g>

  <g class="conduits">
    <path d="M1198 382H1188M914 382H904M540 382H528"/>
    <path d="M1250 232V200H1090"/>
  </g>`);
  }

  // The shuttle silhouette is only drawn once the hangar is open, so it is never hidden in the page beforehand.
  function kex(deck, opts) {
    return deck === 'upper' ? kexUpper() : deck === 'lower' ? kexLower() : kexMid(!!(opts && opts.hangarOpen));
  }

  // Side view of the three decks, used as the deck picker.
  function kexElevation(active) {
    const band = (deck, d, n, name, y) => `<g class="deck-band ${deck === active ? 'on' : ''}" data-ui="deck" data-deck="${deck}" tabindex="0" role="button" aria-label="Show deck ${n}, ${name.toLowerCase()}">
      <path d="${d}" class="db-shape"/><text x="356" y="${y}" class="db-label">${n} · ${name}</text></g>`;
    return `<svg class="kex-elevation" viewBox="0 0 470 120" aria-label="Choose a deck">
  ${band('upper', 'M58 22H176L190 32V46H46Z', '1', 'COMMAND', 34)}
  ${band('mid', 'M40 48H318L332 58V74H28L30 62Z', '2', 'HABITATION', 64)}
  ${band('lower', 'M28 76H332L344 86V100L332 108H44L24 94Z', '3', 'ENGINEERING', 96)}
  <path d="M300 30V104" class="db-stair"/>
  <path d="M140 68V80M156 68V80" class="db-armory"/><!-- where the armory tore off the middle deck (drawn over the bands) -->
</svg>`;
  }

  // Neutral stand-in for a bay nobody can read yet. Deliberately says nothing about what is inside.
  function sealedBay() {
    return `<svg class="ship-svg sealed-svg" viewBox="0 0 1400 800" aria-hidden="true" focusable="false">
  ${defs('sb')}
  <rect width="1400" height="800" fill="url(#sb-grid-major)" class="bg-grid"/>
  <rect x="200" y="140" width="1000" height="520" rx="12" class="room ghost"/>
  <rect x="200" y="140" width="1000" height="520" rx="12" fill="url(#sb-hatch)" class="ghost-hatch"/>
  <path d="M260 200L520 420L380 560M1140 210L900 400L1060 600M600 180L700 330L640 470" class="debris"/>
</svg>`;
  }

  // ------------------------------------------------------------------ small art
  const ICON_PATHS = {
    concealment: 'M3 12s3.5-6 9-6c2 0 3.7.7 5 1.7M21 12s-3.5 6-9 6c-2 0-3.7-.7-5-1.7M4 20L20 4M10 12a2 2 0 0 1 2-2',
    access: 'M5 21V4h10l4 4v13M9 21v-6h6v6M15 4v4h4',
    repair: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
    fabrication: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
    medical: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    recovery: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
    power: 'M13 2L4 14h7l-1 8 9-12h-7z',
    propulsion: 'M4 6l6 6-6 6M12 6l6 6-6 6',
    defense: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
    navigation: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM15.5 8.5l-2 5-5 2 2-5z',
    command: 'M12 12v10M8 22h8M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 9a5 5 0 0 0 0 6M15.5 9a5 5 0 0 1 0 6',
    habitation: 'M3 18v-6h18v6M3 12V6M3 18v2M21 18v2M7 12V9h5v3',
    mounts: 'M2 12h20M6 8v8M12 8v8M18 8v8',
    weapons: 'M12 2v5M12 17v5M2 12h5M17 12h5M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
    spatial: 'M12 2l9 5v10l-9 5-9-5V7zM12 12l9-5M12 12v10M12 12L3 7',
    ether: 'M12 2l5 7-5 13-5-13zM7 9h10',
    gold: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9.5c0-1.4 1.3-2 3-2s3 .7 3 2M15 14.5c0 1.4-1.3 2-3 2s-3-.7-3-2M12 6v12',
    kit: 'M3 7h18v13H3zM8 7V4h8v3M3 12h18',
    item: 'M12 2l3 7h7l-5.5 4.5 2 7.5L12 16.5 5.5 21l2-7.5L2 9h7z',
    day: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
    check: 'M4 12l5 5L20 6',
    log: 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h4',
    tree: 'M6 3v6M6 15v6M18 9v6M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM9 12h6',
    hold: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    bridge: 'M3 20h18M5 20V10l7-6 7 6v10M9 20v-5h6v5',
    ship: 'M2 12c0-3 3-6 8-6h4c5 0 8 3 8 6s-3 6-8 6h-4c-5 0-8-3-8-6zM9 9h6M9 15h6',
    gm: 'M12 2l2.4 5 5.6.8-4 3.9.9 5.5L12 14.6 7.1 17.2 8 11.7 4 7.8 9.6 7z',
    save: 'M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7',
    undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
    plus: 'M12 5v14M5 12h14',
    x: 'M6 6l12 12M18 6L6 18',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
    guide: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.5',
  };
  function icon(name, cls) {
    const d = ICON_PATHS[name] || ICON_PATHS.item;
    return `<svg class="icon ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  function avatar(who) {
    if (who === 'tyndr') {
      return `<svg class="avatar tyndr" viewBox="0 0 120 120" aria-hidden="true">
  <path class="av-ear" d="M22 58L2 40l30 6zM98 58l20-18-30 6z"/>
  <path class="av-head" d="M28 56c0-20 14-34 32-34s32 14 32 34-10 38-32 38-32-18-32-38z"/>
  <path class="av-cap" d="M26 50c4-18 18-28 34-28s30 10 34 28c-10-6-22-8-34-8s-24 2-34 8z"/>
  <path class="av-cap" d="M58 42h32l6 6H58z"/>
  <circle class="av-goggle" cx="47" cy="60" r="9"/><circle class="av-eye" cx="75" cy="60" r="5"/>
  <path class="av-mouth" d="M44 78c8 6 24 6 32-2"/><path class="av-tooth" d="M52 80v4M66 80v4"/>
  <path class="av-scan" d="M20 100h80"/>
</svg>`;
    }
    return `<svg class="avatar kubix" viewBox="0 0 120 120" aria-hidden="true">
  <path class="av-frame" d="M60 8l46 26v52l-46 26-46-26V34z"/>
  <path class="av-frame thin" d="M60 24l32 18v36L60 96 28 78V42z"/>
  <circle class="av-iris" cx="60" cy="60" r="16"/><circle class="av-pupil" cx="60" cy="60" r="6"/>
  <path class="av-scan" d="M18 60h24M78 60h24"/>
</svg>`;
  }

  root.KexArt = { tyndr, kex, kexElevation, sealedBay, icon, avatar };
})(typeof self !== 'undefined' ? self : this);
