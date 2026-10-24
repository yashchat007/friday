import type { RegisteredTool, ToolDefinition } from '../../../shared/types/tools'

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>()

  register(tool: RegisteredTool): void {
    this.tools.set(tool.definition.name, tool)
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name)
  }

  listDefinitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => t.definition)
  }
}
