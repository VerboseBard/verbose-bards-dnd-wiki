param(
    [string]$WikiRoot = (Join-Path $PSScriptRoot "..\wiki"),
    [string]$OutputRoot = (Join-Path $PSScriptRoot "..\wiki-site")
)

$ErrorActionPreference = "Stop"
$SiteTitle = "Verbose Bard's D&D Wikipedia"

function ConvertTo-HtmlText {
    param([string]$Text)
    if ($null -eq $Text) { return "" }
    return [System.Net.WebUtility]::HtmlEncode($Text)
}

function Convert-InlineMarkdown {
    param(
        [string]$Text,
        [string]$CurrentInputDir,
        [string]$CurrentOutputDir
    )

    $encoded = ConvertTo-HtmlText $Text

    $encoded = [regex]::Replace($encoded, '\*\*([^*]+)\*\*', '<strong>$1</strong>')
    $encoded = [regex]::Replace($encoded, '`([^`]+)`', '<code>$1</code>')

    $encoded = [regex]::Replace($encoded, '!\[([^\]]*)\]\(([^)]+)\)', {
        param($m)

        $alt = ConvertTo-HtmlText $m.Groups[1].Value
        $target = [System.Net.WebUtility]::HtmlDecode($m.Groups[2].Value)

        if ($target -match '^(https?:)') {
            $src = ConvertTo-HtmlText $target
            return "<img src=""$src"" alt=""$alt"">"
        }

        $pathOnly = $target
        if ($target.Contains("#")) {
            $pathOnly = $target.Split("#", 2)[0]
        }

        $sourceTarget = Join-Path $CurrentInputDir $pathOnly
        $resolvedSource = [System.IO.Path]::GetFullPath($sourceTarget)

        if ($resolvedSource.StartsWith([System.IO.Path]::GetFullPath($WikiRoot), [System.StringComparison]::OrdinalIgnoreCase)) {
            $relativeToWiki = Get-RelativePathCompat -FromPath (Resolve-Path -LiteralPath $WikiRoot).Path -ToPath $resolvedSource
            $outputTarget = Join-Path (Resolve-Path -LiteralPath $OutputRoot).Path $relativeToWiki
            $relativeFromCurrent = (Get-RelativePathCompat -FromPath $CurrentOutputDir -ToPath $outputTarget).Replace('\', '/')
            $src = ConvertTo-HtmlText $relativeFromCurrent
            return "<img src=""$src"" alt=""$alt"">"
        }

        $fallback = $pathOnly.Replace('\', '/')
        $src = ConvertTo-HtmlText $fallback
        return "<img src=""$src"" alt=""$alt"">"
    })

    $encoded = [regex]::Replace($encoded, '\[([^\]]+)\]\(([^)]+)\)', {
        param($m)

        $label = $m.Groups[1].Value
        $target = [System.Net.WebUtility]::HtmlDecode($m.Groups[2].Value)

        if ($target -match '^(https?:|mailto:)') {
            $href = ConvertTo-HtmlText $target
            return "<a href=""$href"">$label</a>"
        }

        $anchor = ""
        $pathOnly = $target
        if ($target.Contains("#")) {
            $parts = $target.Split("#", 2)
            $pathOnly = $parts[0]
            $anchor = "#" + $parts[1]
        }

        if ([string]::IsNullOrWhiteSpace($pathOnly)) {
            $href = ConvertTo-HtmlText $target
            return "<a href=""$href"">$label</a>"
        }

        if ($pathOnly -match '\.md$') {
            $sourceTarget = Join-Path $CurrentInputDir $pathOnly
            $resolvedSource = [System.IO.Path]::GetFullPath($sourceTarget)

            if ($resolvedSource.StartsWith([System.IO.Path]::GetFullPath($WikiRoot), [System.StringComparison]::OrdinalIgnoreCase)) {
                $relativeToWiki = Get-RelativePathCompat -FromPath (Resolve-Path -LiteralPath $WikiRoot).Path -ToPath $resolvedSource
                $htmlTarget = [System.IO.Path]::ChangeExtension($relativeToWiki, ".html")
                $outputTarget = Join-Path (Resolve-Path -LiteralPath $OutputRoot).Path $htmlTarget
                $relativeFromCurrent = (Get-RelativePathCompat -FromPath $CurrentOutputDir -ToPath $outputTarget).Replace('\', '/')
                $href = ConvertTo-HtmlText ($relativeFromCurrent + $anchor)
                return "<a href=""$href"">$label</a>"
            }
        }

        $fallback = $pathOnly.Replace('\', '/')
        if ($fallback -match '\.md$') {
            $fallback = [System.IO.Path]::ChangeExtension($fallback, ".html").Replace('\', '/')
        }
        $href = ConvertTo-HtmlText ($fallback + $anchor)
        return "<a href=""$href"">$label</a>"
    })

    return $encoded
}

function Get-Slug {
    param([string]$Heading)
    $slug = $Heading.ToLowerInvariant()
    $slug = [regex]::Replace($slug, '[^a-z0-9\s-]', '')
    $slug = [regex]::Replace($slug, '\s+', '-').Trim('-')
    if ([string]::IsNullOrWhiteSpace($slug)) { return "section" }
    return $slug
}

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
    return [System.Uri]::UnescapeDataString($relativeUri.ToString()).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Convert-MarkdownFile {
    param(
        [string]$InputPath,
        [string]$OutputPath
    )

    $inputDir = Split-Path -Parent $InputPath
    $outputDir = Split-Path -Parent $OutputPath
    $lines = Get-Content -LiteralPath $InputPath
    $html = New-Object System.Collections.Generic.List[string]
    $toc = New-Object System.Collections.Generic.List[object]
    $title = [System.IO.Path]::GetFileNameWithoutExtension($InputPath)
    $inList = $false

    foreach ($line in $lines) {
        if ($line -match '^(#{1,6})\s+(.+)$') {
            if ($inList) {
                $html.Add("</ul>")
                $inList = $false
            }

            $level = $matches[1].Length
            $headingText = $matches[2].Trim()
            if ($level -eq 1) { $title = $headingText }
            $id = Get-Slug $headingText
            if ($level -le 3) {
                $toc.Add([pscustomobject]@{ Level = $level; Text = $headingText; Id = $id })
            }
            $inline = Convert-InlineMarkdown -Text $headingText -CurrentInputDir $inputDir -CurrentOutputDir $outputDir
            $html.Add("<h$level id=""$id"">$inline</h$level>")
            continue
        }

        if ($line -match '^\s*-\s+(.+)$') {
            if (-not $inList) {
                $html.Add("<ul>")
                $inList = $true
            }
            $inline = Convert-InlineMarkdown -Text $matches[1] -CurrentInputDir $inputDir -CurrentOutputDir $outputDir
            $html.Add("<li>$inline</li>")
            continue
        }

        if ([string]::IsNullOrWhiteSpace($line)) {
            if ($inList) {
                $html.Add("</ul>")
                $inList = $false
            }
            continue
        }

        if ($inList) {
            $html.Add("</ul>")
            $inList = $false
        }

        $inline = Convert-InlineMarkdown -Text $line -CurrentInputDir $inputDir -CurrentOutputDir $outputDir
        $html.Add("<p>$inline</p>")
    }

    if ($inList) {
        $html.Add("</ul>")
    }

    $relativeOutput = (Get-RelativePathCompat -FromPath (Resolve-Path -LiteralPath $OutputRoot).Path -ToPath $OutputPath).Replace('\', '/')
    $depth = ($relativeOutput.Split('/').Count - 1)
    $assetPrefix = if ($depth -eq 0) { "." } else { (("../" * $depth).TrimEnd('/')) }
    $homeHref = if ($depth -eq 0) { "index.html" } else { (("../" * $depth) + "index.html").Replace('\', '/') }

    $tocHtml = ""
    if ($toc.Count -gt 1) {
        $tocItems = $toc | Where-Object { $_.Level -gt 1 } | ForEach-Object {
            $indentClass = "toc-level-$($_.Level)"
            $safeText = ConvertTo-HtmlText $_.Text
            "<a class=""$indentClass"" href=""#$($_.Id)"">$safeText</a>"
        }
        $tocHtml = ($tocItems -join "`n")
    }

    $article = $html -join "`n"
    $safeTitle = ConvertTo-HtmlText $title
    $generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm")

    $page = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$safeTitle | $SiteTitle</title>
  <link rel="stylesheet" href="$assetPrefix/assets/wiki.css">
</head>
<body>
  <div class="site-shell">
    <aside class="sidebar">
      <a class="brand" href="$homeHref">$SiteTitle</a>
      <nav>
        <a href="$assetPrefix/sessions/index.html">Sessions</a>
        <a href="$assetPrefix/people/index.html">People</a>
        <a href="$assetPrefix/places/index.html">Places</a>
        <a href="$assetPrefix/factions/index.html">Factions</a>
        <a href="$assetPrefix/concepts/index.html">Concepts</a>
        <a href="$assetPrefix/items/index.html">Items</a>
      </nav>
      <div class="toc">
        <div class="toc-title">On This Page</div>
        $tocHtml
      </div>
    </aside>
    <main class="content">
      <article class="article">
        $article
      </article>
      <footer>
        Generated from Markdown on $generatedAt.
      </footer>
    </main>
  </div>
</body>
</html>
"@

    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    Set-Content -LiteralPath $OutputPath -Value $page -Encoding UTF8
}

$wikiResolved = (Resolve-Path -LiteralPath $WikiRoot).Path
if (Test-Path -LiteralPath $OutputRoot) {
    Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutputRoot "assets") -Force | Out-Null

$sourceAssets = Join-Path $WikiRoot "assets"
if (Test-Path -LiteralPath $sourceAssets) {
    Get-ChildItem -LiteralPath $sourceAssets | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $OutputRoot "assets") -Recurse -Force
    }
}

$css = @"
:root {
  --bg: #f7f0df;
  --paper: #fffaf0;
  --ink: #1f241f;
  --muted: #6b6253;
  --line: #dacaa9;
  --accent: #8b2f1d;
  --accent-2: #1f5d57;
  --shadow: rgba(76, 50, 24, 0.16);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  color: var(--ink);
  background:
    radial-gradient(circle at top left, rgba(139, 47, 29, 0.16), transparent 28rem),
    radial-gradient(circle at bottom right, rgba(31, 93, 87, 0.15), transparent 30rem),
    var(--bg);
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.62;
}

.site-shell {
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  padding: 2rem 1.25rem;
  border-right: 1px solid var(--line);
  background: rgba(255, 250, 240, 0.76);
  backdrop-filter: blur(10px);
}

.brand {
  display: block;
  color: var(--accent);
  font-size: 1.35rem;
  font-weight: 700;
  text-decoration: none;
  margin-bottom: 1.5rem;
  letter-spacing: 0.02em;
}

nav {
  display: grid;
  gap: 0.4rem;
  margin-bottom: 2rem;
}

nav a,
.toc a {
  color: var(--accent-2);
  text-decoration: none;
  border-radius: 999px;
  padding: 0.35rem 0.65rem;
}

nav a {
  font-weight: 700;
  background: rgba(31, 93, 87, 0.08);
}

nav a:hover,
.toc a:hover,
.article a:hover {
  color: var(--accent);
  background: rgba(139, 47, 29, 0.08);
}

.toc-title {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.toc {
  display: grid;
  gap: 0.15rem;
  font-size: 0.94rem;
}

.toc a {
  display: block;
}

.toc-level-3 {
  margin-left: 0.75rem;
  font-size: 0.9rem;
}

.content {
  padding: 3rem clamp(1rem, 4vw, 5rem);
}

.article {
  max-width: 58rem;
  margin: 0 auto;
  padding: clamp(1.5rem, 4vw, 3.5rem);
  background: linear-gradient(180deg, rgba(255, 250, 240, 0.98), rgba(255, 246, 227, 0.96));
  border: 1px solid var(--line);
  border-radius: 1.4rem;
  box-shadow: 0 1.3rem 3rem var(--shadow);
}

h1,
h2,
h3,
h4,
h5,
h6 {
  line-height: 1.18;
  margin: 1.7em 0 0.55em;
}

h1 {
  margin-top: 0;
  color: var(--accent);
  font-size: clamp(2.2rem, 5vw, 4.2rem);
  letter-spacing: -0.045em;
}

h2 {
  color: var(--accent-2);
  border-bottom: 1px solid var(--line);
  padding-bottom: 0.25rem;
}

p,
ul {
  font-size: 1.05rem;
}

ul {
  padding-left: 1.25rem;
}

li + li {
  margin-top: 0.2rem;
}

a {
  color: var(--accent-2);
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.16em;
}

code {
  font-family: "Cascadia Mono", Consolas, monospace;
  font-size: 0.92em;
  background: rgba(31, 93, 87, 0.1);
  border: 1px solid rgba(31, 93, 87, 0.16);
  border-radius: 0.35rem;
  padding: 0.08rem 0.25rem;
}

.article img {
  display: block;
  width: 100%;
  height: auto;
  margin: 1rem auto 1.25rem;
  border: 1px solid var(--line);
  border-radius: 0.8rem;
  box-shadow: 0 0.8rem 2rem var(--shadow);
}

footer {
  max-width: 58rem;
  margin: 1.25rem auto 0;
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
}

@media (max-width: 820px) {
  .site-shell {
    display: block;
  }

  .sidebar {
    position: static;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toc {
    display: none;
  }

  .content {
    padding: 1rem;
  }

  .article {
    border-radius: 1rem;
  }
}
"@
Set-Content -LiteralPath (Join-Path $OutputRoot "assets\wiki.css") -Value $css -Encoding UTF8

$mdFiles = Get-ChildItem -LiteralPath $WikiRoot -Recurse -Filter *.md
foreach ($file in $mdFiles) {
    $relative = Get-RelativePathCompat -FromPath $wikiResolved -ToPath $file.FullName
    $outputRelative = [System.IO.Path]::ChangeExtension($relative, ".html")
    $outputPath = Join-Path $OutputRoot $outputRelative
    Convert-MarkdownFile -InputPath $file.FullName -OutputPath $outputPath
}

$indexPath = Join-Path $OutputRoot "index.html"
Write-Host "Built $($mdFiles.Count) pages."
Write-Host "Open in browser: $indexPath"
