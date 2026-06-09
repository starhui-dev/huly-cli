import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createRequire } from "node:module"

import type { HulyCliConfig } from "./config.js"
import { isRecord } from "./json.js"

export interface HulyTool {
  readonly name: string
  readonly description?: string
  readonly category?: string
}

export interface HulyMcpClient {
  readonly callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>
  readonly listTools: () => Promise<ReadonlyArray<HulyTool>>
  readonly close: () => Promise<void>
}

type JsonRpcId = number

type PendingRequest = {
  readonly resolve: (value: unknown) => void
  readonly reject: (error: Error) => void
}

const require = createRequire(import.meta.url)

export const createHulyMcpClient = async (config: HulyCliConfig): Promise<HulyMcpClient> => {
  const serverPath = config.env.HULY_CLI_MCP_SERVER_PATH ?? require.resolve("@firfi/huly-mcp")
  const transport = new JsonRpcStdioClient(
    process.execPath,
    [serverPath],
    {
      ...sanitizeEnv(config.env),
      LAZY_ENVS: "true",
      MCP_TRANSPORT: "stdio"
    }
  )

  await transport.start()
  await transport.request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: "huly-cli",
      version: "0.1.0"
    }
  })
  await transport.notify("notifications/initialized", {})

  return {
    callTool: async (name, args) => {
      const response = await transport.request("tools/call", { name, arguments: args })
      return extractToolResult(response)
    },
    listTools: async () => {
      const response = await transport.request("tools/list", {})
      return extractTools(response)
    },
    close: async () => {
      await transport.close()
    }
  }
}

class JsonRpcStdioClient {
  private child: ChildProcessWithoutNullStreams | undefined
  private nextId = 1
  private buffer = ""
  private readonly pending = new Map<JsonRpcId, PendingRequest>()

  constructor(
    private readonly command: string,
    private readonly args: ReadonlyArray<string>,
    private readonly env: Record<string, string>
  ) {}

  start(): Promise<void> {
    this.child = spawn(this.command, [...this.args], {
      env: {
        ...safeInheritedEnv(),
        ...this.env
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    })

    this.child.stdout.setEncoding("utf8")
    this.child.stdout.on("data", (chunk: string) => {
      this.buffer += chunk
      this.drainBuffer()
    })
    this.child.stderr.setEncoding("utf8")
    this.child.stderr.on("data", () => {
      // Upstream writes diagnostics to stderr. Keep stdout reserved for CLI output.
    })
    this.child.on("error", (error) => {
      this.rejectAll(error)
    })
    this.child.on("close", (code) => {
      if (this.pending.size > 0) {
        this.rejectAll(new Error(`Huly MCP server exited with code ${code ?? "unknown"}`))
      }
    })

    return Promise.resolve()
  }

  async request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++
    const message = {
      jsonrpc: "2.0",
      id,
      method,
      params
    }

    const response = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
    })

    await this.write(message)
    return response
  }

  async notify(method: string, params: Record<string, unknown>): Promise<void> {
    await this.write({
      jsonrpc: "2.0",
      method,
      params
    })
  }

  async close(): Promise<void> {
    if (this.child === undefined) return

    const child = this.child
    this.child = undefined
    const closed = new Promise<void>((resolve) => {
      child.once("close", () => resolve())
    })

    child.stdin.end()
    await Promise.race([closed, delay(500)])
    if (child.exitCode === null) child.kill("SIGTERM")
    await Promise.race([closed, delay(500)])
    if (child.exitCode === null) child.kill("SIGKILL")
  }

  private write(message: unknown): Promise<void> {
    if (this.child === undefined) throw new Error("Huly MCP server is not running")
    return new Promise((resolve, reject) => {
      this.child?.stdin.write(`${JSON.stringify(message)}\n`, (error) => {
        if (error !== null && error !== undefined) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  private drainBuffer(): void {
    while (true) {
      const newline = this.buffer.indexOf("\n")
      if (newline === -1) return

      const rawLine = this.buffer.slice(0, newline).replace(/\r$/, "")
      this.buffer = this.buffer.slice(newline + 1)
      if (rawLine.trim() === "") continue

      this.handleMessage(parseJsonRpcLine(rawLine))
    }
  }

  private handleMessage(message: unknown): void {
    if (!isRecord(message) || typeof message.id !== "number") return

    const pending = this.pending.get(message.id)
    if (pending === undefined) return
    this.pending.delete(message.id)

    if (isJsonRpcFailure(message)) {
      const code = typeof message.error.code === "number" ? message.error.code : ""
      const fallback = `JSON-RPC error ${code}`.trim()
      pending.reject(new Error(typeof message.error.message === "string" ? message.error.message : fallback))
      return
    }

    if (isJsonRpcSuccess(message)) {
      pending.resolve(message.result)
      return
    }

    pending.reject(new Error("Invalid JSON-RPC response from Huly MCP server"))
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error)
    }
    this.pending.clear()
  }
}

const extractToolResult = (response: unknown): unknown => {
  if (isRecord(response) && response.isError === true) {
    throw new Error(extractTextContent(response) ?? "Huly MCP tool failed")
  }

  if (isRecord(response) && isRecord(response.structuredContent) && "result" in response.structuredContent) {
    return response.structuredContent.result
  }

  const text = isRecord(response) ? extractTextContent(response) : undefined
  if (text === undefined) return response

  if (text.trim() === "") return response

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const extractTools = (response: unknown): ReadonlyArray<HulyTool> => {
  if (!isRecord(response) || !Array.isArray(response.tools)) {
    throw new Error("Invalid tools/list response from Huly MCP server")
  }

  return response.tools.filter(isRecord).map((tool) => ({
    name: String(tool.name),
    ...(typeof tool.description === "string" ? { description: tool.description } : {})
  }))
}

const extractTextContent = (response: Record<string, unknown>): string | undefined => {
  const content = response.content
  if (!Array.isArray(content)) return undefined

  return content
    .filter(isRecord)
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text as string)
    .join("\n")
}

const sanitizeEnv = (env: NodeJS.ProcessEnv): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) result[key] = value
  }
  return result
}

const safeInheritedEnv = (): Record<string, string> => {
  const keys = process.platform === "win32"
    ? [
      "APPDATA",
      "HOMEDRIVE",
      "HOMEPATH",
      "LOCALAPPDATA",
      "PATH",
      "PROCESSOR_ARCHITECTURE",
      "SYSTEMDRIVE",
      "SYSTEMROOT",
      "TEMP",
      "USERNAME",
      "USERPROFILE",
      "PROGRAMFILES"
    ]
    : ["HOME", "LOGNAME", "PATH", "SHELL", "TERM", "USER"]

  const env: Record<string, string> = {}
  for (const key of keys) {
    const value = process.env[key]
    if (value !== undefined && !value.startsWith("()")) env[key] = value
  }
  return env
}

const parseJsonRpcLine = (line: string): unknown => {
  try {
    return JSON.parse(line)
  } catch {
    return undefined
  }
}

const isJsonRpcSuccess = (message: Record<string, unknown>): boolean =>
  message.jsonrpc === "2.0" && typeof message.id === "number" && "result" in message

const isJsonRpcFailure = (
  message: Record<string, unknown>
): message is Record<string, unknown> & { readonly error: Record<string, unknown> } =>
  message.jsonrpc === "2.0" && typeof message.id === "number" && isRecord(message.error)

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
