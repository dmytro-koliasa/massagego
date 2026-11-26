#Requires -Version 5.1
<#
.SYNOPSIS
  Idempotent restore of MassageGo project agent skills into discovery paths.
.NOTES
  Manual only. Does not touch app build/CI. Never restores disabled unsafe originals.
#>
[CmdletBinding()]
param(
  [string]$RepoRoot = '',
  [string]$TestDir = '',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $RepoRoot) { $RepoRoot = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path }
$Disabled = @('next-bundle-optimizer', 'seo-audit')
$Canonical = @(
  'next-bundle-optimizer-hardened',
  'seo-audit-hardened',
  'massagego-i18n-best-practices'
)
$PinnedCli = '1.9.0'

function Write-Info([string]$Message) { Write-Host "[restore] $Message" }

function New-LinkOrCopy {
  param(
    [Parameter(Mandatory)][string]$Source,
    [Parameter(Mandatory)][string]$Destination
  )
  if ($DryRun) {
    Write-Info "DRYRUN link/copy $Source -> $Destination"
    return
  }
  $destParent = Split-Path -Parent $Destination
  if (-not (Test-Path $destParent)) {
    New-Item -ItemType Directory -Force -Path $destParent | Out-Null
  }
  if (Test-Path $Destination) {
    $item = Get-Item $Destination -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      cmd /c "rmdir `"$Destination`"" | Out-Null
    } else {
      Remove-Item -Recurse -Force $Destination
    }
  }
  try {
    New-Item -ItemType Junction -Path $Destination -Target $Source | Out-Null
  } catch {
    Write-Info "Junction failed, copying: $Destination"
    Copy-Item -Recurse -Force $Source $Destination
  }
}

function Assert-NotDisabled([string]$Name) {
  if ($Disabled -contains $Name) {
    throw "Refusing to restore disabled skill '$Name'. See agent-skills/_meta/DISABLED-SKILLS.md"
  }
}

Write-Info "RepoRoot=$RepoRoot"
Write-Info "Pinned Skills CLI=$PinnedCli (informational; this script does not npx-install skills)"

$agentSkills = Join-Path $RepoRoot 'agent-skills'
if (-not (Test-Path $agentSkills)) { throw "Missing $agentSkills" }

if ($TestDir) {
  $discoveryRoots = @(
    (Join-Path $TestDir 'agents-skills'),
    (Join-Path $TestDir 'cursor-skills'),
    (Join-Path $TestDir 'claude-skills')
  )
  Write-Info "Isolated TestDir=$TestDir"
} else {
  $discoveryRoots = @(
    (Join-Path $RepoRoot '.agents\skills'),
    (Join-Path $RepoRoot '.cursor\skills'),
    (Join-Path $RepoRoot '.claude\skills')
  )
}

foreach ($root in $discoveryRoots) {
  if (-not $DryRun -and -not (Test-Path $root)) {
    New-Item -ItemType Directory -Force -Path $root | Out-Null
  }
  Write-Info "Discovery root: $root"
}

# Remove disabled originals from discovery roots if present
foreach ($root in $discoveryRoots) {
  foreach ($name in $Disabled) {
    $path = Join-Path $root $name
    if (Test-Path $path) {
      Write-Info "Removing disabled skill from discovery: $path"
      if (-not $DryRun) {
        $item = Get-Item $path -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
          cmd /c "rmdir `"$path`"" | Out-Null
        } else {
          Remove-Item -Recurse -Force $path
        }
      }
    }
  }
}

# Install canonical hardened/custom skills into every discovery root
foreach ($name in $Canonical) {
  Assert-NotDisabled $name
  $source = Join-Path $agentSkills $name
  if (-not (Test-Path (Join-Path $source 'SKILL.md'))) {
    throw "Canonical skill missing SKILL.md: $source"
  }
  foreach ($root in $discoveryRoots) {
    $dest = Join-Path $root $name
    New-LinkOrCopy -Source $source -Destination $dest
  }
}

# Mirror other existing .agents skills into cursor/claude when not in test mode
if (-not $TestDir) {
  $agentsRoot = Join-Path $RepoRoot '.agents\skills'
  $mirrorTargets = @(
    (Join-Path $RepoRoot '.cursor\skills'),
    (Join-Path $RepoRoot '.claude\skills')
  )
  if (Test-Path $agentsRoot) {
    Get-ChildItem $agentsRoot -Directory | ForEach-Object {
      $name = $_.Name
      if ($Disabled -contains $name) { return }
      if ($Canonical -contains $name) { return }
      foreach ($targetRoot in $mirrorTargets) {
        $dest = Join-Path $targetRoot $name
        if ($DryRun) {
          Write-Info "DRYRUN mirror $($_.FullName) -> $dest"
        } else {
          New-LinkOrCopy -Source $_.FullName -Destination $dest
        }
      }
    }
  }
}

Write-Info "Done. Run verify-skills.ps1 next."
