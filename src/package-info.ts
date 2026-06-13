import { createRequire } from "node:module"

interface PackageJson {
  readonly name: string
  readonly version: string
  readonly dependencies?: Record<string, string>
}

const require = createRequire(import.meta.url)
const packageJson = require("../package.json") as PackageJson

export const cliPackageName = packageJson.name
export const cliVersion = packageJson.version
export const hulyMcpPackageName = "@firfi/huly-mcp"
export const hulyMcpVersion = packageJson.dependencies?.[hulyMcpPackageName] ?? "unknown"

export const formatVersionInfo = (): string => [
  `${cliPackageName} ${cliVersion}`,
  `${hulyMcpPackageName} ${hulyMcpVersion}`,
  `node ${process.version}`
].join("\n")
