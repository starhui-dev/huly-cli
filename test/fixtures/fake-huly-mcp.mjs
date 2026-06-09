#!/usr/bin/env node

const tools = [
  ["get_huly_context", "Return sanitized context"],
  ["get_version", "Return version"],
  ["list_projects", "List projects"],
  ["get_project", "Get project"],
  ["list_statuses", "List issue statuses"],
  ["create_project", "Create project"],
  ["update_project", "Update project"],
  ["delete_project", "Delete project"],
  ["list_issues", "List issues"],
  ["get_issue", "Get issue"],
  ["create_issue", "Create issue"],
  ["update_issue", "Update issue"],
  ["delete_issue", "Delete issue"],
  ["add_issue_label", "Add issue label"],
  ["remove_issue_label", "Remove issue label"],
  ["move_issue", "Move issue"],
  ["fulltext_search", "Search"],
  ["raw_tool", "Raw tool for smoke tests"]
].map(([name, description]) => ({ name, description }))

let buffer = ""

process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => {
  buffer += chunk
  drain()
})

const drain = () => {
  while (true) {
    const newline = buffer.indexOf("\n")
    if (newline === -1) return

    const line = buffer.slice(0, newline).trim()
    buffer = buffer.slice(newline + 1)
    if (line === "") continue

    handle(JSON.parse(line))
  }
}

const handle = (message) => {
  if (message.method === "notifications/initialized") return

  if (message.method === "initialize") {
    respond(message.id, {
      protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: {
        name: "fake-huly-mcp",
        version: "0.0.0-smoke"
      }
    })
    return
  }

  if (message.method === "tools/list") {
    respond(message.id, { tools })
    return
  }

  if (message.method === "tools/call") {
    const payload = {
      tool: message.params?.name,
      args: message.params?.arguments ?? {}
    }
    respond(message.id, {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: { result: payload }
    })
    return
  }

  respondError(message.id, `Unsupported method ${message.method}`)
}

const respond = (id, result) => {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`)
}

const respondError = (id, message) => {
  process.stdout.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message }
  })}\n`)
}
