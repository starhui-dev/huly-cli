---
name: huly-cli
description: Use this skill when the user wants to inspect or change Huly data from the terminal using huly-cli through npx, including projects, issues, statuses, labels, fulltext search, or raw huly-mcp tool calls. Use for Huly task triage, issue updates, project lookup, and agent-safe Huly automation.
---

# Huly CLI

Use `npx -y @starhui/huly-cli@latest` to work with Huly through `@firfi/huly-mcp`.

For local development inside this repository, `huly` is also acceptable after `pnpm build && pnpm link --global`.

## Quick Checks

1. Confirm the CLI is available:
   ```bash
   npx -y @starhui/huly-cli@latest --version
   ```
2. Prefer explicit config:
   ```bash
   npx -y @starhui/huly-cli@latest --config .env context
   ```
3. If project is omitted for issue commands, set `HULY_DEFAULT_PROJECT` or pass `--project`.

Never print real tokens, passwords, or full `.env` contents. `npx -y @starhui/huly-cli@latest context` is safe because it returns sanitized config.

## Common Commands

List projects:
```bash
npx -y @starhui/huly-cli@latest --config .env project list --json
```

Discover statuses before creating or updating issues:
```bash
npx -y @starhui/huly-cli@latest --config .env project statuses HULY --json
```

List issues:
```bash
npx -y @starhui/huly-cli@latest --config .env issue list --project HULY --status-category active --limit 20 --json
```

Get an issue:
```bash
npx -y @starhui/huly-cli@latest --config .env issue get HULY-123 --project HULY --json
```

Create an issue:
```bash
npx -y @starhui/huly-cli@latest --config .env issue create --project HULY --title "Short imperative title" --description "Markdown body"
```

Update an issue:
```bash
npx -y @starhui/huly-cli@latest --config .env issue update HULY-123 --project HULY --status Done
```

Search:
```bash
npx -y @starhui/huly-cli@latest --config .env search "query text" --limit 10 --json
```

## Raw Tool Access

Use raw calls when the first-class CLI does not expose an upstream MCP tool:

```bash
npx -y @starhui/huly-cli@latest --config .env tools --filter document
npx -y @starhui/huly-cli@latest --config .env call get_issue --field project=HULY --field identifier=HULY-123 --json
npx -y @starhui/huly-cli@latest --config .env call list_projects --data '{"limit":10}' --json
```

`--field key=value` coerces `true`, `false`, `null`, and numbers. Use `--data` or `--file` for nested JSON.

## Safety

- Use `--json` for agent parsing.
- Read before write: inspect the project/status/issue before mutating it unless the user gave exact values.
- Destructive commands require confirmation; only pass `--yes` when the user explicitly requested deletion.
- Prefer status names from `project statuses`; do not invent workflow statuses.
- If a command fails due to auth/config, report the missing sanitized fields from `npx -y @starhui/huly-cli@latest --config .env context`; do not expose secrets.

## Useful Mapping

- Projects: `project list`, `project get`, `project statuses`, `project create`, `project update`, `project delete`.
- Issues: `issue list`, `issue get`, `issue create`, `issue update`, `issue delete`, `issue label`, `issue unlabel`, `issue move`.
- Global search: `search`.
- All upstream MCP tools: `tools` and `call`.
