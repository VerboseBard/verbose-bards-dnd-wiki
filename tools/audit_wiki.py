"""Read-only structural audit of this wiki and its generated static site.

Use the site's own simple inline-link and heading rules, rather than assuming
GitHub's renderer. Writes JSON only when --output is supplied; never edits wiki.
"""

import argparse
from collections import Counter, defaultdict, deque
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


INLINE = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
HEADING = re.compile(r"^#{1,6}\s+(.+)$", re.MULTILINE)
CATEGORIES = ("campaign", "concepts", "factions", "items", "people", "places", "sessions")


def slug(heading):
    value = re.sub(r"[^a-z0-9\s-]", "", heading.lower())
    return re.sub(r"\s+", "-", value).strip("-") or "section"


def local_target(source, raw, root):
    parts = urlsplit(unescape(raw))
    if parts.scheme or parts.netloc:
        return None, None
    path = unquote(parts.path).replace("\\", "/")
    target = (root / path.lstrip("/") if path.startswith("/") else source.parent / path).resolve() if path else source
    return target, unquote(parts.fragment)


def reachable(graph, start):
    seen, queue = {start}, deque([start])
    while queue:
        for target in graph.get(queue.popleft(), set()):
            if target not in seen:
                seen.add(target)
                queue.append(target)
    return seen


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.refs = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "a" and "name" in attrs:
            self.ids.append(attrs["name"])
        for key in ("href", "src"):
            if attrs.get(key):
                self.refs.append((self.getpos()[0], attrs[key]))


def audit(wiki, site):
    wiki, site = wiki.resolve(), site.resolve()
    files = sorted(wiki.rglob("*.md"))
    content = {p: p.read_text(encoding="utf-8-sig") for p in files}
    anchors = {p: {slug(h.strip()) for h in HEADING.findall(t)} for p, t in content.items()}
    graph, incoming = defaultdict(set), Counter()
    errors, external, counts = [], set(), Counter()

    def rel(path, root):
        try:
            return path.relative_to(root).as_posix()
        except ValueError:
            return str(path)

    for source, text in content.items():
        for match in INLINE.finditer(text):
            raw = match.group(1)
            target, anchor = local_target(source, raw, wiki)
            if target is None:
                external.add(raw)
                continue
            counts["local_references"] += 1
            line = text.count("\n", 0, match.start()) + 1
            if not target.exists():
                errors.append({"source": rel(source, wiki), "line": line, "target": raw, "type": "missing_target"})
                continue
            if target in content:
                counts["markdown_references"] += 1
                graph[source].add(target)
                if target != source:
                    incoming[target] += 1
            if anchor:
                counts["anchor_references"] += 1
                if target in anchors and anchor not in anchors[target]:
                    errors.append({"source": rel(source, wiki), "line": line, "target": raw, "type": "missing_anchor"})

    omissions = {}
    for category in CATEGORIES:
        category_root = wiki / category
        expected = set(category_root.glob("*.md")) - {category_root / "index.md"}
        absent = expected - graph[category_root / "index.md"]
        if absent:
            omissions[category] = sorted(rel(p, wiki) for p in absent)
    titles = defaultdict(list)
    for source, text in content.items():
        found = re.search(r"^# (.+)$", text, re.MULTILINE)
        if found:
            titles[found.group(1)].append(rel(source, wiki))
    md_result = {
        "pages": len(files), **counts,
        "errors": errors,
        "non_index_orphans": sorted(rel(p, wiki) for p in files if p.name != "index.md" and not incoming[p]),
        "unreachable_from_home": sorted(rel(p, wiki) for p in set(files) - reachable(graph, wiki / "index.md")),
        "top_level_category_index_omissions": omissions,
        "duplicate_titles": {k: v for k, v in titles.items() if len(v) > 1},
        "external_urls_not_network_checked": sorted(external),
    }
    html_files = sorted(site.rglob("*.html"))
    parsed = {}
    for path in html_files:
        parser = PageParser()
        parser.feed(path.read_text(encoding="utf-8-sig"))
        parsed[path] = parser
    html_errors, html_counts, html_graph = [], Counter(), defaultdict(set)
    for source, parser in parsed.items():
        for line, raw in parser.refs:
            target, anchor = local_target(source, raw, site)
            if target is None:
                continue
            html_counts["local_references"] += 1
            if not target.exists():
                html_errors.append({"source": rel(source, site), "line": line, "target": raw, "type": "missing_target"})
                continue
            if target in parsed:
                html_graph[source].add(target)
            if anchor:
                html_counts["anchor_references"] += 1
                if target in parsed and anchor not in parsed[target].ids:
                    html_errors.append({"source": rel(source, site), "line": line, "target": raw, "type": "missing_anchor"})
    html_result = {
        "pages": len(html_files), **html_counts, "errors": html_errors,
        "unreachable_from_home": sorted(rel(p, site) for p in set(html_files) - reachable(html_graph, site / "index.html")),
        "duplicate_ids": {rel(p, site): [k for k, v in Counter(parser.ids).items() if v > 1] for p, parser in parsed.items() if len(set(parser.ids)) != len(parser.ids)},
    }
    return {"checked_at_utc": datetime.now(timezone.utc).isoformat(), "wiki_root": str(wiki), "site_root": str(site), "markdown": md_result, "html": html_result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wiki", required=True, type=Path)
    parser.add_argument("--site", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = audit(args.wiki, args.site)
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 1 if any((result["markdown"]["errors"], result["markdown"]["non_index_orphans"], result["markdown"]["unreachable_from_home"], result["markdown"]["top_level_category_index_omissions"], result["html"]["errors"], result["html"]["unreachable_from_home"])) else 0


if __name__ == "__main__":
    raise SystemExit(main())
