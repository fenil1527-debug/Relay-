import LedgerEntry from '../models/LedgerEntry.js';

/**
 * Ledger Updater
 * 
 * From ARCHITECTURE.md §8.2:
 * After each turn, extracts decisions, constraints, and TODOs into
 * structured entries. This is a cheap model call that returns a JSON diff.
 * 
 * The ledger is a compact, structured memory that is ALWAYS included
 * regardless of how much history is trimmed.
 * 
 * Kinds: decision, constraint, todo, fact
 * Update: add, update, supersede
 * Supersession: entries are never edited in place
 * 
 * IMPORTANT: Ledger update is best-effort. A failed extraction must
 * never fail a user's turn.
 */

/**
 * Extract ledger updates from new messages.
 * In production, this would use a cheap model call.
 * Here we use rule-based extraction as a fallback / primary approach.
 * 
 * @param {string} sessionId
 * @param {Object[]} newMessages - Messages from the latest turn
 * @param {number} lastSeq - Sequence number of the last message
 */
export async function updateLedger(sessionId, newMessages, lastSeq) {
  try {
    const entries = extractEntries(newMessages, lastSeq);
    
    if (entries.length === 0) return;

    // Get current active entries to check for supersession
    const activeEntries = await LedgerEntry.find({
      sessionId,
      status: 'active',
    }).lean();

    for (const entry of entries) {
      // Check if this supersedes an existing entry
      const superseded = findSuperseded(activeEntries, entry);
      
      const newEntry = await LedgerEntry.create({
        sessionId,
        kind: entry.kind,
        body: entry.body,
        status: 'active',
        sourceSeq: entry.sourceSeq,
      });

      if (superseded) {
        await LedgerEntry.findByIdAndUpdate(superseded._id, {
          status: 'superseded',
          supersededBy: newEntry._id,
        });
      }
    }
  } catch (err) {
    // Best-effort: log but don't fail the turn
    console.error('[Ledger] Update failed (non-fatal):', err.message);
  }
}

/**
 * Extract structured entries from messages using rules.
 */
function extractEntries(messages, lastSeq) {
  const entries = [];

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;

    for (const block of msg.blocks || []) {
      if (block.type !== 'text') continue;
      const text = block.text || '';

      // Extract decisions (lines starting with decision-like patterns)
      const decisionPatterns = [
        /(?:I'll|I will|Let's|We should|We'll|Going to|I'm going to)\s+(?:use|go with|choose|implement|build|create|set up)\s+(.+)/gi,
        /(?:Using|Choosing|Going with)\s+(.+?)(?:\s+(?:because|since|for|as))/gi,
      ];
      
      for (const pattern of decisionPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          entries.push({
            kind: 'decision',
            body: match[0].trim().substring(0, 500),
            sourceSeq: msg.seq || lastSeq,
          });
        }
      }

      // Extract TODOs
      const todoPatterns = [
        /(?:TODO|FIXME|HACK|NOTE):\s*(.+)/gi,
        /(?:Next,? (?:I'll|we need to|we should)|Still need to|Remaining:)\s+(.+)/gi,
      ];
      
      for (const pattern of todoPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          entries.push({
            kind: 'todo',
            body: match[0].trim().substring(0, 500),
            sourceSeq: msg.seq || lastSeq,
          });
        }
      }

      // Extract constraints
      const constraintPatterns = [
        /(?:must|should always|never|always|require|required|important:)\s+(.+)/gi,
      ];
      
      for (const pattern of constraintPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          entries.push({
            kind: 'constraint',
            body: match[0].trim().substring(0, 500),
            sourceSeq: msg.seq || lastSeq,
          });
        }
      }

      // Extract facts from file operations
      if (block.type === 'tool_use' && block.name === 'write_file') {
        entries.push({
          kind: 'fact',
          body: `Created/modified file: ${block.input?.path}`,
          sourceSeq: msg.seq || lastSeq,
        });
      }
    }
  }

  // Deduplicate by body similarity
  const unique = [];
  for (const entry of entries) {
    const isDupe = unique.some(
      e => e.body.toLowerCase() === entry.body.toLowerCase() && e.kind === entry.kind
    );
    if (!isDupe) unique.push(entry);
  }

  return unique.slice(0, 10); // Cap at 10 entries per turn
}

/**
 * Find an existing active entry that should be superseded by a new entry.
 */
function findSuperseded(activeEntries, newEntry) {
  if (newEntry.kind !== 'decision') return null;

  // Simple heuristic: if same kind and bodies are similar
  for (const existing of activeEntries) {
    if (existing.kind !== newEntry.kind) continue;
    
    // Check for keyword overlap
    const existingWords = new Set(existing.body.toLowerCase().split(/\s+/));
    const newWords = newEntry.body.toLowerCase().split(/\s+/);
    const overlap = newWords.filter(w => existingWords.has(w) && w.length > 3).length;
    
    if (overlap >= 3) return existing;
  }
  
  return null;
}

/**
 * Get active ledger entries for a session.
 */
export async function getActiveLedger(sessionId) {
  return LedgerEntry.find({
    sessionId,
    status: { $in: ['active', 'done'] },
  }).sort({ createdAt: 1 }).lean();
}

/**
 * Mark a TODO as done.
 */
export async function completeTodo(entryId) {
  return LedgerEntry.findByIdAndUpdate(entryId, { status: 'done' }, { new: true });
}
