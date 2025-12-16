#!/bin/bash
# Shiplog Autonomy Stop Hook
# Blocks Claude from stopping unless escape phrase is detected or max iterations reached.
# This hook is dormant unless .shiplog/autonomy-active exists.

set +e  # Don't exit on error - we need to handle gracefully

ACTIVATION_FILE=".shiplog/autonomy-active"

# Not in autonomy mode? Pass through silently
if [ ! -f "$ACTIVATION_FILE" ]; then
  exit 0
fi

# Read activation state
if ! STATE=$(cat "$ACTIVATION_FILE" 2>/dev/null); then
  # Can't read file - allow stop
  exit 0
fi

# Parse activation state (with defaults if jq unavailable or fields missing)
if command -v jq &> /dev/null; then
  ITERATION=$(echo "$STATE" | jq -r '.iteration // 0')
  MAX_ITER=$(echo "$STATE" | jq -r '.maxIterations // 20')
else
  # Fallback: simple grep for iteration count
  ITERATION=$(echo "$STATE" | grep -o '"iteration":[0-9]*' | grep -o '[0-9]*' || echo "0")
  MAX_ITER=$(echo "$STATE" | grep -o '"maxIterations":[0-9]*' | grep -o '[0-9]*' || echo "20")
fi

# Read stdin - this is JSON metadata with transcript_path, NOT Claude's output
HOOK_INPUT=$(cat)

# Extract transcript_path from hook input
if command -v jq &> /dev/null; then
  TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // ""')
else
  # Fallback: grep for transcript_path
  TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | grep -o '"transcript_path":"[^"]*"' | cut -d'"' -f4 || echo "")
fi

# Check for escape phrases in Claude's ASSISTANT messages only (not tool results/file contents)
# This prevents false positives when Claude reads files containing the escape phrase
FOUND_ESCAPE=false
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ] && command -v jq &> /dev/null; then
  # Use jq to extract only assistant text content from last 10 transcript entries
  # Filter: type=="assistant" -> .message.content[] -> select type=="text" -> .text
  ASSISTANT_TEXT=$(tail -10 "$TRANSCRIPT_PATH" 2>/dev/null | \
    jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text' 2>/dev/null)

  if echo "$ASSISTANT_TEXT" | grep -qE "SHIPLOG_DONE|SHIPLOG_NEED_USER"; then
    FOUND_ESCAPE=true
  fi
elif [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  # Fallback without jq: look for escape phrase as standalone (more conservative)
  # Only match if it appears to be Claude saying it (not in a code block or file content)
  # This is imperfect but better than matching everything
  if tail -20 "$TRANSCRIPT_PATH" 2>/dev/null | grep -E '"text":\s*"[^"]*SHIPLOG_(DONE|NEED_USER)' | grep -qv 'function_calls\|<result>'; then
    FOUND_ESCAPE=true
  fi
fi

if [ "$FOUND_ESCAPE" = true ]; then
  # Escape phrase detected - allow stop
  exit 0
fi

# Check max iterations (safety valve)
if [ "$ITERATION" -ge "$MAX_ITER" ]; then
  echo "Autonomy: Max iterations reached ($MAX_ITER). Stopping."
  exit 0
fi

# Increment iteration counter
NEW_ITER=$((ITERATION + 1))
if command -v jq &> /dev/null; then
  echo "$STATE" | jq ".iteration = $NEW_ITER" > "$ACTIVATION_FILE"
else
  # Fallback: sed replacement
  sed -i.bak "s/\"iteration\":[0-9]*/\"iteration\":$NEW_ITER/" "$ACTIVATION_FILE" 2>/dev/null || true
fi

# Block stop - tell Claude to keep going
# Output JSON that Claude Code understands
cat << 'EOF'
{"decision": "block", "reason": "Keep working! You're in autonomy mode. Say SHIPLOG_DONE when the task is complete, or SHIPLOG_NEED_USER if you need human input."}
EOF
