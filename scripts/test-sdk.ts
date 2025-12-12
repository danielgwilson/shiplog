/**
 * Minimal test script for Agent SDK V1 query() API
 * Run with: npx tsx scripts/test-sdk.ts
 */

import { query, type Options } from "@anthropic-ai/claude-agent-sdk";

async function testSDK() {
  console.log("🧪 Testing Agent SDK...\n");

  const options: Options = {
    model: "claude-sonnet-4-5-20250929",
    maxTurns: 1,
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: "\nThis is a test - just respond with 'SDK working!' and stop.",
    },
    permissionMode: "acceptEdits",
  };

  const prompt = "Say 'SDK working!' and then stop.";

  console.log(`📤 Sending prompt: "${prompt}"\n`);

  let sessionId: string | null = null;
  let responseText = "";

  try {
    for await (const msg of query({ prompt, options })) {
      // Extract session ID from init message
      if (msg.type === "system" && msg.subtype === "init") {
        sessionId = msg.session_id;
        console.log(`🔗 Session ID: ${sessionId}`);
        console.log(`📁 CWD: ${msg.cwd}`);
        console.log(`🤖 Model: ${msg.model}\n`);
      }

      // Handle assistant messages (streaming response)
      if (msg.type === "assistant") {
        const content = msg.message.content;
        for (const block of content) {
          if (block.type === "text") {
            responseText += block.text;
            process.stdout.write(block.text);
          }
        }
      }

      // Handle result (completion)
      if (msg.type === "result") {
        console.log(`\n\n📊 Result:`);
        console.log(`   Status: ${msg.subtype}`);
        if (msg.usage) {
          console.log(
            `   Tokens: ${msg.usage.input_tokens} in / ${msg.usage.output_tokens} out`
          );
        }
        if (msg.total_cost_usd !== undefined) {
          console.log(`   Cost: $${msg.total_cost_usd.toFixed(4)}`);
        }
        if (msg.subtype !== "success") {
          console.log(`   Errors: ${msg.errors?.join(", ")}`);
        }
      }

      // Show tool progress
      if (msg.type === "tool_progress") {
        console.log(`   [${msg.tool_name}] ${msg.elapsed_time_seconds}s...`);
      }
    }

    console.log("\n\n✅ SDK test completed successfully!");
  } catch (err) {
    console.error("\n❌ SDK test failed:", err);
    process.exit(1);
  }
}

testSDK();
