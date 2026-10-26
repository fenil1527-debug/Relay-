import File from '../models/File.js';
import config from '../config/index.js';
import { filePathSchema } from '../validators/schemas.js';

/**
 * Tool Executor
 * 
 * From ARCHITECTURE.md §9:
 * Executes list_files, read_file, write_file, delete_file against the
 * session's virtual file tree. Idempotent per tool_use_id.
 * 
 * - No host filesystem access, no code execution
 * - Path validation: normalized, relative, no .., no absolute paths
 * - Limits: max file size, max files per session
 * - Idempotency: keyed by (turnId, toolUseId)
 * - Concurrency: writes use version checks (optimistic concurrency)
 * - Diffs: write_file returns before/after
 */

// Track executed tool calls for idempotency
const executedCalls = new Map();

/**
 * Execute a tool call.
 * @param {string} sessionId
 * @param {string} turnId
 * @param {{ id: string, name: string, input: Object }} toolCall
 * @returns {{ output: string, is_error: boolean }}
 */
export async function executeTool(sessionId, turnId, toolCall) {
  const { id: toolUseId, name, input } = toolCall;
  
  // Idempotency check
  const idempotencyKey = `${turnId}:${toolUseId}`;
  if (executedCalls.has(idempotencyKey)) {
    return executedCalls.get(idempotencyKey);
  }

  // Handle malformed tool input
  if (input?._parseError) {
    const result = {
      output: `Error: Could not parse tool arguments. Raw input: ${input._raw?.substring(0, 200)}`,
      is_error: true,
    };
    executedCalls.set(idempotencyKey, result);
    return result;
  }

  let result;
  try {
    switch (name) {
      case 'list_files':
        result = await listFiles(sessionId);
        break;
      case 'read_file':
        result = await readFile(sessionId, input.path);
        break;
      case 'write_file':
        result = await writeFile(sessionId, input.path, input.content, input.expectedVersion);
        break;
      case 'delete_file':
        result = await deleteFile(sessionId, input.path);
        break;
      default:
        result = { output: `Unknown tool: ${name}`, is_error: true };
    }
  } catch (err) {
    result = { output: `Tool execution error: ${err.message}`, is_error: true };
  }

  executedCalls.set(idempotencyKey, result);
  return result;
}

/**
 * Validate a file path.
 */
function validatePath(path) {
  const parsed = filePathSchema.safeParse(path);
  if (!parsed.success) {
    throw new Error(`Invalid path "${path}": ${parsed.error.errors[0]?.message}`);
  }
  return parsed.data;
}

async function listFiles(sessionId) {
  const files = await File.find({ sessionId })
    .select('path version content')
    .lean();

  const manifest = files.map(f => ({
    path: f.path,
    version: f.version,
    bytes: Buffer.byteLength(f.content || '', 'utf8'),
  }));

  return {
    output: JSON.stringify(manifest, null, 2),
    is_error: false,
  };
}

async function readFile(sessionId, path) {
  const validPath = validatePath(path);
  
  const file = await File.findOne({ sessionId, path: validPath }).lean();
  if (!file) {
    return { output: `File not found: ${validPath}`, is_error: true };
  }

  return {
    output: file.content,
    is_error: false,
  };
}

async function writeFile(sessionId, path, content, expectedVersion) {
  const validPath = validatePath(path);

  // Check file size
  if (Buffer.byteLength(content, 'utf8') > config.maxFileSizeBytes) {
    return {
      output: `File too large. Maximum size is ${config.maxFileSizeBytes} bytes.`,
      is_error: true,
    };
  }

  // Check file count limit
  const existingFile = await File.findOne({ sessionId, path: validPath }).lean();
  
  if (!existingFile) {
    const fileCount = await File.countDocuments({ sessionId });
    if (fileCount >= config.maxFilesPerSession) {
      return {
        output: `Maximum files per session (${config.maxFilesPerSession}) reached.`,
        is_error: true,
      };
    }
  }

  // Optimistic concurrency check
  if (expectedVersion !== undefined && existingFile && existingFile.version !== expectedVersion) {
    return {
      output: `Version conflict: expected ${expectedVersion}, current is ${existingFile.version}. Re-read the file before writing.`,
      is_error: true,
    };
  }

  const oldContent = existingFile?.content || null;
  const newVersion = existingFile ? existingFile.version + 1 : 1;

  await File.findOneAndUpdate(
    { sessionId, path: validPath },
    { 
      content,
      version: newVersion,
      updatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  // Generate diff information
  const action = existingFile ? 'updated' : 'created';
  const diffInfo = oldContent !== null
    ? `File ${action} (v${newVersion}). Previous content (${oldContent.length} chars) → New content (${content.length} chars).`
    : `File ${action} (v${newVersion}). New file with ${content.length} chars.`;

  return {
    output: diffInfo,
    is_error: false,
    fileChange: {
      path: validPath,
      action,
      version: newVersion,
      oldContent,
      newContent: content,
    },
  };
}

async function deleteFile(sessionId, path) {
  const validPath = validatePath(path);
  
  const deleted = await File.findOneAndDelete({ sessionId, path: validPath });
  if (!deleted) {
    return { output: `File not found: ${validPath}`, is_error: true };
  }

  return {
    output: `Deleted: ${validPath}`,
    is_error: false,
    fileChange: {
      path: validPath,
      action: 'deleted',
      version: null,
      oldContent: deleted.content,
      newContent: null,
    },
  };
}

/**
 * Clear the idempotency cache for a turn (called when turn completes).
 */
export function clearTurnCache(turnId) {
  for (const [key] of executedCalls) {
    if (key.startsWith(`${turnId}:`)) {
      executedCalls.delete(key);
    }
  }
}
