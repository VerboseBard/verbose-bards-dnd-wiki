# Wiki Cross-Link Audit — 2026-08-23

## Scope

This audit reconciles the GitHub wiki repository with the approved Session 10 and Session 11 True Chronicle material, the August Session 11 changelog, and the broader local `wiki` tree. It focuses on player-safe information that should propagate beyond the two session pages into campaign, history, church, faction, place, person, item, and concept pages.

No push was performed during this audit.

## Synchronization Finding

The GitHub repository already contained the Session 10 and Session 11 pages and a small set of connected pages in commit `805c6a0`. The broader August write-back documented in `WIKI-CHANGELOG-2026-08-16.md` existed in the sibling local `wiki` tree but had not been fully reconciled into this repository.

That split explains why the live site could contain Session 10 and Session 11 while older pages, indexes, and story summaries still stopped at Session 9 or omitted the new consequences. This audit merged the transcript-supported, player-safe portions into the repository without copying hidden planning facts.

## Major Updates

- Extended the home page, campaign index, campaign throughline, setting bible, current-age overview, sanity record, and lost-homeland mission through Session 11.
- Added `wiki/concepts/lolths-rise-and-the-great-crusade.md` to connect Lolth's ascent, anti-Lolth drow resistance, the First Dragon, the Weaver, the Great Crusade, the thirteen-site ledger, Hestia's fragments, and the modern leonin crisis.
- Updated Fourth-Age, ages, timeline, Lolth, Hestia, Lucius, Dione, Mave, Belle, the Weaver, the First Dragon, Big Shad, and Sanctuary City history.
- Propagated Church consequences through the Conclave, Inquisition, Ecclesiastical Order, the Justicar, Amir Voss, Bartholomew, the Truth Lantern, and the conditional execution writ.
- Propagated Sunhollow consequences through its council, five clans, internal political currents, delegation leaders, major settlements, the Dead Lands, Ssar'Velyn Temple, and the demon complex.
- Added Session 11 resource-risk notes to ether crystals, Aether Conductors, ether firearms, and the Plasma Greatblade while preserving unresolved timing and Bag of Holding questions.
- Updated the core party and connected witnesses, including Jefferson, Jose, Alistair, Rurik, Reggie, Penelope, Havlin, Walter, Lycus, Rose, Bevar, and Gwen.
- Corrected the Session 9 Penitent arrow count from fourteen to the Session 10 forensic count of fifteen.
- Restored missing category-index entries recorded by earlier audits and confirmed every category page appears in its index.

## Protected Canon Boundaries

- Use **Hadozee**, **Kreen**, and **Hestia**.
- The Hadozee council head killed in Session 11 remains unnamed and is not automatically Matthias Duren.
- Darien or Darian is not established as Talin Duren.
- `Hollowmere` and `Voss` remain the established spellings while the alternate Session 11 hearings await rulings.
- The wiki uses the descriptive name **Leonin Curse-Breaking Ritual** rather than the hidden planning label.
- Amir initiated the preemptive Hadozee plan; Jefferson agreed and helped prepare separation; Church forces and mercenaries fired; the player characters did not join the opening barrage.
- The Justicar's knowledge or approval of that plan remains unestablished.
- The ritual uses an interruption-danger ladder; uninterrupted casualties are not settled.
- The missing thirteenth Fourth-Age site, Alistair's tether mechanics, exact ether-device failure timing, Bag of Holding protection, and whether the spider-bodied observer reached the temple remain unresolved.
- Selyra Vex'ryn's brother remains unnamed in player-facing canon.

## Validation Record

- 589 Markdown pages checked.
- 13,086 local Markdown targets checked; zero broken targets.
- 49 Markdown anchor references checked; zero broken targets.
- 2 external YouTube references opened successfully to the two Moonstone Collectors finale videos.
- 589 generated HTML pages rebuilt.
- 21,249 generated local references checked; zero broken targets.
- 2,911 generated anchor references checked; zero broken anchors.
- Zero generated HTML pages are unreachable from the site home page.
- All campaign, concept, faction, item, people, place, and session pages are represented in their category indexes.
- `git diff --check` reports no whitespace errors.

## Pre-Push State

The repository changes are local and uncommitted. The static site has been rebuilt in `wiki-site`, but no commit or remote push has been made.
