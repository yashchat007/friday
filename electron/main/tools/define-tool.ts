import type { z } from 'zod'
import type {
  RegisteredTool,
  ToolDefinition,
  ToolHandlerContext,
  ToolResult
} from '../../../shared/types/tools'

export function defineTool<S extends z.ZodType<Record<string, unknown>>>(
  definition: ToolDefinition,
  schema: S,
  execute: (args: z.infer<S>, ctx: ToolHandlerContext) => Promise<ToolResult>
): RegisteredTool {
  return {
    definition,
    schema: schema as z.ZodType<Record<string, unknown>>,
    execute: execute as (
      args: Record<string, unknown>,
      ctx: ToolHandlerContext
    ) => Promise<ToolResult>
  }
}
