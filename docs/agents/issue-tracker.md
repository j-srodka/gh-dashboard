# Issue tracker: Beads (bd)

Issues and PRDs for this repo live as Beads — a local Dolt-backed issue tracker synced via git refs.

## Conventions

- **Find available work**: `bd ready`
- **View issue details**: `bd show <id>`
- **Create an issue**: `bd create "Title" --description="..." -p <priority> -t task`
- **Claim work**: `bd update <id> --claim`
- **Mark blocked**: `bd update <id> --set-state blocked --reason "..."`
- **Close**: `bd close <id> --reason "..."`
- **List all open**: `bd list --status=open`
- **Full workflow reference**: `bd prime`

## When a skill says "publish to the issue tracker"

Create a bead: `bd create "Title" --description="..."`

## When a skill says "fetch the relevant ticket"

Run `bd show <id>` and `bd list` with appropriate filters.

## Sync

Beads sync via `refs/dolt/data` on the git remote. Run `bd dolt push` after creating or modifying issues.
