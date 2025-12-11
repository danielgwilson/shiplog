# Session Handoff

> Capture current session state so the next session can pick up seamlessly.

**Last Updated:** 2025-12-11
**Status:** v1.2.0 ready for publish

---

## What Was Done This Session

### Added `shiplog autopilot` command
New command that runs Claude Code in an autonomous loop with learning between sessions. Inspired by the ACE (Agentic Context Engine) framework.

**How it works:**
1. Run Claude with current sprint task + accumulated learnings
2. When Claude exits, extract learnings from the session
3. Inject learnings into next session's prompt
4. Repeat until stall (no commits) or sprint complete

**Features:**
- Session telemetry logging to `.shiplog/sessions/`
- Skillbook lite (`docs/SKILLBOOK.md`) - learnings persist across sessions
- Stall detection (stops after N iterations with no commits)
- Auto-continue prompt generation with sprint context
- `--dry-run` mode for testing

**Usage:**
```bash
shiplog autopilot              # Run with defaults (20 iterations, 3 stall threshold)
shiplog autopilot --dry-run    # Preview without running
shiplog autopilot -n 10 -s 2   # 10 iterations max, 2 stall threshold
```

**Files changed:**
- `src/commands/autopilot.ts` (new - 350 lines)
- `src/index.ts` (register command)
- `src/__tests__/e2e.test.ts` (9 new tests, 42 total)
- `package.json` (version bump to 1.2.0)
- `docs/DECISIONS.md` (design decision logged)
- `docs/sprints/2025-12-11-autopilot.json` (sprint file)

---

## Current State

- **Version:** 1.2.0
- **Git:** Uncommitted changes ready for commit
- **Tests:** 42 passing
- **CI:** Should pass

---

## What's Next

1. Commit and push changes
2. Publish v1.2.0 to npm
3. Update README with autopilot documentation
4. Test autopilot in real usage
5. Iterate based on feedback

---

## Open Questions for Human

1. Ready to publish v1.2.0?
2. Should we test autopilot on a real sprint before publishing?

---

## Key Links

- npm: https://www.npmjs.com/package/shiplog
- GitHub: https://github.com/danielgwilson/shiplog
- ACE Inspiration: https://github.com/kayba-ai/agentic-context-engine
