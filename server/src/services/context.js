import Message from '../models/Message.js';
import LedgerEntry from '../models/LedgerEntry.js';
import File from '../models/File.js';

/**
 * Context Budgeter
 * 
 * From ARCHITECTURE.md §8.3:
 * 1. Compute budget: contextWindow − reservedOutput − system − ledger − manifest
 * 2. Keep newest messages that fit, preserving complete tool-use/tool-result pairs
 * 3. Summarize older messages if needed
 * 4. If budget still exceeded, signal to fail over to larger-window provider
 */

const RESERVED_OUTPUT = 4096;
const SAFETY_MARGIN = 500;

/**
 * Build the context for a model call.
 * @param {string} sessionId
 * @param {Object} adapter - Provider adapter (has capabilities.contextWindow)
 * @returns {{ system: string, messages: Object[], budgetExceeded: boolean }}
 */
export async function buildContext(sessionId, adapter) {
  // Load all components
  const [ledgerEntries, files, messages] = await Promise.all([
    LedgerEntry.find({ sessionId, status: 'active' }).lean(),
    File.find({ sessionId }).select('path version content').lean(),
    Message.find({ sessionId }).sort({ seq: 1 }).lean(),
  ]);

  // Build system prompt
  const system = buildSystemPrompt(ledgerEntries, files);

  // Calculate budget
  const systemTokens = estimateTokens(system);
  const budget = adapter.capabilities.contextWindow - RESERVED_OUTPUT - systemTokens - SAFETY_MARGIN;

  if (budget <= 0) {
    return { system, messages: [], budgetExceeded: true };
  }

  // Fit messages into budget, newest first
  const fittedMessages = fitMessages(messages, budget);

  return {
    system,
    messages: fittedMessages,
    budgetExceeded: false,
  };
}

/**
 * Build the system prompt from template + ledger + file manifest.
 * The system prompt is assembled per call, never stored as a message.
 */
function buildSystemPrompt(ledgerEntries, files) {
  const parts = [
    `You are Relay, an AI coding assistant. You work with a virtual file system — you can list, read, write, and delete files. You cannot execute code or access the real filesystem.`,
    ``,
    `## Workspace`,
    files.length > 0
      ? `Files in workspace:\n${files.map(f => `- ${f.path} (v${f.version}, ${Buffer.byteLength(f.content || '', 'utf8')} bytes)`).join('\n')}`
      : `The workspace is empty. Use write_file to create files.`,
  ];

  // Inject ledger (structured memory)
  if (ledgerEntries.length > 0) {
    parts.push('');
    parts.push('## Active Decisions & Context');
    for (const entry of ledgerEntries) {
      parts.push(`- [${entry.kind.toUpperCase()}] ${entry.body}`);
    }
  }

  parts.push('');
  parts.push('## Instructions');
  parts.push('- Use the provided tools to manage files in the workspace.');
  parts.push('- Be precise and follow the user\'s instructions carefully.');
  parts.push('- When writing code, write complete files, not fragments.');
  parts.push('- Explain what you\'re doing and why.');

  return parts.join('\n');
}

/**
 * Fit messages into a token budget.
 * Keeps newest messages, preserving complete tool-use/tool-result pairs.
 */
function fitMessages(messages, budget) {
  if (messages.length === 0) return [];

  let totalTokens = 0;
  const included = [];

  // Work backwards from newest
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const tokens = estimateMessageTokens(msg);

    if (totalTokens + tokens > budget) {
      break;
    }

    included.unshift(msg);
    totalTokens += tokens;
  }

  // Ensure we don't break tool-use/tool-result pairs
  // If the oldest included message has a tool_result without its tool_use, include the tool_use
  if (included.length > 0) {
    const firstMsg = included[0];
    const hasOrphanedToolResult = firstMsg.blocks?.some(
      b => b.type === 'tool_result'
    );

    if (hasOrphanedToolResult && included.length < messages.length) {
      // Find the preceding message with the tool_use
      const firstIncludedSeq = firstMsg.seq;
      const precedingMsg = messages.find(m => m.seq === firstIncludedSeq - 1);
      if (precedingMsg) {
        included.unshift(precedingMsg);
      }
    }
  }

  // If we had to trim, prepend a summary indicator
  if (included.length < messages.length) {
    const trimmedCount = messages.length - included.length;
    included.unshift({
      role: 'user',
      blocks: [{
        type: 'text',
        text: `[${trimmedCount} earlier messages were trimmed to fit the context window. Key decisions are preserved in the ledger above.]`,
      }],
      isSummary: true,
    });
  }

  return included;
}

/**
 * Rough token estimate (~4 chars per token).
 */
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function estimateMessageTokens(msg) {
  let chars = 10; // overhead
  for (const block of msg.blocks || []) {
    if (block.type === 'text') chars += (block.text || '').length;
    else if (block.type === 'tool_use') chars += JSON.stringify(block.input || {}).length + (block.name || '').length;
    else if (block.type === 'tool_result') chars += (block.output || '').length;
  }
  return Math.ceil(chars / 4);
}
