# huly-cli

Command-line client for [Huly](https://huly.io/), powered by
[`@firfi/huly-mcp`](https://github.com/dearlordylord/huly-mcp).

## Usage

Run without installing:

```bash
npx -y huly-cli@latest --help
```

After global install:

```bash
npm install -g huly-cli
huly --help
```

## Configuration

Set Huly configuration in environment variables or pass a dotenv-style file with `--config`.

```bash
cp .env.example .env
```

Required values:

- `HULY_URL`
- `HULY_WORKSPACE`
- `HULY_TOKEN`, or `HULY_EMAIL` plus `HULY_PASSWORD`

Optional values:

- `HULY_DEFAULT_PROJECT`, used by `issue` commands when `--project` is omitted.
- `HULY_CONNECTION_TIMEOUT`, passed through to `@firfi/huly-mcp`.

The diagnostic commands below do not require Huly credentials:

```bash
npx -y huly-cli@latest context --json
npx -y huly-cli@latest tools --filter issue --json
```

## Examples

```bash
npx -y huly-cli@latest --config .env project list --json
npx -y huly-cli@latest --config .env project statuses HULY --json
npx -y huly-cli@latest --config .env issue list --project HULY --status-category active --limit 20 --json
npx -y huly-cli@latest --config .env issue get HULY-123 --project HULY --json
npx -y huly-cli@latest --config .env issue create --project HULY --title "Fix login redirect"
npx -y huly-cli@latest --config .env issue update HULY-123 --project HULY --status Done
npx -y huly-cli@latest --config .env search "login redirect" --json
```

For tools that are not wrapped by a first-class command, call the upstream MCP tool directly:

```bash
npx -y huly-cli@latest --config .env call list_projects --data '{"limit":10}' --json
npx -y huly-cli@latest --config .env call get_issue --field project=HULY --field identifier=HULY-123 --json
```

## Commands

- `context`: sanitized MCP/Huly runtime context.
- `version-remote`: underlying `@firfi/huly-mcp` version information.
- `tools`: list available upstream MCP tools.
- `project list|get|statuses|create|update|delete`: tracker project operations.
- `issue list|get|create|update|delete|label|unlabel|move`: common issue operations.
- `search`: fulltext search.
- `call`: raw access to every tool exposed by `@firfi/huly-mcp`.

Destructive commands ask for confirmation unless `--yes` is passed.

## Agent Skill

This package includes a Codex/OpenAI skill at `skills/huly-cli/SKILL.md`.
The skill examples use `npx -y huly-cli@latest` so agents can run the CLI without a local install.

## Development

```bash
pnpm install
pnpm check
pnpm pack --dry-run
```

`pnpm check` runs typecheck, unit tests, build, local CLI smoke tests, and upstream MCP startup smoke tests.
Real Huly read/write operations require valid Huly credentials and network access.
