---
name: vibma-dev
description: Development workflow for the Vibma Figma MCP plugin. Follow this when fixing bugs, adding features, or investigating issues. Enforces single-source-of-truth principle and structured fix-test-audit cycle.
user-invocable: false
---

# Vibma Plugin Development Guideline

## Principle: Single Source of Truth

Never duplicate logic. Every piece of behavior — param handling, validation, formatting, type definitions — should live in exactly one place. If you find the same logic in two places, generalize it into a shared function. If a schema defines it, don't hardcode it elsewhere.

This applies at every level:
- **Types and schemas** — derived from YAML via the compiler, never handwritten
- **Param lists** — read from generated defs, never duplicated in handlers
- **Validation** — one validator per concern, composed where needed
- **Response formatting** — one formatter per shape, shared across endpoints
- **Constants** — defined once, imported everywhere

When in doubt: if changing behavior requires editing more than one file, the abstraction is wrong.

## Workflow

**Before starting: create a task list from these workflow steps using TaskCreate.** Each step below becomes a task. Mark each as `in_progress` when you start it and `completed` when done. Do not skip steps — the task list enforces the order.

### 1. Reproduce the issue

Before touching code, confirm the bug exists. Use the MCP tools directly — `connection(method: "create")`, then exercise the failing endpoint. Capture the exact error message or unexpected behavior. If you can't reproduce it, clarify with the user before proceeding.

### 2. Find the corresponding code

Trace from the MCP tool call to the handler:
- **Schema/defs**: `schema/tools/*.yaml` → compiled to `packages/core/src/tools/generated/defs.ts`
- **MCP registration**: `packages/core/src/tools/mcp-registry.ts` → `registry.ts`
- **Command dispatch**: `commandMap` in generated defs → handler in `packages/adapter-figma/src/handlers/`
- **Shared utilities**: `packages/core/src/utils/`, `packages/adapter-figma/src/utils/`

Read the AGENTS.md files in each package before investigating — they document contracts and conventions.

### 3. Look for similar patterns

**Do not write new code until you have identified the closest existing pattern.** Name the file and pattern you are basing your implementation on before proceeding.

- Search for existing handlers that solve the same class of problem
- Check if a utility already exists for the operation
- If two handlers share similar logic, extract it into a shared function rather than copying
- For new endpoints: check how similar endpoints (e.g. `connection` for inline tools, `frames` for create-tier tools) are defined in YAML and registered

Reuse > generalize > write new. In that order.

### 4. Implement the fix

- Keep changes minimal and focused
- If the fix touches generated code, change the YAML source and re-run `npm run codegen`
- If the fix requires a new shared utility, place it in the appropriate `utils/` directory
- Never hardcode param lists, types, or schemas — derive from the compiler pipeline

### 5. Test directly with Vibma MCP

**Do not summarize your work to the user until you have tested all affected methods via MCP tools.**

After `npm run build`, use the `dev_reload` MCP tool to rebuild and restart the MCP server — no need to ask the user or restart Claude Code. Then reconnect: `connection(method: "create")` → `connection(method: "get")`.

- Call the fixed endpoint with the original failing input
- Call it with edge cases (empty arrays, missing optional params, large payloads)
- Test error paths (invalid input, missing required params)
- Call related endpoints to check for side effects
- Use `lint(method: "check")` or `frames(method: "audit")` on created nodes when relevant

### 6. Audit for regressions

- Review every changed file — does the change break any other caller?
- If a shared function was modified, grep for all call sites and verify compatibility
- If schema YAML was changed, check that the generated output is correct
- Run a quick smoke test on 2-3 unrelated endpoints to catch collateral damage

### 7. Verify help() accuracy

If the change touches params, return shapes, or method behavior, call `help(topic: "endpoint.method")` on the affected endpoints and verify the output matches reality:

- Param names, types, and defaults match what the handler actually accepts
- Return shape description matches what the handler actually returns
- Examples are valid and would succeed if called verbatim
- No stale references to removed or renamed params

If help text is wrong, fix the source YAML in `schema/tools/` and re-run `npm run codegen`. Never edit generated files directly.

### 8. Run the AGENTS.md tool checklist

Walk through every item in `AGENTS.md > Checklist: Adding/Modifying/Removing a Tool` and verify each applies or mark N/A with a reason.

### 9. Create PR

Write a detailed PR description that covers:
- **Root cause** — what was actually wrong, not just what the symptom was
- **Fix** — what was changed and why this approach was chosen
- **Testing** — what was tested and how (include MCP tool calls used)
- **Scope** — any related areas that were audited for the same issue

## Quick Reference Checklist

Copy this into your task list at the start of every feature/fix:

```
1. Reproduce the issue (or confirm the starting state)
2. Find the corresponding code (trace YAML → defs → handler)
3. Look for similar patterns (name the pattern before writing code)
4. Implement the fix
5. Test with Vibma MCP (dev_reload → connect → test all methods + errors)
6. Audit for regressions (grep call sites, smoke-test unrelated endpoints)
7. Verify help() accuracy (help topic matches actual behavior)
8. Run AGENTS.md tool checklist (YAML, handler, response types, SKIP_FOCUS, refs, docs, codegen, build)
9. Create PR
```
