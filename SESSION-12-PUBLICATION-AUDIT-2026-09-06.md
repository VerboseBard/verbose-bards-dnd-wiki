# Session 12 Publication Audit — September 6, 2026

## Published Material

The [Session 12 summary](wiki/sessions/session-12.md) covers the 4:58:14 [recording](https://www.youtube.com/watch?v=eqYr6r-jOVk). The [transcript page](wiki/sessions/session-12-transcript.md) provides reviewed timestamped TXT and SRT exports and documents their limits.

The source is one locally generated Whisper large-v3 witness. A full text review, targeted re-decoding, two coherent-span repetition repairs, canonical spelling corrections, and explicit editorial notes produced the reviewed exports. They are not certified verbatim or reliably diarized. Minor unclear battle bookkeeping is not promoted into settled statistics. The GM's subsequent September 6, 2026 clarification establishes that Alistair lost several sanity points during the battle; the summary, related articles, and transcript's editorial notes have been updated accordingly.

## Consequences Reconciled

The campaign overview, corrected flow, story so far, timeline, current setting overview, and affected people, factions, places, concepts and items now reflect Session 12. The main demon battle is won; the Justicar survives and restores fallen allies; Alistair's tether remains. The Church's cleansing, the valley's curse-breaking ritual, ongoing evacuation, and local portal-fuel consumption are kept distinct. Rurik departs freely, Bartholomew guards the Church, and the other player characters choose river rest and crystal gathering.

Five descriptive item articles document the living storage bag, drow sending ring, refined demon-blood mixture, dwarven survivor's journal, and Underdark field treatise. Related articles distinguish them from earlier bags, rings, samples, books and historical events. Testimony and unresolved identity are attributed rather than guessed. New related links point back to the session and associated articles.

The audit also corrected previously retained provenance issues: the Norinar child remains unnamed, Session 9 describes the actual descent route, and historical officer accounts retain their source-note attribution and unresolved roster correspondence. Protected spellings, identities, and still-open active-arc questions were checked.

## Homepage and Builder

The homepage now includes **Last Session Summary**, generated from the highest-numbered current-campaign `session-N.md` with a nonempty Overview or Summary section. Historical campaign prefixes and empty future placeholders are excluded. Adding the next completed summary updates the shortcut on the next build. The existing summary title is displayed alongside the link.

Both Markdown reads in the builder now explicitly use UTF-8. This corrects punctuation corruption under Windows PowerShell 5 while retaining HTML escaping. Isolated fixtures verified numeric ordering, automatic advancement from Session 11 to 12, historical and empty-file exclusion, absence of the shortcut when no summary exists, homepage-only placement, and no-BOM UTF-8 punctuation and accented text.

## Validation

- Static build: **596 Markdown pages → 596 HTML pages**.
- Markdown: **13,324 local references**, including **49 anchor references**; zero missing targets, missing anchors, non-index orphans, unreachable pages, or top-level category omissions.
- Generated HTML: **21,608 local references**, including **2,968 anchor references**; zero missing targets, missing anchors, unreachable pages, or duplicate IDs.
- Public reviewed TXT and SRT exports exactly match the reviewed source derivatives by SHA-256.
- Reviewed transcript: **504 segments**, zero nonpositive durations or overlapping adjacent timestamp ranges; original raw witness contains 440 segments.
- Visual/browser check: homepage shortcut selects Session 12, summary opens its transcript page, download targets are present, and corrected Unicode renders properly.
- `git diff --check` passes. Optional cross-link suggestions were reviewed without blindly applying ambiguous aliases.

The reusable structural check is `python tools/audit_wiki.py --wiki wiki --site wiki-site`. It checks local links and structure; it does not claim to adjudicate every historical statement. Factual review for this publication covers Session 12, affected continuity, protected current canon, and the identified historical provenance issues. External recording references were checked at source intake; arbitrary remote websites are outside the local-link check.

## Bartholomew Continuity Follow-Up

The GM's September 6 clarification makes Bartholomew's prior dwarven special-forces service explicit before his mixed-race assignment. The character, Sentinels, Dragon Watch, Fourth/Fifth Age, timeline, campaign narrative/flow, session summary, and journal pages now connect the demon-blood cult raid, deaths of elite firstborn, and politically motivated reassignment months later. The head of his order praises the raid, suspects family sponsorship without proof, and warns of a growing military faction advocating demonic and undead power. The later Fifth-Age journal remains a separate history, attached to the same older ritual book overlooked during the raid. The recording places the remembered meeting four months after the raid; the narrative uses "months later."

The ten-page follow-up received a separate source review against the 4:12–4:22 and 4:42–4:49 passages and the GM clarification. No unsupported chronology, faction identification, or book identity was found. Unknown people and the book's mental presence remain unidentified.

## Publication

This source is published through the repository's existing **Deploy Wikipedia** GitHub Pages workflow when merged/pushed to `main`. The canonical site is [Verbose Bard's D&D Wikipedia](https://verbosebard.github.io/verbose-bards-dnd-wiki/). The local campaign completion record retains the deployed commit, workflow result, production verification, and private comparison/worldbuilding links.
