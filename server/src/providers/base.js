/**
 * Base Provider Adapter Interface
 * 
 * From ARCHITECTURE.md §7:
 * Adapters convert canonical messages and tools to a provider's wire format,
 * and provider responses (including streams) back to canonical.
 * 
 * Both adapters emit the same CanonicalDelta events:
 * text_delta, tool_use_start, tool_input_delta, tool_use_end, usage, stop
 */

/**
 * @typedef {Object} ToolDef
 * @property {string} name
 * @property {string} description
 * @property {Object} inputSchema - JSON Schema for the tool's input
 */

/**
 * @typedef {Object} CanonicalDelta
 * @property {string} type - text_delta | tool_use_start | tool_input_delta | tool_use_end | usage | stop
 * @property {string} [text] - for text_delta
 * @property {string} [id] - for tool_use_start
 * @property {string} [name] - for tool_use_start
 * @property {string} [delta] - for tool_input_delta
 * @property {Object} [input] - for tool_use_end (parsed)
 * @property {Object} [usage] - for usage
 * @property {string} [stopReason] - for stop
 */

export class BaseAdapter {
  constructor(id, capabilities) {
    this.id = id;
    this.capabilities = capabilities;
  }

  /**
   * Convert canonical messages + tools into a provider-specific request.
   * @param {{ system: string, messages: Object[], tools: ToolDef[] }} input
   * @returns {Object} Provider-specific request body
   */
  toRequest(input) {
    throw new Error('toRequest() not implemented');
  }

  /**
   * Execute a streaming request and yield CanonicalDelta events.
   * @param {Object} req - Provider-specific request
   * @param {AbortSignal} signal - Cancellation signal
   * @yields {CanonicalDelta}
   */
  async *stream(req, signal) {
    throw new Error('stream() not implemented');
  }

  /**
   * Estimate token count for messages + system prompt.
   * @param {Object[]} messages
   * @param {string} system
   * @returns {number}
   */
  countTokens(messages, system) {
    // Rough estimate: ~4 chars per token
    let chars = system.length;
    for (const msg of messages) {
      for (const block of msg.blocks || []) {
        if (block.type === 'text') chars += (block.text || '').length;
        else if (block.type === 'tool_use') chars += JSON.stringify(block.input || {}).length + (block.name || '').length;
        else if (block.type === 'tool_result') chars += (block.output || '').length;
      }
    }
    return Math.ceil(chars / 4);
  }
}

/**
 * Tool definitions exposed to the AI agent.
 * The agent can only act through these four tools.
 */
export const AGENT_TOOLS = [
  {
    name: 'list_files',
    description: 'List all files in the session workspace. Returns an array of { path, version, bytes }.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'read_file',
    description: 'Read the content of a file. Returns the file content as a string.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or update a file. Returns a diff showing what changed. If expectedVersion is provided, the write will fail if the file has been modified (optimistic concurrency).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path' },
        content: { type: 'string', description: 'The full content to write' },
        expectedVersion: { type: 'number', description: 'Expected version for optimistic concurrency (optional)' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from the workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path' },
      },
      required: ['path'],
    },
  },
];
