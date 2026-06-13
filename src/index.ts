#!/usr/bin/env node
import { Command } from "commander"

import { registerCommands } from "./commands.js"
import { formatVersionInfo } from "./package-info.js"

const program = new Command()

program
  .name("huly")
  .description("Huly command-line client powered by @firfi/huly-mcp")
  .version(formatVersionInfo())
  .option("--config <path>", "Load Huly env vars from a dotenv-style file")
  .option("--json", "Print JSON output")
  .showHelpAfterError()

registerCommands(program)

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Error: ${message}\n`)
  process.exitCode = 1
})
