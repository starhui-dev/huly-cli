import { createRequire } from "node:module"

interface PackageJson {
  readonly name: string
  readonly version: string
}

const require = createRequire(import.meta.url)
const packageJson = require("../package.json") as PackageJson

export const cliPackageName = packageJson.name
export const cliVersion = packageJson.version
