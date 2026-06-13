# huly-cli

基于 [`@firfi/huly-mcp`](https://github.com/dearlordylord/huly-mcp) 的
[Huly](https://huly.io/) 命令行客户端。

## 使用方式

无需安装，直接通过 `npx` 运行：

```bash
npx -y @starhui/huly-cli@latest --help
```

也可以全局安装后使用：

```bash
npm install -g @starhui/huly-cli
huly --help
```

## 配置

可以通过环境变量配置 Huly，也可以用 `--config` 指定 dotenv 格式的配置文件。

```bash
cp .env.example .env
```

必填配置：

- `HULY_URL`
- `HULY_WORKSPACE`
- `HULY_TOKEN`，或 `HULY_EMAIL` 加 `HULY_PASSWORD`

可选配置：

- `HULY_DEFAULT_PROJECT`：`issue` 命令未传 `--project` 时使用的默认项目。
- `HULY_CONNECTION_TIMEOUT`：透传给 `@firfi/huly-mcp` 的连接超时时间。

下面这些诊断命令不需要 Huly 凭据：

```bash
npx -y @starhui/huly-cli@latest context --json
npx -y @starhui/huly-cli@latest tools --filter issue --json
```

## 示例

```bash
npx -y @starhui/huly-cli@latest --config .env project list --json
npx -y @starhui/huly-cli@latest --config .env project statuses HULY --json
npx -y @starhui/huly-cli@latest --config .env issue list --project HULY --status-category active --limit 20 --json
npx -y @starhui/huly-cli@latest --config .env issue get HULY-123 --project HULY --json
npx -y @starhui/huly-cli@latest --config .env issue create --project HULY --title "Fix login redirect"
npx -y @starhui/huly-cli@latest --config .env issue update HULY-123 --project HULY --status Done
npx -y @starhui/huly-cli@latest --config .env search "login redirect" --json
```

对于没有封装成一级命令的能力，可以直接调用上游 MCP 工具：

```bash
npx -y @starhui/huly-cli@latest --config .env call list_projects --data '{"limit":10}' --json
npx -y @starhui/huly-cli@latest --config .env call get_issue --field project=HULY --field identifier=HULY-123 --json
```

## 命令

- `context`：输出脱敏后的 MCP/Huly 运行上下文。
- `version-remote`：输出底层 `@firfi/huly-mcp` 版本信息。
- `tools`：列出上游 MCP 暴露的工具。
- `project list|get|statuses|create|update|delete`：项目相关操作。
- `issue list|get|create|update|delete|label|unlabel|move`：常用 Issue 操作。
- `search`：全文搜索。
- `call`：直接调用 `@firfi/huly-mcp` 暴露的任意工具。

删除、更新等破坏性命令默认会要求确认；传入 `--yes` 后跳过确认。

## Agent Skill

这个包内置 Codex/OpenAI skill，路径为 `skills/huly-cli/SKILL.md`。
skill 示例使用 `npx -y @starhui/huly-cli@latest`，方便 agent 在没有本地安装 CLI 的情况下直接运行。

使用 `skills` CLI 全局安装：

```bash
npx -y skills add starhui-dev/huly-cli --skill huly-cli --global
```

安装到当前项目时去掉 `--global`：

```bash
npx -y skills add starhui-dev/huly-cli --skill huly-cli
```

安装前查看仓库中可用的 skills：

```bash
npx -y skills add starhui-dev/huly-cli --list --full-depth
```

## 自动更新与发布

仓库内置 GitHub Actions：

- `Update huly-mcp`：每天定时检查 `@firfi/huly-mcp` 最新版本；发现更新后自动更新依赖、patch bump CLI 版本、运行 `pnpm check`、打 tag，并发布 `@starhui/huly-cli`。
- `Publish npm`：手动触发的发布 workflow，用于不依赖 MCP 更新时主动发新版。

发布到 npm 需要在 GitHub 仓库 Secrets 中配置 `NPM_TOKEN`，并确保 npm token 对 `@starhui/huly-cli` 有发布权限。

## 开发

```bash
pnpm install
pnpm check
pnpm pack --dry-run
```

`pnpm check` 会依次运行类型检查、单元测试、构建、本地 CLI 冒烟测试和上游 MCP 启动冒烟测试。
真实的 Huly 读写操作需要有效的 Huly 凭据和网络连接。
