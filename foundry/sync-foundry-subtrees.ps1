# Sync local Foundry module + system repos into this monorepo via git subtree.
# Run: powershell -File foundry/sync-foundry-subtrees.ps1
# First-time subtree add needs a clean working tree (commit or stash local edits).

$ErrorActionPreference = 'Stop'

function Sync-FoundrySubtree {
  param(
    [string]$LocalRepoPath,
    [string]$Branch,
    [string]$Prefix,
    [string]$Remote
  )

  $hasRemote = @((git remote 2>$null)) -contains $Remote
  if ($hasRemote) {
    git remote set-url $Remote $LocalRepoPath
  } else {
    git remote add $Remote $LocalRepoPath
  }

  git fetch $Remote $Branch
  if ($LASTEXITCODE -ne 0) { throw "git fetch failed for remote $Remote" }

  $tracked = @(git ls-tree -r --name-only HEAD -- $Prefix 2>$null)
  if ($tracked.Count -gt 0) {
    git subtree pull --prefix=$Prefix $Remote $Branch
  } else {
    git subtree add --prefix=$Prefix $Remote $Branch
  }

  if ($LASTEXITCODE -ne 0) { throw "git subtree failed for prefix $Prefix" }
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (git -C $here rev-parse --show-toplevel).Trim()
Set-Location -LiteralPath $root

# Module: virtual-dice-table
Sync-FoundrySubtree `
  -LocalRepoPath 'C:/Users/andre/AppData/Local/FoundryVTT/Data/modules/virtual-dice-table' `
  -Branch 'main' `
  -Prefix 'foundry/modules/virtual-dice-table' `
  -Remote 'virtual-dice-table'

# System: farkpg-znz → foundry/system/farkpg-znz
Sync-FoundrySubtree `
  -LocalRepoPath 'C:/Users/andre/AppData/Local/FoundryVTT/Data/systems/farkpg-znz' `
  -Branch 'main' `
  -Prefix 'foundry/system/farkpg-znz' `
  -Remote 'farkpg-znz'

Write-Host 'Foundry subtree sync finished.'
