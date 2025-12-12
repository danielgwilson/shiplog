import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

interface SprintFeature {
  id: string;
  description: string;
  deliverable: string;
  passes: boolean;
  [key: string]: unknown;
}

interface SprintFile {
  initiative: string;
  created: string;
  status: string;
  context?: Record<string, unknown>;
  features: SprintFeature[];
  [key: string]: unknown;
}

interface ResetOptions {
  hard: boolean;
  sprint?: string;
}

export const resetCommand = new Command("reset")
  .description(
    "Reset a sprint to start fresh.\n\n" +
      "Resets the sprint status to 'in_progress' and marks all features as incomplete.\n" +
      "Use --hard to also clear sprint memory (iteration history).\n\n" +
      "Examples:\n" +
      "  $ shiplog reset                    # Reset the active/most recent sprint\n" +
      "  $ shiplog reset --hard             # Reset sprint AND clear memory\n" +
      "  $ shiplog reset --sprint my-sprint # Reset a specific sprint file"
  )
  .option("--hard", "Also clear sprint memory (.shiplog/sprint-memory.json)", false)
  .option("-s, --sprint <name>", "Specific sprint file to reset (without .json extension)")
  .action(async (options: ResetOptions) => {
    const cwd = process.cwd();
    const sprintsDir = path.join(cwd, "docs/sprints");
    const shiplogDir = path.join(cwd, ".shiplog");

    // Check if sprints directory exists
    if (!fs.existsSync(sprintsDir)) {
      console.error("❌ No docs/sprints/ directory found.");
      console.error("   Run 'shiplog init' first or navigate to a shiplog project.");
      process.exit(1);
    }

    // Find sprint file to reset
    let sprintPath: string;

    if (options.sprint) {
      // User specified a sprint
      sprintPath = path.join(sprintsDir, `${options.sprint}.json`);
      if (!fs.existsSync(sprintPath)) {
        // Try with full filename
        sprintPath = path.join(sprintsDir, options.sprint);
        if (!fs.existsSync(sprintPath)) {
          console.error(`❌ Sprint file not found: ${options.sprint}`);
          console.error(`   Available sprints:`);
          listSprints(sprintsDir);
          process.exit(1);
        }
      }
    } else {
      // Find most recent sprint (by file modification time)
      const sprintFiles = fs.readdirSync(sprintsDir)
        .filter(f => f.endsWith(".json"))
        .map(f => ({
          name: f,
          path: path.join(sprintsDir, f),
          mtime: fs.statSync(path.join(sprintsDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (sprintFiles.length === 0) {
        console.error("❌ No sprint files found in docs/sprints/");
        console.error("   Create a sprint file first.");
        process.exit(1);
      }

      sprintPath = sprintFiles[0].path;
    }

    // Read and parse sprint file
    let sprint: SprintFile;
    try {
      const content = fs.readFileSync(sprintPath, "utf-8");
      sprint = JSON.parse(content);
    } catch (error) {
      console.error(`❌ Failed to parse sprint file: ${sprintPath}`);
      console.error(`   ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }

    const sprintName = path.basename(sprintPath, ".json");
    console.log(`\n🔄 Resetting sprint: ${sprint.initiative}`);
    console.log(`   File: ${sprintName}.json\n`);

    // Track what we're resetting
    const previousStatus = sprint.status;
    const featuresReset = sprint.features.filter(f => f.passes === true).length;

    // Reset sprint
    sprint.status = "in_progress";
    for (const feature of sprint.features) {
      feature.passes = false;
    }

    // Write back
    fs.writeFileSync(sprintPath, JSON.stringify(sprint, null, 2) + "\n");

    console.log(`   ✅ Status: ${previousStatus} → in_progress`);
    console.log(`   ✅ Features reset: ${featuresReset}/${sprint.features.length}`);

    // Handle --hard: clear sprint memory
    if (options.hard) {
      const memoryPath = path.join(shiplogDir, "sprint-memory.json");
      if (fs.existsSync(memoryPath)) {
        fs.unlinkSync(memoryPath);
        console.log(`   ✅ Cleared sprint memory`);
      } else {
        console.log(`   ℹ️  No sprint memory to clear`);
      }

      // Also clear skillbook entries for this sprint? Maybe too aggressive.
      // Let's leave skillbook alone - those learnings are valuable.
    }

    console.log(`\n🚀 Sprint ready to run!`);
    console.log(`   Run: shiplog autopilot\n`);
  });

function listSprints(sprintsDir: string): void {
  const files = fs.readdirSync(sprintsDir).filter(f => f.endsWith(".json"));
  for (const file of files) {
    console.log(`     - ${file.replace(".json", "")}`);
  }
}
