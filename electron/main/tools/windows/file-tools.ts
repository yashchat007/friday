import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { RegisteredTool } from '../../../../shared/types/tools'
import { ensureParentDir, resolveUserPath } from '../../automation/path-policy'
import { defineTool } from '../define-tool'

export function createFileTools(getAllowedPaths: () => string[]): RegisteredTool[] {
  const listSchema = z.object({
    directory: z.string()
  })

  const readSchema = z.object({
    filePath: z.string()
  })

  const writeSchema = z.object({
    filePath: z.string(),
    content: z.string()
  })

  const moveSchema = z.object({
    fromPath: z.string(),
    toPath: z.string()
  })

  const deleteSchema = z.object({
    filePath: z.string()
  })

  const pathSchema = z.object({ rawPath: z.string() })

  return [
    defineTool(
      {
        name: 'file_list',
        description: 'List files and directories in a folder',
        risk: 'safe',
        parameters: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Directory path' }
          },
          required: ['directory']
        }
      },
      listSchema,
      async (args) => {
        const dir = resolveUserPath(args.directory, getAllowedPaths())
        const entries = await fs.readdir(dir, { withFileTypes: true })
        return {
          ok: true,
          data: entries.map((e) => ({
            name: e.name,
            type: e.isDirectory() ? 'directory' : 'file'
          }))
        }
      }
    ),
    defineTool(
      {
        name: 'file_read',
        description: 'Read a text file',
        risk: 'safe',
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string' }
          },
          required: ['filePath']
        }
      },
      readSchema,
      async (args) => {
        const filePath = resolveUserPath(args.filePath, getAllowedPaths())
        const content = await fs.readFile(filePath, 'utf8')
        return { ok: true, data: { content, filePath } }
      }
    ),
    defineTool(
      {
        name: 'file_write',
        description: 'Write or overwrite a text file',
        risk: 'sensitive',
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['filePath', 'content']
        }
      },
      writeSchema,
      async (args) => {
        const filePath = resolveUserPath(args.filePath, getAllowedPaths())
        ensureParentDir(filePath)
        await fs.writeFile(filePath, args.content, 'utf8')
        return { ok: true, data: { filePath, bytes: Buffer.byteLength(args.content, 'utf8') } }
      }
    ),
    defineTool(
      {
        name: 'file_move',
        description: 'Move or rename a file',
        risk: 'sensitive',
        parameters: {
          type: 'object',
          properties: {
            fromPath: { type: 'string' },
            toPath: { type: 'string' }
          },
          required: ['fromPath', 'toPath']
        }
      },
      moveSchema,
      async (args) => {
        const fromPath = resolveUserPath(args.fromPath, getAllowedPaths())
        const toPath = resolveUserPath(args.toPath, getAllowedPaths())
        ensureParentDir(toPath)
        await fs.rename(fromPath, toPath)
        return { ok: true, data: { fromPath, toPath } }
      }
    ),
    defineTool(
      {
        name: 'file_delete',
        description: 'Delete a file',
        risk: 'destructive',
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string' }
          },
          required: ['filePath']
        }
      },
      deleteSchema,
      async (args) => {
        const filePath = resolveUserPath(args.filePath, getAllowedPaths())
        await fs.unlink(filePath)
        return { ok: true, data: { filePath } }
      }
    ),
    defineTool(
      {
        name: 'path_resolve',
        description: 'Resolve a user path and verify it is allowed',
        risk: 'safe',
        parameters: {
          type: 'object',
          properties: {
            rawPath: { type: 'string' }
          },
          required: ['rawPath']
        }
      },
      pathSchema,
      async (args) => {
        const resolved = resolveUserPath(args.rawPath, getAllowedPaths())
        return { ok: true, data: { resolved, basename: path.basename(resolved) } }
      }
    )
  ]
}
