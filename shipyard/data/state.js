// Official Kex Shipyard record — revision 1, day 1 = the day the message packet reaches the party (end of Session 14).
// Advance days during the ~3-week journey; the reserve (147 PU at 7/day) runs out around arrival.
// The GM replaces this file with the one downloaded from Office → Publish, then pushes.
// Anything not listed here is filled in from the catalog (e.g. which schematics start revealed).
// UNCONFIRMED STARTING NUMBERS: treasury, raw chunks and reserves are planning examples until the GM checks
// them against the party's sheets after Session 14.
window.KEX_OFFICIAL_STATE = {
  schema: 1,
  revision: 1,
  label: 'Heading back to the Kex. Kubix is in maintenance mode and counting down. (Starting numbers not yet confirmed by the GM.)',
  day: 1,
  market: 'sin_exchange',
  treasury: 216000,
  rawChunks: 23,
  refinedDisks: 0,
  kits: 0,
  inventory: {},
  patterns: [],
  crew: ['Party fund', 'Jose', 'Jefferson', 'Alistair'],
  hulls: {
    kex: { charge: 147, mode: 'active', strain: 0 }, // maintenance mode: 7 PU/day for 21 days (GM ruling)
    shuttle: { charge: 40, mode: 'docked', strain: 1, found: false, leyAccess: false },
  },
  // The drones had the hangar approach half cleared before maintenance mode: its metal, kits and crews are
  // already in place, so only the power (45 PU, loaded before the 3 work days) is left (GM ruling).
  projects: {
    k_hangar: { paid: { gp: 450, kits: 6, pu: 0 }, parts: [2], partItem: ['repair_drone'], partFab: [0] },
  },
  log: [
    { day: 1, who: 'Kubix', text: 'Hull integrity holding. Main propulsion does not answer. The fog supply is gone, so I have dropped into maintenance mode: 7 PU a day from a 147 PU reserve — about three weeks. I paused the hangar clearing to save power; the materials are in place, and it needs three work days and 45 PU of power to finish. I am working on other ways to power myself and will report when you arrive.', kind: 'info' },
  ],
};
