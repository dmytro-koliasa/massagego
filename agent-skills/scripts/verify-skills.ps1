#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$RepoRoot = '',
  [string]$TestDir = ''
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $RepoRoot) { $RepoRoot = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path }
$Failed = 0
$Disabled = @('next-bundle-optimizer', 'seo-audit')
$Canonical = @(
  'next-bundle-optimizer-hardened',
  'seo-audit-hardened',
  'massagego-i18n-best-practices'
)

function Ok([string]$m) { Write-Host "PASS  $m" -ForegroundColor Green }
function Bad([string]$m) { Write-Host "FAIL  $m" -ForegroundColor Red; $script:Failed++ }

if ($TestDir) {
  $roots = @(
    (Join-Path $TestDir 'agents-skills'),
    (Join-Path $TestDir 'cursor-skills'),
    (Join-Path $TestDir 'claude-skills')
  )
} else {
  $roots = @(
    (Join-Path $RepoRoot '.agents\skills'),
    (Join-Path $RepoRoot '.cursor\skills'),
    (Join-Path $RepoRoot '.claude\skills')
  )
}

foreach ($name in $Canonical) {
  $canon = Join-Path $RepoRoot "agent-skills\$name\SKILL.md"
  if (Test-Path $canon) { Ok "canonical $name" } else { Bad "missing canonical $name" }
}

foreach ($root in $roots) {
  foreach ($name in $Canonical) {
    $skill = Join-Path $root "$name\SKILL.md"
    if (Test-Path $skill) { Ok "discoverable $root\$name" } else { Bad "missing $root\$name" }
  }
  foreach ($name in $Disabled) {
    $path = Join-Path $root $name
    if (Test-Path $path) { Bad "disabled skill still present: $path" } else { Ok "disabled absent: $name in $root" }
  }
}

# Frontmatter name matches folder
foreach ($name in $Canonical) {
  $skillPath = Join-Path $RepoRoot "agent-skills\$name\SKILL.md"
  $head = ((Get-Content $skillPath -TotalCount 30) -join "`n")
  if ($head -match "(?m)^name:\s*$([regex]::Escape($name))\s*$") { Ok "frontmatter name $name" } else { Bad "frontmatter name mismatch $name" }
}

# Lockfile must not re-enable disabled without flag (soft check)
$lock = Join-Path $RepoRoot 'skills-lock.json'
if (Test-Path $lock) {
  $json = Get-Content $lock -Raw | ConvertFrom-Json
  foreach ($name in $Disabled) {
    if ($null -ne $json.skills.$name -and $json.skills.$name.disabled -ne $true) {
      Bad "skills-lock.json still enables $name (set disabled:true or remove)"
    } else {
      Ok "lockfile ok for $name"
    }
  }
  if ($json.metadata.skillsCliVersion -eq '1.9.0' -or $json.skillsCliVersion -eq '1.9.0') {
    Ok 'skills CLI pin 1.9.0 present'
  } elseif ($json.PSObject.Properties.Name -contains 'skillsCliVersion' -or ($json.metadata -and $json.metadata.skillsCliVersion)) {
    Bad 'skills CLI pin missing or unexpected'
  } else {
    Bad 'skills-lock.json missing skillsCliVersion pin'
  }
} else {
  Bad 'skills-lock.json missing'
}

if ($Failed -gt 0) {
  Write-Host "`n$Failed check(s) failed." -ForegroundColor Red
  exit 1
}
Write-Host "`nAll checks passed." -ForegroundColor Green
exit 0
