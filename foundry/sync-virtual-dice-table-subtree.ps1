# Hardcoded test: subtree from local virtual-dice-table clone into this repo.
# Run: powershell -File foundry/sync-virtual-dice-table-subtree.ps1
# First-time subtree add needs a clean working tree (commit or stash local edits).

$ErrorActionPreference = 'Stop'

$ModulePath = 'C:/Users/andre/AppData/Local/FoundryVTT/Data/modules/virtual-dice-table'
$Branch = 'main'
$Prefix = 'foundry/modules/virtual-dice-table'
$Remote = 'virtual-dice-table'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (git -C $here rev-parse --show-toplevel).Trim()
Set-Location -LiteralPath $root

$hasRemote = @((git remote 2>$null)) -contains $Remote
if ($hasRemote) {
  git remote set-url $Remote $ModulePath
} else {
  git remote add $Remote $ModulePath
}

git fetch $Remote $Branch
if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }

$tracked = @(git ls-tree -r --name-only HEAD -- $Prefix 2>$null)
if ($tracked.Count -gt 0) {
  git subtree pull --prefix=$Prefix $Remote $Branch
} else {
  git subtree add --prefix=$Prefix $Remote $Branch
}

if ($LASTEXITCODE -ne 0) { throw "git subtree failed" }
Write-Host Done.
