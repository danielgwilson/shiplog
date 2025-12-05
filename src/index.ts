#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";

const program = new Command();

program
  .name("shiplog")
  .description(
    "Infrastructure for long-running AI agents.\n\n" +
      "Track progress, decisions, and handoffs across sessions.\n" +
      "Based on Anthropic's research on effective harnesses for agents.\n\n" +
      "Commands: /status (health check), /ramp (continue), /plan (new initiative)\n\n" +
      "Learn more: https://github.com/danielgwilson/shiplog"
  )
  .version("1.0.0");

program.addCommand(initCommand);

program.parse();
