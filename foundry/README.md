# Foundry

Local Foundry **module** and **system** repos are mirrored into this monorepo with **git subtree** so upstream commit history is preserved.

| Source (local clone) | Prefix in FarkPG |
| --- | --- |
| `Data/modules/virtual-dice-table` | `foundry/modules/virtual-dice-table` |
| `Data/systems/farkpg-znz` | `foundry/system/farkpg-znz` |

Run from repo root:

```powershell
powershell -File foundry/sync-foundry-subtrees.ps1
```

Edit the paths, branch (`main`), remotes (`virtual-dice-table`, `farkpg-znz`), and prefixes at the bottom of `sync-foundry-subtrees.ps1` if yours differ.

The first `git subtree add` for each prefix needs a **clean** working tree. After that, `git subtree pull` may require conflict resolution.
