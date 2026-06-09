import { spawn } from "node:child_process"
import { resolve } from "node:path"
import { strictEqual } from "node:assert"

const repo = resolve(import.meta.dirname, "..")
const cli = resolve(repo, "dist/index.js")

const run = async (args) => {
  const child = spawn(process.execPath, [cli, ...args], {
    cwd: repo,
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

  strictEqual(
    code,
    0,
    `Expected ${args.join(" ")} to exit 0, got ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`
  )

  return JSON.parse(stdout)
}

const context = await run(["context", "--json"])
strictEqual(context.package.name, "@firfi/huly-mcp")
strictEqual(typeof context.package.version, "string")
strictEqual(context.transport.type, "stdio")

const tools = await run(["tools", "--filter", "issue", "--json"])
strictEqual(Array.isArray(tools), true)
strictEqual(tools.some((tool) => tool.name === "get_issue"), true)
strictEqual(tools.some((tool) => tool.name === "list_issues"), true)

console.log("Upstream smoke passed")
