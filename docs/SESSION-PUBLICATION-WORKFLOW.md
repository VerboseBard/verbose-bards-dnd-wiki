# Session Publication Workflow

## Purpose

Use this workflow whenever a new session, corrected transcript, or GM ruling needs to enter the public wiki. It keeps the GitHub repository as the canonical public record and prevents a second local wiki tree from drifting ahead of the published one.

## 1. Intake

1. Start from [the session intake template](SESSION-INTAKE-TEMPLATE.md).
2. Identify the player-safe source material: corrected transcript, VOD, GM rulings, and approved summaries.
3. Record spelling decisions, identity holds, source disagreements, and facts that must remain unresolved.
4. Keep planning-only material out of the public wiki until it is revealed at the table or explicitly approved for publication.

## 2. Publish the Session Record

1. Create or update `wiki/sessions/session-N.md` in the established session-page style.
2. Add or update the link to the spell-checked transcript.
3. Update the session guide and the campaign's corrected transcript flow.
4. Update the campaign overview and the home page when the current campaign state changes.

The home page's **Last Session Summary** shortcut is generated automatically at each site build. It links to the highest numbered current-campaign `wiki/sessions/session-N.md` page with a nonempty `## Overview` or `## Summary` section. Keep draft intake and planning pages outside the public wiki; historical campaigns use their existing filename prefixes and do not affect this shortcut. Adding the next finished session summary and rebuilding updates the shortcut without editing the home-page link.

## 3. Propagate Consequences

Review the session against each applicable destination:

- people and player-character pages
- factions and organizations
- places and routes
- concepts, eras, and historical timelines
- items, magic, weapons, and rules-facing subsystems
- campaign summaries and open questions
- category indexes and related-link sections

Write only facts supported by table-public material. Attribute testimony, inference, and institutional claims. Preserve explicit uncertainty instead of filling it with a guess.

## 4. Validate

1. Run `powershell -ExecutionPolicy Bypass -File tools\crosslink-wiki.ps1` to review possible missing automatic links. Inspect its suggestions before using `-Fix`.
2. Run `powershell -ExecutionPolicy Bypass -File tools\build-wiki-site.ps1`.
3. Run `python tools/audit_wiki.py --wiki wiki --site wiki-site --output wiki-audit.json` to check local Markdown targets, generated HTML links and anchors, category coverage, and reachability. Keep the generated audit JSON local unless it is intentionally prepared for publication.
4. Check for stale spellings, protected identities, and outdated campaign-state language.
5. Open the deployed GitHub Pages site after the push and read the home page, new session page, campaign flow, and every major new lore page.

## 5. Commit and Publish

1. Add only player-safe wiki, documentation, and audit files.
2. Commit with a clear session or ruling-focused message.
3. Push `main`; GitHub Actions rebuilds and deploys the site.
4. Record unusual reconciliation work or source conflicts in a dated audit note at the repository root.

## Next Session Intake

When new session material arrives, copy the intake template into the transcript or audit workspace first. Create the public session page once there is a player-safe transcript, VOD, or GM-approved summary to cite. Session 12 follows this process with a recording, a reviewed automated transcript, and explicitly preserved uncertainties.
