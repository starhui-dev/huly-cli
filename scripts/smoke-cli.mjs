import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { deepStrictEqual, strictEqual } from "node:assert"
import packageJson from "../package.json" with { type: "json" }

const repo = resolve(import.meta.dirname, "..")
const cli = join(repo, "dist/index.js")
const fakeServer = join(repo, "test/fixtures/fake-huly-mcp.mjs")

const baseEnv = {
  HULY_CLI_MCP_SERVER_PATH: fakeServer,
  HULY_URL: "https://huly.example.test",
  HULY_WORKSPACE: "demo",
  HULY_TOKEN: "test-token",
  HULY_DEFAULT_PROJECT: "DEF"
}

const run = async (args, options = {}) => {
  const child = spawn(process.execPath, [cli, ...args], {
    cwd: repo,
    env: {
      ...process.env,
      ...baseEnv,
      ...(options.env ?? {})
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  let stdout = ""
  let stderr = ""
  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")
  child.stdout.on("data", (chunk) => {
    stdout += chunk
  })
  child.stderr.on("data", (chunk) => {
    stderr += chunk
  })

  const code = await new Promise((resolveCode) => {
    child.on("close", resolveCode)
  })

  const expectedCode = options.code ?? 0
  strictEqual(
    code,
    expectedCode,
    `Expected ${args.join(" ")} to exit ${expectedCode}, got ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`
  )

  return { stdout, stderr }
}

const parseJson = (stdout) => JSON.parse(stdout)

const expectTool = async (args, tool, expectedArgs) => {
  const { stdout } = await run([...args, "--json"])
  deepStrictEqual(parseJson(stdout), { tool, args: expectedArgs })
}

await run(["--help"])
{
  const { stdout } = await run(["--version"])
  strictEqual(stdout.includes(`${packageJson.name} ${packageJson.version}`), true)
  strictEqual(stdout.includes(`@firfi/huly-mcp ${packageJson.dependencies["@firfi/huly-mcp"]}`), true)
  strictEqual(stdout.includes(`node ${process.version}`), true)
}

await expectTool(["context"], "get_huly_context", {})
await expectTool(["version-remote"], "get_version", {})

{
  const { stdout } = await run(["tools", "--filter", "issue", "--json"])
  const names = parseJson(stdout).map((tool) => tool.name)
  strictEqual(names.includes("get_issue"), true)
  strictEqual(names.includes("list_projects"), false)
}

await expectTool(["project", "list", "--archived", "--limit", "2"], "list_projects", {
  includeArchived: true,
  limit: 2
})
await expectTool(["project", "get", "HULY"], "get_project", { project: "HULY" })
await expectTool(["project", "statuses", "HULY"], "list_statuses", { project: "HULY" })
await expectTool(["project", "create", "--name", "Demo", "--identifier", "DEMO", "--description", "Desc", "--private"], "create_project", {
  name: "Demo",
  identifier: "DEMO",
  description: "Desc",
  private: true
})
await expectTool(["project", "update", "HULY", "--name", "Renamed", "--clear-description"], "update_project", {
  project: "HULY",
  name: "Renamed",
  description: null
})
await expectTool(["project", "delete", "HULY", "--yes"], "delete_project", { project: "HULY" })

await expectTool([
  "issue",
  "list",
  "--project",
  "HULY",
  "--status",
  "Todo",
  "--status-category",
  "Active",
  "--assignee",
  "user@example.com",
  "--component",
  "API",
  "--parent-issue",
  "HULY-1",
  "--title",
  "login",
  "--description",
  "redirect",
  "--limit",
  "3"
], "list_issues", {
  project: "HULY",
  status: "Todo",
  statusCategory: "Active",
  assignee: "user@example.com",
  component: "API",
  parentIssue: "HULY-1",
  titleSearch: "login",
  descriptionSearch: "redirect",
  limit: 3
})
await expectTool(["issue", "list", "--top-level", "--limit", "1"], "list_issues", {
  project: "DEF",
  isTopLevel: true,
  limit: 1
})
await expectTool(["issue", "get", "HULY-1", "--project", "HULY"], "get_issue", {
  project: "HULY",
  identifier: "HULY-1"
})
await expectTool([
  "issue",
  "create",
  "--project",
  "HULY",
  "--title",
  "Fix login",
  "--description",
  "Markdown",
  "--priority",
  "high",
  "--assignee",
  "dev@example.com",
  "--status",
  "Todo",
  "--task-type",
  "Bug",
  "--parent-issue",
  "HULY-1",
  "--due-date",
  "1719792000000",
  "--estimation",
  "60"
], "create_issue", {
  project: "HULY",
  title: "Fix login",
  description: "Markdown",
  priority: "high",
  assignee: "dev@example.com",
  status: "Todo",
  taskType: "Bug",
  parentIssue: "HULY-1",
  dueDate: 1719792000000,
  estimation: 60
})
await expectTool([
  "issue",
  "update",
  "HULY-1",
  "--project",
  "HULY",
  "--title",
  "New title",
  "--description",
  "New body",
  "--priority",
  "low",
  "--unassign",
  "--status",
  "Done",
  "--task-type",
  "Task",
  "--clear-due-date",
  "--clear-estimation"
], "update_issue", {
  project: "HULY",
  identifier: "HULY-1",
  title: "New title",
  description: "New body",
  priority: "low",
  assignee: null,
  status: "Done",
  taskType: "Task",
  dueDate: null,
  estimation: null
})
await expectTool(["issue", "delete", "HULY-1", "--project", "HULY", "--yes"], "delete_issue", {
  project: "HULY",
  identifier: "HULY-1"
})
await expectTool(["issue", "label", "HULY-1", "backend", "--project", "HULY", "--color", "2"], "add_issue_label", {
  project: "HULY",
  identifier: "HULY-1",
  label: "backend",
  color: 2
})
await expectTool(["issue", "unlabel", "HULY-1", "backend", "--project", "HULY"], "remove_issue_label", {
  project: "HULY",
  identifier: "HULY-1",
  label: "backend"
})
await expectTool(["issue", "move", "HULY-2", "--project", "HULY", "--parent", "HULY-1"], "move_issue", {
  project: "HULY",
  identifier: "HULY-2",
  newParent: "HULY-1"
})
await expectTool(["issue", "move", "HULY-2", "--project", "HULY", "--top-level"], "move_issue", {
  project: "HULY",
  identifier: "HULY-2",
  newParent: null
})

await expectTool(["search", "login redirect", "--limit", "5"], "fulltext_search", {
  query: "login redirect",
  limit: 5
})

const tempDir = await mkdtemp(join(tmpdir(), "huly-cli-smoke-"))
try {
  const dataFile = join(tempDir, "args.json")
  await writeFile(dataFile, JSON.stringify({ fromFile: true, limit: 1 }))
  await expectTool([
    "call",
    "raw_tool",
    "--file",
    dataFile,
    "--data",
    "{\"fromData\":true}",
    "--field",
    "limit=2",
    "--field",
    "flag=true",
    "--field",
    "empty=null"
  ], "raw_tool", {
    fromFile: true,
    limit: 2,
    fromData: true,
    flag: true,
    empty: null
  })
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

{
  const { stderr } = await run(["project", "list"], {
    env: {
      HULY_URL: "",
      HULY_WORKSPACE: "",
      HULY_TOKEN: ""
    },
    code: 1
  })
  strictEqual(stderr.includes("Missing Huly configuration"), true)
}

console.log("CLI smoke passed")
