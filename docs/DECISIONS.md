# Decision Log

> Document significant decisions with reasoning, so future sessions understand *why* things were done.

---

## 2025-12-11: Autopilot Mode (Inspired by ACE Framework)

**Decision:** Implement an outer orchestration loop that enables truly autonomous agent sessions.

**Research Source:**
- Reddit: r/ClaudeAI post about running Claude Code in self-learning loop
- GitHub: kayba-ai/agentic-context-engine (ACE framework)

**Key Insight:** ACE doesn't run one infinite session. It runs **multiple sessions** with learning injected between them:
1. Run Claude Code until it exits (context exhausted or done)
2. Reflector analyzes what worked/failed
3. SkillManager updates a "skillbook" of strategies
4. Restart Claude Code with skillbook injected
5. Repeat until stall detected (no commits for N iterations)

**What We're Adopting:**
1. **Session telemetry** - Log what happened for human observability
2. **Skillbook lite** - Simple learnings file agents update
3. **Autopilot command** - Outer loop that restarts Claude with learnings

**Alternatives Considered:**
1. **Full ACE integration** — Too heavy, requires Python, external API calls
2. **Just better prompts** — Doesn't solve context exhaustion problem
3. **MCP server approach** — More complex, less portable

**Reasoning:** The lightest thing that could work. Node-native, builds on existing shiplog patterns, gives human full observability.

**Owner:** Claude

---

## 2025-12-10: Fix hook matcher format (must be string, not object)

**Decision:** Changed `"matcher": {}` to `"matcher": ""` in settings.local.json generation.

**Context:** Claude Code v2.0.64 validates that the `matcher` field in hooks must be a string. We were generating an empty object `{}` which caused validation errors:
```
matcher: Expected string, but received object
```

**The Bug:**
- Previous code: `"matcher": {}`
- Fixed code: `"matcher": ""`

**Why the test didn't catch it:**
The original test only checked `expect(settings.hooks.SessionStart[0].matcher).toBeDefined()` which passes for both `{}` and `""`. Fixed the test to check `typeof ... === 'string'`.

**Owner:** Claude

---

## 2025-12-07: Initialize Shiplog

**Decision:** Set up shiplog infrastructure for long-running sessions.

**Reasoning:**
Based on Anthropic's research on effective harnesses for long-running agents, we need:
- Progress tracking (PROGRESS.md)
- Decision logging (this file)
- Session handoffs (HANDOFF.md)
- Feature tracking (FEATURES.json)

This infrastructure enables consistent, incremental progress across context windows.

**Owner:** Claude

---

## Decision Template

```markdown
## YYYY-MM-DD: [Decision Title]

**Decision:** What was decided

**Alternatives Considered:**
1. [Option A] — Why not chosen
2. [Option B] — Why not chosen

**Reasoning:** Why this decision makes sense

**Owner:** Claude / Human / Both
```
