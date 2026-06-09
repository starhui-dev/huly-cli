import type { Command } from "commander"

import { loadConfig, validateConfig } from "./config.js"
import { createHulyMcpClient } from "./mcp-client.js"
import { collectKeyValue, type CommonOptions } from "./options.js"
import { printResult } from "./output.js"
import { confirmDestructiveAction } from "./prompts.js"
import { parseJsonObject, readJsonObjectFile } from "./json.js"

interface WithProject {
  readonly project?: string
}

interface ListProjectsOptions extends CommonOptions {
  readonly archived?: boolean
  readonly limit?: string
}

interface ListIssuesOptions extends CommonOptions, WithProject {
  readonly status?: string
  readonly statusCategory?: string
  readonly assignee?: string
  readonly component?: string
  readonly parentIssue?: string
  readonly title?: string
  readonly description?: string
  readonly topLevel?: boolean
  readonly limit?: string
}

interface IssueRefOptions extends CommonOptions, WithProject {}

interface CreateIssueOptions extends CommonOptions, WithProject {
  readonly title: string
  readonly description?: string
  readonly priority?: string
  readonly assignee?: string
  readonly status?: string
  readonly taskType?: string
  readonly parentIssue?: string
  readonly dueDate?: string
  readonly estimation?: string
}

interface UpdateIssueOptions extends CommonOptions, WithProject {
  readonly title?: string
  readonly description?: string
  readonly priority?: string
  readonly assignee?: string
  readonly unassign?: boolean
  readonly status?: string
  readonly taskType?: string
  readonly dueDate?: string
  readonly clearDueDate?: boolean
  readonly estimation?: string
  readonly clearEstimation?: boolean
}

interface DeleteOptions extends CommonOptions, WithProject {
  readonly yes?: boolean
}

interface RawCallOptions extends CommonOptions {
  readonly data?: string
  readonly file?: string
  readonly field: Record<string, string | boolean | number | null>
}

interface ToolListOptions extends CommonOptions {
  readonly filter?: string
}

export const registerCommands = (program: Command): void => {
  program
    .command("context")
    .description("Print sanitized Huly MCP runtime context")
    .action(async (_options: CommonOptions, command: Command) => {
      await callAndPrint("get_huly_context", {}, normalizeOptions(command), { validate: false })
    })

  program
    .command("version-remote")
    .description("Print the underlying huly-mcp version information")
    .action(async (_options: CommonOptions, command: Command) => {
      await callAndPrint("get_version", {}, normalizeOptions(command), { validate: false })
    })

  program
    .command("tools")
    .description("List available Huly MCP tools")
    .option("--filter <text>", "Filter by tool name or description")
    .action(async (options: ToolListOptions, command: Command) => {
      const mergedOptions = normalizeOptions<ToolListOptions>(command, options)
      const client = await createClient(mergedOptions, { validate: false })
      try {
        const tools = await client.listTools()
        const filter = mergedOptions.filter?.toLowerCase()
        const visible = filter === undefined
          ? tools
          : tools.filter((tool) =>
            tool.name.toLowerCase().includes(filter)
            || tool.description?.toLowerCase().includes(filter) === true
          )
        printResult(visible, { format: outputFormat(mergedOptions) })
      } finally {
        await client.close()
      }
    })

  const projects = program.command("project").description("Manage Huly projects")

  projects
    .command("list")
    .description("List projects")
    .option("--archived", "Include archived projects")
    .option("--limit <number>", "Maximum number of projects")
    .action(async (options: ListProjectsOptions, command: Command) => {
      const mergedOptions = normalizeOptions<ListProjectsOptions>(command, options)
      await callAndPrint("list_projects", compact({
        includeArchived: mergedOptions.archived,
        limit: parseOptionalNumber(mergedOptions.limit, "limit")
      }), mergedOptions)
    })

  projects
    .command("get <project>")
    .description("Get project details")
    .action(async (project: string, _options: CommonOptions, command: Command) => {
      await callAndPrint("get_project", { project }, normalizeOptions(command))
    })

  projects
    .command("statuses <project>")
    .description("List issue statuses for a project")
    .action(async (project: string, _options: CommonOptions, command: Command) => {
      await callAndPrint("list_statuses", { project }, normalizeOptions(command))
    })

  projects
    .command("create")
    .description("Create a tracker project")
    .requiredOption("--name <name>", "Project name")
    .requiredOption("--identifier <identifier>", "Project identifier, e.g. HULY")
    .option("--description <text>", "Project description")
    .option("--private", "Create private project")
    .action(async (options: CommonOptions & {
      readonly name: string
      readonly identifier: string
      readonly description?: string
      readonly private?: boolean
    }, command: Command) => {
      const mergedOptions = normalizeOptions<typeof options>(command, options)
      await callAndPrint("create_project", compact({
        name: mergedOptions.name,
        identifier: mergedOptions.identifier,
        description: mergedOptions.description,
        private: mergedOptions.private
      }), mergedOptions)
    })

  projects
    .command("update <project>")
    .description("Update a project")
    .option("--name <name>", "New project name")
    .option("--description <text>", "New project description")
    .option("--clear-description", "Clear project description")
    .action(async (project: string, options: CommonOptions & {
      readonly name?: string
      readonly description?: string
      readonly clearDescription?: boolean
    }, command: Command) => {
      const mergedOptions = normalizeOptions<typeof options>(command, options)
      await callAndPrint("update_project", compact({
        project,
        name: mergedOptions.name,
        description: mergedOptions.clearDescription === true ? null : mergedOptions.description
      }), mergedOptions)
    })

  projects
    .command("delete <project>")
    .description("Delete a project")
    .option("-y, --yes", "Skip confirmation")
    .action(async (project: string, options: DeleteOptions, command: Command) => {
      const mergedOptions = normalizeOptions<DeleteOptions>(command, options)
      await confirmDestructiveAction(`Delete project ${project}?`, mergedOptions)
      await callAndPrint("delete_project", { project }, mergedOptions)
    })

  const issues = program.command("issue").description("Manage Huly issues")

  issues
    .command("list")
    .description("List issues")
    .option("-p, --project <project>", "Project identifier; defaults to HULY_DEFAULT_PROJECT")
    .option("--status <status>", "Exact workflow status")
    .option("--status-category <category>", "Status category")
    .option("--assignee <person>", "Assignee email or display name")
    .option("--component <component>", "Component id or label")
    .option("--parent-issue <issue>", "List children of an issue")
    .option("--title <text>", "Case-insensitive title search")
    .option("--description <text>", "Description fulltext search")
    .option("--top-level", "Only top-level issues")
    .option("--limit <number>", "Maximum number of issues")
    .action(async (options: ListIssuesOptions, command: Command) => {
      const mergedOptions = normalizeOptions<ListIssuesOptions>(command, options)
      await callAndPrint("list_issues", compact({
        project: requireProject(mergedOptions),
        status: mergedOptions.status,
        statusCategory: mergedOptions.statusCategory,
        assignee: mergedOptions.assignee,
        component: mergedOptions.component,
        parentIssue: mergedOptions.parentIssue,
        titleSearch: mergedOptions.title,
        descriptionSearch: mergedOptions.description,
        isTopLevel: mergedOptions.topLevel,
        limit: parseOptionalNumber(mergedOptions.limit, "limit")
      }), mergedOptions)
    })

  issues
    .command("get <identifier>")
    .description("Get issue details")
    .option("-p, --project <project>", "Project identifier; defaults to HULY_DEFAULT_PROJECT")
    .action(async (identifier: string, options: IssueRefOptions, command: Command) => {
      const mergedOptions = normalizeOptions<IssueRefOptions>(command, options)
      await callAndPrint("get_issue", { project: requireProject(mergedOptions), identifier }, mergedOptions)
    })

  issues
    .command("create")
    .description("Create an issue")
    .option("-p, --project <project>", "Project identifier; defaults to HULY_DEFAULT_PROJECT")
    .requiredOption("--title <title>", "Issue title")
    .option("--description <markdown>", "Issue description")
    .option("--priority <priority>", "urgent, high, medium, low, no-priority")
    .option("--assignee <person>", "Assignee email or display name")
    .option("--status <status>", "Initial status")
    .option("--task-type <taskType>", "Task type id or display name")
    .option("--parent-issue <issue>", "Create as sub-issue")
    .option("--due-date <timestamp>", "Due date as Unix timestamp in milliseconds")
    .option("--estimation <minutes>", "Time estimation in minutes")
    .action(async (options: CreateIssueOptions, command: Command) => {
      const mergedOptions = normalizeOptions<CreateIssueOptions>(command, options)
      await callAndPrint("create_issue", compact({
        project: requireProject(mergedOptions),
        title: mergedOptions.title,
        description: mergedOptions.description,
        priority: mergedOptions.priority,
        assignee: mergedOptions.assignee,
        status: mergedOptions.status,
        taskType: mergedOptions.taskType,
        parentIssue: mergedOptions.parentIssue,
        dueDate: parseOptionalNumber(mergedOptions.dueDate, "due-date"),
        estimation: parseOptionalNumber(mergedOptions.estimation, "estimation")
      }), mergedOptions)
    })

  issues
    .command("update <identifier>")
    .description("Update an issue")
    .option("-p, --project <project>", "Project identifier; defaults to HULY_DEFAULT_PROJECT")
    .option("--title <title>", "New title")
    .option("--description <markdown>", "New description")
    .option("--priority <priority>", "New priority")
    .option("--assignee <person>", "New assignee")
    .option("--unassign", "Clear assignee")
    .option("--status <status>", "New status")
    .option("--task-type <taskType>", "New task type")
    .option("--due-date <timestamp>", "Due date as Unix timestamp in milliseconds")
    .option("--clear-due-date", "Clear due date")
    .option("--estimation <minutes>", "Time estimation in minutes")
    .option("--clear-estimation", "Clear estimation")
    .action(async (identifier: string, options: UpdateIssueOptions, command: Command) => {
      const mergedOptions = normalizeOptions<UpdateIssueOptions>(command, options)
      await callAndPrint("update_issue", compact({
        project: requireProject(mergedOptions),
        identifier,
        title: mergedOptions.title,
        description: mergedOptions.description,
        priority: mergedOptions.priority,
        assignee: mergedOptions.unassign === true ? null : mergedOptions.assignee,
        status: mergedOptions.status,
        taskType: mergedOptions.taskType,
        dueDate: mergedOptions.clearDueDate === true
          ? null
          : parseOptionalNumber(mergedOptions.dueDate, "due-date"),
        estimation: mergedOptions.clearEstimation === true
          ? null
          : parseOptionalNumber(mergedOptions.estimation, "estimation")
      }), mergedOptions)
    })

  issues
    .command("delete <identifier>")
    .description("Delete an issue")
    .option("-p, --project <project>", "Project identifier; defaults to HULY_DEFAULT_PROJECT")
    .option("-y, --yes", "Skip confirmation")
    .action(async (identifier: string, options: DeleteOptions, command: Command) => {
      const mergedOptions = normalizeOptions<DeleteOptions>(command, options)
      const project = requireProject(mergedOptions)
      await confirmDestructiveAction(`Delete issue ${identifier} in ${project}?`, mergedOptions)
      await callAndPrint("delete_issue", { project, identifier }, mergedOptions)
    })

  issues
    .command("label <identifier> <label>")
    .description("Add a label to an issue")
    .option("-p, --project <project>", "Project identifier; defaults to HULY_DEFAULT_PROJECT")
    .option("--color <index>", "Huly color index")
    .action(async (identifier: string, label: string, options: CommonOptions & WithProject & {
      readonly color?: string
    }, command: Command) => {
      const mergedOptions = normalizeOptions<typeof options>(command, options)
      await callAndPrint("add_issue_label", compact({
        project: requireProject(mergedOptions),
        identifier,
        label,
        color: parseOptionalNumber(mergedOptions.color, "color")
      }), mergedOptions)
    })

  issues
    .command("unlabel <identifier> <label>")
    .description("Remove a label from an issue")
    .option("-p, --project <project>", "Project identifier; defaults to HULY_DEFAULT_PROJECT")
    .action(async (identifier: string, label: string, options: IssueRefOptions, command: Command) => {
      const mergedOptions = normalizeOptions<IssueRefOptions>(command, options)
      await callAndPrint("remove_issue_label", {
        project: requireProject(mergedOptions),
        identifier,
        label
      }, mergedOptions)
    })

  issues
    .command("move <identifier>")
    .description("Move an issue under a new parent or to top-level")
    .option("-p, --project <project>", "Project identifier; defaults to HULY_DEFAULT_PROJECT")
    .option("--parent <identifier>", "New parent issue")
    .option("--top-level", "Move to top-level")
    .action(async (identifier: string, options: IssueRefOptions & {
      readonly parent?: string
      readonly topLevel?: boolean
    }, command: Command) => {
      const mergedOptions = normalizeOptions<typeof options>(command, options)
      await callAndPrint("move_issue", {
        project: requireProject(mergedOptions),
        identifier,
        newParent: mergedOptions.topLevel === true ? null : mergedOptions.parent
      }, mergedOptions)
    })

  program
    .command("search <query>")
    .description("Run Huly fulltext search")
    .option("--limit <number>", "Maximum number of results")
    .action(async (query: string, options: CommonOptions & {
      readonly limit?: string
    }, command: Command) => {
      const mergedOptions = normalizeOptions<typeof options>(command, options)
      await callAndPrint("fulltext_search", compact({
        query,
        limit: parseOptionalNumber(mergedOptions.limit, "limit")
      }), mergedOptions)
    })

  program
    .command("call <tool>")
    .description("Call any raw huly-mcp tool by name")
    .option("--data <json>", "JSON object arguments")
    .option("--file <path>", "JSON file containing arguments")
    .option("--field <key=value>", "Add a scalar argument; can be repeated", collectKeyValue, {})
    .action(async (tool: string, options: RawCallOptions, command: Command) => {
      const mergedOptions = normalizeOptions<RawCallOptions>(command, options)
      const args = mergeRawArgs(mergedOptions)
      await callAndPrint(tool, args, mergedOptions)
    })
}

const callAndPrint = async (
  toolName: string,
  args: Record<string, unknown>,
  options: CommonOptions,
  clientOptions: { readonly validate?: boolean } = {}
): Promise<void> => {
  const client = await createClient(options, clientOptions)
  try {
    const result = await client.callTool(toolName, args)
    printResult(result, { format: outputFormat(options) })
  } finally {
    await client.close()
  }
}

const createClient = async (
  options: CommonOptions,
  clientOptions: { readonly validate?: boolean } = {}
) => {
  const config = loadConfig(options)
  if (clientOptions.validate !== false) validateConfig(config)
  return createHulyMcpClient(config)
}

const mergeRawArgs = (options: RawCallOptions): Record<string, unknown> => {
  const fromData = options.data === undefined ? {} : parseJsonObject(options.data, "--data")
  const fromFile = options.file === undefined ? {} : readJsonObjectFile(options.file)
  return {
    ...fromFile,
    ...fromData,
    ...options.field
  }
}

const compact = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined))

const outputFormat = (options: CommonOptions): "json" | "pretty" => options.json === true ? "json" : "pretty"

const normalizeOptions = <T extends CommonOptions>(command: Command, options?: T): T =>
  ({
    ...command.optsWithGlobals<CommonOptions>(),
    ...options
  }) as T

const requireProject = (options: WithProject): string => {
  const project = options.project ?? process.env.HULY_DEFAULT_PROJECT
  if (project === undefined || project.trim() === "") {
    throw new Error("Project is required. Pass --project or set HULY_DEFAULT_PROJECT.")
  }
  return project
}

const parseOptionalNumber = (value: string | undefined, label: string): number | undefined => {
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number`)
  return parsed
}
