# PI Skill Quickstart: Beads + Hindsight

PI now supports MCP via context-mode. The original CLI-based skill is still available as a fallback.

## Installation

The skill is already installed at:
```
~/.pi/agent/extensions/beads-hindsight/README.md
```

PI should discover it automatically if extensions are enabled.

## Usage

### Session Start

Paste this prompt into PI:
```
Before doing any work, run these commands and report the output:
1. hindsight memory recall jake-preferences "What are Jake coding preferences?"
2. hindsight memory recall gh-dashboard "What are recent project decisions?"
3. bd ready
If bd ready shows work, claim the relevant bead with bd update <id> --claim.
```

### Session End

Paste this prompt into PI:
```
Retain a session summary to Hindsight:
hindsight memory retain gh-dashboard "Session summary: <describe what was done, key decisions, pitfalls>"

Then update Beads — close completed work with bd close <id>.
Finally push code: git pull --rebase && git push
```

## Limitations

- The CLI-based approach below is a fallback. With context-mode installed, PI gains MCP tools and hook-based routing.
- Enforcement was entirely manual before context-mode. The context-mode extension now provides programmatic hooks.
- Consider creating a PI alias or wrapper script that prepends the session-start commands.

## Validation

Run the validation prompt from `docs/agent-memory-validation.md` and manually verify PI runs the CLI commands.
