import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

interface SessionLog {
  iteration: number;
  startTime: string;
  endTime?: string;
  commits: number;
  exitCode?: number;
  timedOut?: boolean;
  status: "running" | "completed" | "stalled" | "error" | "timeout";
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationSeconds?: number;
}

interface AutopilotState {
  initiative: string;
  started: string;
  iterations: number;
  totalCommits: number;
  stallCount: number;
  sessions: SessionLog[];
  totalCostUsd?: number;
  totalDurationSeconds?: number;
  status: "running" | "completed" | "stalled" | "interrupted";
}

interface SprintMemoryEntry {
  iteration: number;
  timestamp: string;
  feature: string;
  approach: string;
  result: "success" | "partial" | "failure";
  commits: number;
  learnings: string[];
  failures: string[];
  critique?: string;
}

interface SprintMemory {
  initiative: string;
  sprintFile: string;
  started: string;
  entries: SprintMemoryEntry[];
}

interface AnalysisResult {
  stats: {
    totalSessions: number;
    totalCommits: number;
    totalCost: number;
    totalDuration: number;
    successRate: number;
    avgCommitsPerSession: number;
    avgCostPerSession: number;
  };
  patterns: {
    commonFailures: string[];
    successfulApproaches: string[];
    repeatedIssues: string[];
  };
  suggestedRules: string[];
}

function loadAutopilotState(cwd: string): AutopilotState | null {
  const statePath = path.join(cwd, ".shiplog/autopilot-state.json");
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf-8"));
  } catch {
    return null;
  }
}

function loadSprintMemory(cwd: string): SprintMemory | null {
  const memoryPath = path.join(cwd, ".shiplog/sprint-memory.json");
  if (!fs.existsSync(memoryPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(memoryPath, "utf-8"));
  } catch {
    return null;
  }
}

function loadAllSprintMemories(cwd: string): SprintMemory[] {
  const shiplogDir = path.join(cwd, ".shiplog");
  if (!fs.existsSync(shiplogDir)) return [];

  const memories: SprintMemory[] = [];
  const files = fs.readdirSync(shiplogDir).filter(f => f.includes("sprint-memory"));

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(shiplogDir, file), "utf-8");
      memories.push(JSON.parse(content));
    } catch {
      continue;
    }
  }

  return memories;
}

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins}m ${secs}s`;
}

function analyzePatterns(memories: SprintMemory[]): AnalysisResult["patterns"] {
  const failureCount: Record<string, number> = {};
  const successApproaches: string[] = [];
  const allFailures: string[] = [];

  for (const memory of memories) {
    for (const entry of memory.entries) {
      // Track failures
      for (const failure of entry.failures) {
        allFailures.push(failure);
        // Normalize failure messages for counting
        const normalized = failure.toLowerCase()
          .replace(/session \d+/g, "session N")
          .replace(/iteration \d+/g, "iteration N");
        failureCount[normalized] = (failureCount[normalized] || 0) + 1;
      }

      // Track successful approaches
      if (entry.result === "success" && entry.commits > 0) {
        successApproaches.push(entry.approach);
      }
    }
  }

  // Find repeated failures (appeared 2+ times)
  const repeatedIssues = Object.entries(failureCount)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue, count]) => `${issue} (${count}x)`);

  // Get unique common failures
  const commonFailures = [...new Set(allFailures)].slice(0, 10);

  return {
    commonFailures,
    successfulApproaches: successApproaches.slice(0, 10),
    repeatedIssues,
  };
}

function generateSuggestedRules(patterns: AnalysisResult["patterns"]): string[] {
  const rules: string[] = [];

  // Analyze failure patterns and suggest rules
  for (const failure of patterns.commonFailures) {
    const lower = failure.toLowerCase();

    if (lower.includes("test") && lower.includes("fail")) {
      rules.push("Always run tests before marking a feature complete");
    }
    if (lower.includes("type") && (lower.includes("error") || lower.includes("fail"))) {
      rules.push("Run type checking (tsc) after making changes");
    }
    if (lower.includes("lint")) {
      rules.push("Run linter before committing");
    }
    if (lower.includes("no progress") || lower.includes("made no progress")) {
      rules.push("If stuck on a feature, try a different approach rather than repeating the same one");
    }
    if (lower.includes("revert") || lower.includes("undo")) {
      rules.push("Make small, incremental changes that are easy to verify");
    }
    if (lower.includes("mock") || lower.includes("stub")) {
      rules.push("Prefer real implementations over mocks when possible");
    }
  }

  // Analyze repeated issues for stronger rules
  for (const issue of patterns.repeatedIssues) {
    if (issue.includes("no progress")) {
      rules.push("IMPORTANT: If an approach fails twice, try something fundamentally different");
    }
  }

  // Deduplicate
  return [...new Set(rules)];
}

function analyze(cwd: string): AnalysisResult | null {
  const state = loadAutopilotState(cwd);
  const memories = loadAllSprintMemories(cwd);

  if (!state && memories.length === 0) {
    return null;
  }

  // Calculate stats
  const sessions = state?.sessions || [];
  const totalSessions = sessions.length;
  const totalCommits = state?.totalCommits || 0;
  const totalCost = state?.totalCostUsd || sessions.reduce((sum, s) => sum + (s.costUsd || 0), 0);
  const totalDuration = state?.totalDurationSeconds || sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

  const successfulSessions = sessions.filter(s => s.commits > 0).length;
  const successRate = totalSessions > 0 ? (successfulSessions / totalSessions) * 100 : 0;

  const stats = {
    totalSessions,
    totalCommits,
    totalCost,
    totalDuration,
    successRate: Math.round(successRate),
    avgCommitsPerSession: totalSessions > 0 ? Math.round((totalCommits / totalSessions) * 10) / 10 : 0,
    avgCostPerSession: totalSessions > 0 ? Math.round((totalCost / totalSessions) * 10000) / 10000 : 0,
  };

  const patterns = analyzePatterns(memories);
  const suggestedRules = generateSuggestedRules(patterns);

  return { stats, patterns, suggestedRules };
}

export const analyzeCommand = new Command("analyze")
    .description("Analyze session history and suggest improvements")
    .option("--json", "Output as JSON")
    .option("--rules-only", "Only show suggested CLAUDE.md rules")
    .action((options) => {
      const cwd = process.cwd();
      const result = analyze(cwd);

      if (!result) {
        console.log("\n📊 No autopilot history found.\n");
        console.log("   Run 'shiplog autopilot' first to generate data.\n");
        process.exit(0);
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (options.rulesOnly) {
        if (result.suggestedRules.length === 0) {
          console.log("\n✅ No rule suggestions - everything looks good!\n");
        } else {
          console.log("\n# Suggested CLAUDE.md Rules\n");
          for (const rule of result.suggestedRules) {
            console.log(`- ${rule}`);
          }
          console.log("");
        }
        return;
      }

      // Full analysis output
      console.log("\n" + "=".repeat(60));
      console.log("  📊 Shiplog Session Analysis");
      console.log("=".repeat(60));

      console.log("\n## Stats\n");
      console.log(`   Sessions:     ${result.stats.totalSessions}`);
      console.log(`   Total commits: ${result.stats.totalCommits}`);
      console.log(`   Success rate: ${result.stats.successRate}%`);
      console.log(`   Total cost:   $${result.stats.totalCost.toFixed(4)}`);
      console.log(`   Total time:   ${formatDuration(result.stats.totalDuration)}`);
      console.log(`   Avg commits/session: ${result.stats.avgCommitsPerSession}`);
      console.log(`   Avg cost/session: $${result.stats.avgCostPerSession.toFixed(4)}`);

      if (result.patterns.repeatedIssues.length > 0) {
        console.log("\n## Repeated Issues (patterns to address)\n");
        for (const issue of result.patterns.repeatedIssues) {
          console.log(`   ⚠️  ${issue}`);
        }
      }

      if (result.patterns.successfulApproaches.length > 0) {
        console.log("\n## Successful Approaches\n");
        for (const approach of result.patterns.successfulApproaches.slice(0, 5)) {
          console.log(`   ✅ ${approach.slice(0, 80)}${approach.length > 80 ? "..." : ""}`);
        }
      }

      if (result.suggestedRules.length > 0) {
        console.log("\n## Suggested CLAUDE.md Rules\n");
        console.log("   Add these to your CLAUDE.md to improve future sessions:\n");
        for (const rule of result.suggestedRules) {
          console.log(`   - ${rule}`);
        }
      } else {
        console.log("\n## Suggested Rules\n");
        console.log("   ✅ No issues detected - your setup looks good!");
      }

      console.log("\n" + "=".repeat(60) + "\n");
    });
