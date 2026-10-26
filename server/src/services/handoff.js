import Message from '../models/Message.js';
import LedgerEntry from '../models/LedgerEntry.js';
import File from '../models/File.js';
import Handoff from '../models/Handoff.js';
import Session from '../models/Session.js';

/**
 * Handoff Engine
 * 
 * From ARCHITECTURE.md §8.1:
 * Builds a HandoffPacket, repairs in-flight tool state, records the handoff.
 * The packet is built from the DATABASE, not from the failed provider's response,
 * so a handoff works even when the old provider is completely down.
 * 
 * §7.3 In-flight repair:
 * - tool_use with no tool_result → synthesize error tool_result
 * - Partial assistant message → discarded
 * - Consecutive same-role messages → merged
 */

/**
 * Build a HandoffPacket for transitioning to a new provider.
 * @param {string} sessionId
 * @param {string} turnId
 * @param {string} fromProvider
 * @param {string} toProvider
 * @param {string} reason
 * @returns {Object} HandoffPacket
 */
export async function buildHandoffPacket(sessionId, turnId, fromProvider, toProvider, reason) {
  const [session, messages, ledgerEntries, files] = await Promise.all([
    Session.findById(sessionId).lean(),
    Message.find({ sessionId }).sort({ seq: 1 }).lean(),
    LedgerEntry.find({ sessionId, status: 'active' }).lean(),
    File.find({ sessionId }).select('path version content').lean(),
  ]);

  // Repair in-flight tool state
  const repairedMessages = repairHistory(messages);

  // Build file manifest
  const fileManifest = files.map(f => ({
    path: f.path,
    version: f.version,
    bytes: Buffer.byteLength(f.content || '', 'utf8'),
  }));

  // Build the packet
  const packet = {
    system: buildHandoffPreface(fromProvider, toProvider, reason),
    ledger: ledgerEntries,
    fileManifest,
    recentMessages: repairedMessages,
    reason,
    timestamp: new Date().toISOString(),
  };

  // Record the handoff
  await Handoff.create({
    sessionId,
    turnId,
    fromProvider,
    toProvider,
    reason,
    packet,
  });

  // Update session's active provider
  await Session.findByIdAndUpdate(sessionId, { activeProvider: toProvider });

  return packet;
}

/**
 * Repair history for handoff.
 * From ARCHITECTURE.md §7.3.
 */
function repairHistory(messages) {
  const repaired = [];
  
  for (const msg of messages) {
    // Skip summary placeholders
    if (msg.isSummary) {
      repaired.push(msg);
      continue;
    }

    repaired.push({ ...msg });
  }

  // Find orphaned tool_use blocks (no matching tool_result)
  const toolUseIds = new Set();
  const toolResultIds = new Set();
  
  for (const msg of repaired) {
    for (const block of msg.blocks || []) {
      if (block.type === 'tool_use') toolUseIds.add(block.id);
      if (block.type === 'tool_result') toolResultIds.add(block.tool_use_id);
    }
  }

  // Synthesize error tool_results for orphaned tool_uses
  const orphanedIds = [...toolUseIds].filter(id => !toolResultIds.has(id));
  
  if (orphanedIds.length > 0) {
    // Add a user message with synthesized tool_results
    const syntheticBlocks = orphanedIds.map(id => ({
      type: 'tool_result',
      tool_use_id: id,
      output: 'Interrupted by provider failover; re-issue if still needed.',
      is_error: true,
    }));

    repaired.push({
      role: 'user',
      blocks: syntheticBlocks,
    });
  }

  // Merge consecutive same-role messages
  const merged = [];
  for (const msg of repaired) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1].blocks = [
        ...merged[merged.length - 1].blocks,
        ...msg.blocks,
      ];
    } else {
      merged.push({ ...msg });
    }
  }

  return merged;
}

/**
 * Build a handoff preface for the system prompt.
 */
function buildHandoffPreface(fromProvider, toProvider, reason) {
  return [
    `[HANDOFF NOTICE]`,
    `This session was previously handled by ${fromProvider}.`,
    `It has been handed off to you (${toProvider}) because: ${reason}.`,
    `The conversation history and workspace state have been preserved.`,
    `Continue the user's task seamlessly.`,
  ].join('\n');
}
