param(
    [switch]$Fix,
    [string]$WikiRootPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$wikiRoot = if ($WikiRootPath) {
    (Resolve-Path $WikiRootPath).Path
} else {
    (Resolve-Path (Join-Path $PSScriptRoot '..\wiki')).Path
}
$targetDirNames = @('campaign', 'concepts', 'factions', 'items', 'people', 'places')
$processFiles = Get-ChildItem $wikiRoot -Recurse -File -Filter *.md

function Get-TitleFromFile {
    param(
        [string]$Path
    )

    $content = [System.IO.File]::ReadAllText($Path)
    $match = [regex]::Match($content, '(?m)^#\s+(.+?)\s*$')
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }

    return [System.IO.Path]::GetFileNameWithoutExtension($Path)
}

function Get-Aliases {
    param(
        [string]$Title,
        [string]$BaseName
    )

    $aliases = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    $null = $aliases.Add($Title)

    if ($Title -like 'The *') {
        $null = $aliases.Add($Title.Substring(4))
    }

    foreach ($separator in @(' / ', ', ')) {
        if ($Title.Contains($separator)) {
            foreach ($part in ($Title -split [regex]::Escape($separator))) {
                $trimmed = $part.Trim()
                if ($trimmed.Length -ge 3) {
                    $null = $aliases.Add($trimmed)
                }
            }
        }
    }

    $humanizedBase = ($BaseName -replace '-', ' ')
    if ($humanizedBase.Length -ge 3) {
        $null = $aliases.Add($humanizedBase)
    }

    switch ($Title) {
        'War of the Gods / New Beginning Campaign' {
            $null = $aliases.Remove('War of the Gods')
            $null = $aliases.Add('New Beginning Campaign')
        }
        'Radiant Citadel' {
            $null = $aliases.Add('Citadel')
        }
        "Hell's Bane Heroes" {
            $null = $aliases.Add("Hell's Bane")
            $null = $aliases.Add("Hell's Bane heroes")
        }
        'Raven Queen of Saharun' {
            $null = $aliases.Add('The Raven Queen of Saharun')
        }
    }

    return @($aliases)
}

function Get-RelativeMarkdownPath {
    param(
        [string]$FromFile,
        [string]$ToFile
    )

    $fromDir = [System.IO.Path]::GetDirectoryName($FromFile)
    $fromUri = [System.Uri]::new(($fromDir.TrimEnd('\') + '\'))
    $toUri = [System.Uri]::new($ToFile)
    return $fromUri.MakeRelativeUri($toUri).ToString().Replace('%20', ' ')
}

function Protect-Segments {
    param(
        [string]$Text,
        [ref]$Store
    )

    $patterns = @(
        '!\[[^\]]*\]\([^)]+\)',
        '\[[^\]]+\]\([^)]+\)',
        '`[^`]+`'
    )

    foreach ($pattern in $patterns) {
        $Text = [regex]::Replace($Text, $pattern, {
            param($match)
            $token = "@@PROTECTED$($Store.Value.Count)@@"
            $Store.Value.Add($match.Value) | Out-Null
            return $token
        })
    }

    return $Text
}

function Restore-Segments {
    param(
        [string]$Text,
        [System.Collections.Generic.List[string]]$Store
    )

    for ($i = 0; $i -lt $Store.Count; $i++) {
        $Text = $Text.Replace("@@PROTECTED$i@@", $Store[$i])
    }

    return $Text
}

$targets = foreach ($file in $processFiles) {
    if ($targetDirNames -notcontains $file.Directory.Name) {
        continue
    }

    if ($file.Name -eq 'index.md') {
        continue
    }

    $title = Get-TitleFromFile -Path $file.FullName
    [pscustomobject]@{
        Path    = $file.FullName
        Title   = $title
        Aliases = Get-Aliases -Title $title -BaseName $file.BaseName
    }
}

$aliasToTarget = @{}
$ambiguousAliases = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)

foreach ($target in $targets) {
    foreach ($alias in $target.Aliases) {
        if ($alias.Length -lt 3) {
            continue
        }

        if ($ambiguousAliases.Contains($alias)) {
            continue
        }

        if ($aliasToTarget.ContainsKey($alias)) {
            if ($aliasToTarget[$alias].Path -ne $target.Path) {
                $aliasToTarget.Remove($alias)
                $null = $ambiguousAliases.Add($alias)
            }
            continue
        }

        $aliasToTarget[$alias] = $target
    }
}

$aliases = @($aliasToTarget.Keys | Sort-Object { $_.Length } -Descending)
$escapedAliases = $aliases | ForEach-Object { [regex]::Escape($_) }
$aliasPattern = '(?<![\p{L}\p{N}_/])(' + ($escapedAliases -join '|') + ')(?![\p{L}\p{N}_])'
$fileChangeCounts = @{}
$updatedFiles = [System.Collections.Generic.List[string]]::new()

foreach ($file in $processFiles) {
    $original = [System.IO.File]::ReadAllText($file.FullName)
    $newline = if ($original.Contains("`r`n")) { "`r`n" } else { "`n" }
    $segments = [regex]::Split($original, "(\r?\n)")
    $insideFence = $false
    $fileChangeCount = 0

    for ($i = 0; $i -lt $segments.Length; $i += 2) {
        $line = $segments[$i]

        if ($line -match '^\s*```') {
            $insideFence = -not $insideFence
            continue
        }

        if ($insideFence -or $line -match '^\s*#') {
            continue
        }

        $protected = [System.Collections.Generic.List[string]]::new()
        $working = Protect-Segments -Text $line -Store ([ref]$protected)

        $working = [regex]::Replace($working, $aliasPattern, {
            param($match)
            $alias = $match.Groups[1].Value
            $target = $aliasToTarget[$alias]
            if ($target.Path -eq $file.FullName) {
                return $match.Value
            }

            $script:fileChangeCount++
            $relativePath = Get-RelativeMarkdownPath -FromFile $file.FullName -ToFile $target.Path
            return "[$($match.Value)]($relativePath)"
        })

        $working = Restore-Segments -Text $working -Store $protected
        $segments[$i] = $working
    }

    if ($fileChangeCount -gt 0) {
        $fileChangeCounts[$file.FullName] = $fileChangeCount
        $updatedFiles.Add($file.FullName) | Out-Null

        if ($Fix) {
            $updated = ($segments -join '')
            if ($updated -ne $original) {
                [System.IO.File]::WriteAllText($file.FullName, $updated)
            }
        }
    }
}

$summary = $fileChangeCounts.GetEnumerator() |
    Sort-Object Value -Descending |
    Select-Object -First 50 |
    ForEach-Object { '{0} :: {1}' -f $_.Key, $_.Value }

if ($Fix) {
    Write-Output ("Updated {0} files." -f $updatedFiles.Count)
} else {
    Write-Output ("Would update {0} files." -f $updatedFiles.Count)
}

Write-Output ("Tracked aliases: {0}" -f $aliases.Count)
Write-Output ("Ambiguous aliases skipped: {0}" -f $ambiguousAliases.Count)

if (@($summary).Count -gt 0) {
    Write-Output 'Top files by inserted link count:'
    $summary
}

if ($ambiguousAliases.Count -gt 0) {
    Write-Output 'Ambiguous aliases skipped (first 20):'
    $ambiguousAliases | Sort-Object | Select-Object -First 20
}
