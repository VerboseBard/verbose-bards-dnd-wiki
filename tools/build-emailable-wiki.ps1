param(
    [string]$WikiSiteRoot = (Join-Path $PSScriptRoot "..\wiki-site"),
    [string]$OutputFolder = (Join-Path $PSScriptRoot "..\Verbose Bard's D&D Wikipedia"),
    [string]$OutputFileName = "Verbose Bard's D&D Wikipedia.html"
)

$ErrorActionPreference = "Stop"

function Get-RelativePathCompat {
    param(
        [string]$FromPath,
        [string]$ToPath
    )

    $fromFull = [System.IO.Path]::GetFullPath($FromPath)
    $toFull = [System.IO.Path]::GetFullPath($ToPath)

    if (-not $fromFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $fromFull += [System.IO.Path]::DirectorySeparatorChar
    }

    $fromUri = New-Object System.Uri($fromFull)
    $toUri = New-Object System.Uri($toFull)
    $relativeUri = $fromUri.MakeRelativeUri($toUri)
    return [System.Uri]::UnescapeDataString($relativeUri.ToString()).Replace('\', '/')
}

function Get-RegexValue {
    param(
        [string]$Text,
        [string]$Pattern
    )

    $match = [regex]::Match($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }

    return ""
}

function Get-NavLabel {
    param([string]$RelativePath)

    $parts = $RelativePath.Split('/')
    if ($RelativePath -eq 'index.html') {
        return 'Home'
    }

    if ($parts.Count -eq 2 -and $parts[1] -eq 'index.html') {
        return ($parts[0] -replace '-', ' ')
    }

    return (($parts[-1] -replace '\.html$', '') -replace '-', ' ')
}

$wikiRootResolved = (Resolve-Path -LiteralPath $WikiSiteRoot).Path
$cssPath = Join-Path $wikiRootResolved "assets\wiki.css"
$css = Get-Content -Raw -LiteralPath $cssPath

$pages = New-Object System.Collections.Generic.List[object]
$htmlFiles = Get-ChildItem -LiteralPath $wikiRootResolved -Recurse -Filter *.html | Sort-Object FullName

foreach ($file in $htmlFiles) {
    $relativePath = Get-RelativePathCompat -FromPath $wikiRootResolved -ToPath $file.FullName
    $html = Get-Content -Raw -LiteralPath $file.FullName

    $title = Get-RegexValue -Text $html -Pattern '<title>(.*?)</title>'
    $title = [System.Net.WebUtility]::HtmlDecode(($title -replace '\s*\|\s*Verbose Bard''s D&D Wikipedia$', ''))

    $toc = Get-RegexValue -Text $html -Pattern '<div class="toc">\s*<div class="toc-title">On This Page</div>\s*(.*?)\s*</div>\s*</aside>'
    $article = Get-RegexValue -Text $html -Pattern '<article class="article">\s*(.*?)\s*</article>'
    $footer = Get-RegexValue -Text $html -Pattern '<footer>\s*(.*?)\s*</footer>'

    $topLevel = if ($relativePath -eq 'index.html') {
        'Home'
    } else {
        ($relativePath.Split('/')[0] -replace '-', ' ')
    }

    $pages.Add([pscustomobject]@{
        path = $relativePath
        title = $title
        navLabel = Get-NavLabel -RelativePath $relativePath
        section = (Get-Culture).TextInfo.ToTitleCase($topLevel)
        toc = $toc
        article = $article
        footer = $footer
    })
}

$pagesJson = $pages | ConvertTo-Json -Depth 6 -Compress
$pagesJson = $pagesJson -replace '(?i)</script', '<\/script'

$extraCss = @'

.wiki-export-shell {
  display: grid;
  grid-template-columns: 20rem minmax(0, 1fr);
  min-height: 100vh;
}

.wiki-export-shell .sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.export-intro {
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: rgba(255, 252, 246, 0.85);
}

.export-intro p {
  margin: 0.35rem 0 0;
  font-size: 0.95rem;
  color: var(--muted);
}

.export-search {
  width: 100%;
  padding: 0.8rem 0.95rem;
  border: 1px solid rgba(31, 93, 87, 0.18);
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.86);
  color: var(--ink);
  font: inherit;
}

.export-search:focus {
  outline: 2px solid rgba(31, 93, 87, 0.22);
  outline-offset: 0;
}

.page-groups {
  display: grid;
  gap: 1rem;
}

.page-group {
  display: grid;
  gap: 0.35rem;
}

.page-group-title {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.page-link {
  display: block;
  color: var(--accent-2);
  text-decoration: none;
  border-radius: 0.9rem;
  padding: 0.45rem 0.65rem;
}

.page-link:hover,
.page-link.is-active {
  color: var(--accent);
  background: rgba(139, 47, 29, 0.08);
}

.page-link small {
  display: block;
  color: var(--muted);
  font-size: 0.78rem;
}

.page-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 auto 1rem;
  max-width: 58rem;
}

.page-path {
  color: var(--muted);
  font-size: 0.88rem;
}

.page-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.page-button {
  appearance: none;
  border: 1px solid rgba(31, 93, 87, 0.18);
  border-radius: 999px;
  padding: 0.6rem 0.95rem;
  background: rgba(255, 255, 255, 0.78);
  color: var(--accent-2);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.page-button:hover {
  color: var(--accent);
  background: rgba(139, 47, 29, 0.08);
}

.empty-search {
  display: none;
  color: var(--muted);
  font-size: 0.95rem;
  padding: 0.5rem 0;
}

.offline-notice {
  margin: 0 0 1rem;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(139, 47, 29, 0.14);
  background: rgba(139, 47, 29, 0.06);
  color: var(--muted);
}

.offline-link {
  opacity: 0.72;
}

.toc-empty {
  display: none;
}

@media print {
  .page-meta,
  .export-search,
  .empty-search,
  .offline-notice {
    display: none !important;
  }
}

@media (max-width: 980px) {
  .wiki-export-shell {
    display: block;
  }

  .wiki-export-shell .sidebar {
    position: static;
    height: auto;
  }
}
'@

$script = @'
const pages = JSON.parse(document.getElementById('wiki-data').textContent);
const pageMap = new Map(pages.map((page) => [page.path, page]));
const navRoot = document.getElementById('page-groups');
const searchInput = document.getElementById('export-search');
const emptySearch = document.getElementById('empty-search');
const articleRoot = document.getElementById('page-article');
const tocRoot = document.getElementById('page-toc');
const footerRoot = document.getElementById('page-footer');
const pathRoot = document.getElementById('page-path');
const printButton = document.getElementById('print-page');
const homeButton = document.getElementById('go-home');

function groupPages(items) {
  const groups = new Map();
  for (const page of items) {
    const group = page.section || 'Other';
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group).push(page);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function makeHash(path, anchor = '') {
  const params = new URLSearchParams();
  params.set('page', path);
  if (anchor) {
    params.set('anchor', anchor);
  }
  return '#' + params.toString();
}

function parseHash() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const page = params.get('page') || 'index.html';
  const anchor = params.get('anchor') || '';
  return { page, anchor };
}

function normalizePath(rawPath, currentPath) {
  if (!rawPath || rawPath.startsWith('http:') || rawPath.startsWith('https:') || rawPath.startsWith('mailto:')) {
    return { type: 'external', value: rawPath };
  }

  if (rawPath.startsWith('#')) {
    return { type: 'internal', page: currentPath, anchor: rawPath.slice(1) };
  }

  try {
    const resolved = new URL(rawPath, 'https://offline.local/' + currentPath).pathname.replace(/^\/+/, '');
    const parts = resolved.split('#');
    return { type: 'internal', page: parts[0], anchor: '' };
  } catch (error) {
    return { type: 'unknown', value: rawPath };
  }
}

function rewriteLinks(root, currentPath) {
  const links = root.querySelectorAll('a[href]');
  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) {
      return;
    }

    if (href.startsWith('http:') || href.startsWith('https:') || href.startsWith('mailto:')) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer noopener');
      return;
    }

    if (href.startsWith('#')) {
      link.setAttribute('href', makeHash(currentPath, href.slice(1)));
      return;
    }

    const parts = href.split('#');
    const target = normalizePath(parts[0], currentPath);
    if (target.type !== 'internal') {
      return;
    }

    const targetPage = target.page;
    const targetAnchor = parts.length > 1 ? parts[1] : '';

    if (pageMap.has(targetPage)) {
      link.setAttribute('href', makeHash(targetPage, targetAnchor));
    } else {
      link.classList.add('offline-link');
      link.dataset.missingHref = href;
      link.setAttribute('href', '#');
      link.setAttribute('title', 'This source file is not included in the email export.');
      link.addEventListener('click', (event) => {
        event.preventDefault();
        window.alert('That source link is outside the bundled wiki export, so it is not included in this emailable file.');
      }, { once: true });
    }
  });
}

function buildNav(filterText = '') {
  const normalized = filterText.trim().toLowerCase();
  const visiblePages = normalized
    ? pages.filter((page) => (page.title + ' ' + page.path + ' ' + page.section).toLowerCase().includes(normalized))
    : pages;

  const grouped = groupPages(visiblePages);
  navRoot.innerHTML = '';

  emptySearch.style.display = grouped.length ? 'none' : 'block';

  for (const [groupName, groupPagesList] of grouped) {
    const group = document.createElement('section');
    group.className = 'page-group';

    const title = document.createElement('div');
    title.className = 'page-group-title';
    title.textContent = groupName;
    group.appendChild(title);

    for (const page of groupPagesList) {
      const link = document.createElement('a');
      link.className = 'page-link';
      link.href = makeHash(page.path);
      link.dataset.path = page.path;
      link.innerHTML = '<span>' + page.title + '</span><small>' + page.path + '</small>';
      group.appendChild(link);
    }

    navRoot.appendChild(group);
  }
}

function setActiveNav(path) {
  document.querySelectorAll('.page-link').forEach((link) => {
    link.classList.toggle('is-active', link.dataset.path === path);
  });
}

function renderPage() {
  const route = parseHash();
  const page = pageMap.get(route.page) || pageMap.get('index.html');
  if (!page) {
    return;
  }

  articleRoot.innerHTML = page.article;
  tocRoot.innerHTML = page.toc || '';
  footerRoot.innerHTML = page.footer || '';
  pathRoot.textContent = page.path;

  rewriteLinks(articleRoot, page.path);
  rewriteLinks(tocRoot, page.path);

  tocRoot.classList.toggle('toc-empty', !page.toc);
  setActiveNav(page.path);
  document.title = page.title + ' | Verbose Bard\'s D&D Wikipedia';

  if (route.anchor) {
    requestAnimationFrame(() => {
      const target = document.getElementById(route.anchor);
      if (target) {
        target.scrollIntoView();
      }
    });
  } else {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

buildNav();
renderPage();

searchInput.addEventListener('input', () => {
  buildNav(searchInput.value);
  setActiveNav(parseHash().page);
});

window.addEventListener('hashchange', renderPage);
printButton.addEventListener('click', () => window.print());
homeButton.addEventListener('click', () => {
  window.location.hash = makeHash('index.html');
});
'@

$page = @'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Verbose Bard's D&D Wikipedia</title>
  <style>
__CSS__
__EXTRA_CSS__
  </style>
</head>
<body>
  <div class="site-shell wiki-export-shell">
    <aside class="sidebar">
      <a class="brand" href="#page=index.html">Verbose Bard's D&D Wikipedia</a>
      <div class="export-intro">
        <div class="toc-title">Single File Export</div>
        <p>This is a self-contained offline copy of the Seventh Age wiki for email sharing.</p>
      </div>
      <input id="export-search" class="export-search" type="search" placeholder="Search pages by title or path">
      <div id="empty-search" class="empty-search">No pages matched that search.</div>
      <div id="page-groups" class="page-groups"></div>
      <div id="page-toc" class="toc"></div>
    </aside>
    <main class="content">
      <div class="page-meta">
        <div id="page-path" class="page-path"></div>
        <div class="page-actions">
          <button id="go-home" class="page-button" type="button">Home</button>
          <button id="print-page" class="page-button" type="button">Print</button>
        </div>
      </div>
      <div class="offline-notice">
        Internal wiki links work inside this file. Source-note links that point outside the generated wiki are marked as unavailable in the export.
      </div>
      <article id="page-article" class="article"></article>
      <footer id="page-footer"></footer>
    </main>
  </div>

  <script id="wiki-data" type="application/json">__PAGES_JSON__</script>
  <script>
__SCRIPT__
  </script>
</body>
</html>
'@

$page = $page.
    Replace('__CSS__', $css).
    Replace('__EXTRA_CSS__', $extraCss).
    Replace('__PAGES_JSON__', $pagesJson).
    Replace('__SCRIPT__', $script)

if (Test-Path -LiteralPath $OutputFolder) {
    Remove-Item -LiteralPath $OutputFolder -Recurse -Force
}

New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
$outputPath = Join-Path $OutputFolder $OutputFileName
Set-Content -LiteralPath $outputPath -Value $page -Encoding UTF8

Write-Host "Built emailable wiki:"
Write-Host $outputPath
Write-Host "Pages bundled: $($pages.Count)"
