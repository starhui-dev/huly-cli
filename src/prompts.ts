import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"

export const confirmDestructiveAction = async (
  prompt: string,
  options: { readonly yes?: boolean }
): Promise<void> => {
  if (options.yes === true) return

  const rl = createInterface({ input: stdin, output: stdout })
  try {
    const answer = await rl.question(`${prompt} Type "yes" to continue: `)
    if (answer !== "yes") {
      throw new Error("Aborted")
    }
  } finally {
    rl.close()
  }
}
