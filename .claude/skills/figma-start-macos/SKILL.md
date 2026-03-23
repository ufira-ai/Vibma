---
name: figma-start-macos
description: Start a Figma design session on macOS — opens Figma, launches the Vibma plugin, and connects via MCP. Uses osascript/AppleScript. Handles common failure modes. Use when starting work or when the connection drops.
allowed-tools: Bash, mcp__vibma__connection
argument-hint: "[new|reconnect]"
---

Start or restore a Figma + Vibma MCP session. Adapt to whichever state things are in.

## Arguments

- No args or `new` — full startup: open Figma, new file, launch plugin, connect
- `reconnect` — skip Figma/plugin launch, just re-establish the MCP connection

## Phase 1: Assess current state

Before doing anything, check what's already running:

```bash
# Is Figma running?
pgrep -x Figma >/dev/null 2>&1 && echo "FIGMA_RUNNING" || echo "FIGMA_NOT_RUNNING"
```

Also try `connection(method: "get")` — if it succeeds, the full stack is already up. Report the document name and skip everything.

## Phase 2: Launch Figma (if needed)

Only if Figma is not running:

```bash
open -a "Figma"
sleep 3
```

If Figma IS running but connection failed, the issue is likely the plugin — skip to Phase 3.

## Phase 3: Create new file (if `new` or no args)

Skip this phase for `reconnect`.

```bash
osascript -e '
tell application "Figma" to activate
delay 1
tell application "System Events"
    tell process "Figma"
        keystroke "n" using command down
    end tell
end tell
'
```

Wait 5 seconds for the file to load. The new file editor takes time.

### Possible issues
- **Accessibility not granted**: osascript will error with "not allowed assistive access". This is a hard block — tell the user: _"System Settings → Privacy & Security → Accessibility → enable your terminal app."_
- **Figma auth expired / login screen**: Cmd+N won't work — Figma is showing a browser login or in-app auth wall. This is a hard block. Tell the user: _"Figma is showing a login screen. Please sign in manually, then run `/figma-start reconnect`."_ Do NOT attempt to automate login — it involves browser redirects and 2FA.
- **Figma shows a modal/dialog**: Cmd+N may not work. Tell the user to dismiss it manually, then retry.

## Phase 4: Launch Vibma plugin

```bash
osascript -e '
tell application "Figma" to activate
delay 0.5
tell application "System Events"
    tell process "Figma"
        keystroke "/" using command down
        delay 0.8
        keystroke "Vibma"
        delay 1.5
        keystroke return
    end tell
end tell
'
```

Wait 4 seconds for the plugin to initialize and connect to the relay.

### Possible issues
- **Quick actions didn't find Vibma**: The plugin may not be installed. Tell the user: _"Install Vibma from the Figma Community or run it locally via the manifest."_
- **Plugin opened but wrong item selected**: If connection fails later, this is a likely cause. Ask the user to open the plugin manually (Plugins → Vibma) and retry with `/figma-start reconnect`.

## Phase 5: Connect MCP

1. Call `connection(method: "create")` to join the channel.
2. Call `connection(method: "get")` to verify end-to-end connectivity.

### Retry logic for `get`

If `get` times out, retry up to 3 times with 3-second waits between attempts. The plugin may still be initializing.

### Diagnosing failures

If all retries fail, diagnose based on the error:

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| `get` times out every time | Plugin not running or wrong channel/port | Ask user to check the Figma plugin panel — it shows the channel name and port. They must match what MCP is using. |
| `create` fails with "Not connected to relay" | Tunnel server not running | Tell user to run `npm run socket` in another terminal, then retry with `/figma-start reconnect`. |
| `create` fails with "ROLE_OCCUPIED" | Another MCP instance is already connected | Call `connection(method: "delete")` to reset the channel, then retry `create` + `get`. |
| Version mismatch warning | Plugin and MCP server versions differ | Not a hard block — report the warning and continue. Tell user to update whichever side is older. |

## Phase 6: Confirm

Once `get` succeeds, report:
- Document name
- Current page
- Any warnings (version mismatch, etc.)

The session is ready.
