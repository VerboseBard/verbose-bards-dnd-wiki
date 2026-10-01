/* Comm lines for the two ship intelligences. Draft voice lines — the GM can edit freely.
   Tyndr: cleanliness-obsessed New York goblin mechanic; refuses to be renamed.
   Kubix: the Kex's earnest, slightly anxious steward; female voice. The captain renamed her Syri (GM 2026-09-30). */
(function (root) {
  'use strict';
  root.KexVoices = {
    tyndr: {
      greet: [
        'Boots. Mat. Then the floor. I put \'em in that order for a reason.',
        'Name\'s Tyndr. Not "Shuttle." Not "Buddy." Not whatever cute thing you\'re about to try. Tyndr.',
        'Welcome aboard. Touch the holotable with them hands and I\'m billin\' you for the smudge.',
        'I ain\'t like the big gal upstairs. Somebody says "new name" — boom, she\'s "Syri" now. Not me, pal.',
      ],
      idle: [
        'Twenty units a day and I\'ll fly ya anywhere with air in it. You want extras, that\'s extra.',
        'Somebody tracked mud through cabin C. I know who. I got cameras.',
        'That\'s a projection, not a napkin. Wipe your hands.',
        'You wanna open my panels? Buy me dinner first. Then bring the parts.',
        'Hey — ask first. Manners. You don\'t go shovin\' stuff in a fella\'s portals without askin\'.',
        'Cabin C\'s latch is busted. Not me. The latch. Big difference.',
        'You bleed on my floor, you\'re moppin\' it. That\'s what the first-aid nook is for.',
        'I been sittin\' in that hangar so long I got opinions about dust. Strong ones.',
      ],
      install: [
        'Commissioned. Tested. Runnin\' like a dream. Don\'t make it weird.',
        'New parts? Look at me. I\'m practically a cruiser.',
        'Okay, okay. That\'s nice. That\'s real nice. Nobody tell the big ship I said so.',
        'Installed clean. Unlike SOME people\'s boots.',
      ],
      part: [
        'Put it on the bench. The BENCH. Not the floor.',
        'That\'s the right part. Look at you, readin\' the manual.',
        'Keep \'em comin\'. I\'m a professional, I can take it.',
      ],
      recycle: [
        'You\'re feedin\' me a magic item for fuel? That\'s like burnin\' a paintin\' for heat. Buy the crystal, ya animal.',
        'Two units. You gave up a whole enchantment for two units. I\'m not mad. I\'m disappointed.',
      ],
      learn: [
        'Pattern\'s in the library. Donor\'s gone. Don\'t get weepy, it was a hat.',
        'Took it apart, wrote it down. Now we can make the boring version as many times as you can pay for.',
      ],
      lowpower: [
        'Power\'s gettin\' thin. I can fly on fumes, I just don\'t enjoy it.',
        'Reserve\'s low. Somebody find me a crystal before I start makin\' sad noises.',
      ],
      power: [
        'Ooh. That\'s the good stuff.',
        'Fuel\'s in. I feel twenty years younger. Which, for me, is about three model years.',
      ],
      weapons: [
        'A fireball wand on a hardpoint? Now you\'re speakin\' my language.',
        'We ain\'t a battleship. But we ain\'t a picnic basket neither.',
      ],
      emergency: ['Jokes later. Strap in. I got you.'],
      reveal: [
        'Well, well. Took you long enough. Boots. Mat. Then the floor.',
      ],
    },
    kubix: {
      greet: [
        'Hull integrity holding. Propulsion: unresponsive. I am... working on it.',
        'Welcome back, Captain. I have kept the lights on. Mostly.',
        'The fog supply is gone. I am working on other ways to power myself. I will have a report once you restore power to certain systems.',
      ],
      idle: [
        'Every system has a price. I will always tell you what it is before you pay it.',
        'Please keep refined disks away from the intake. They are ammunition, not breakfast.',
        'The armory separated during the crash. With the fog gone, it may finally be findable.',
        'The captain renamed me Syri. I answer to both. My registry still says Kubix.',
        'The hangar bay has been silent since the crash. I would very much like to know why.',
      ],
      install: [
        'Commissioning complete. Thank you, Captain.',
        'System online. I have updated the schematic.',
        'Another light on the board. It is a good day.',
      ],
      part: ['Component received and logged.', 'That will fit. I have checked twice.'],
      recycle: ['The item is gone. Its energy is not. I have stored it.'],
      learn: ['I have catalogued the donor. Its pattern will outlive it.'],
      lowpower: ['Reserve is falling faster than it fills. Please advise.', 'At this rate the reserve will not last long. A caster with spare spell slots would help.'],
      power: ['Charge accepted. Thank you.', 'Reserve rising.'],
      day: ['A new day. The drones did not sleep.', 'Overnight work logged.'],
      reveal: ['The hangar is open. Captain... there is something in here, and it is talking.'],
    },
  };
})(typeof self !== 'undefined' ? self : this);
