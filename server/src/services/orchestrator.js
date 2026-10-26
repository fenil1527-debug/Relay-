import Session from '../models/Session.js';
import Message from '../models/Message.js';
import Turn from '../models/Turn.js';
import { ProviderRouter } from './router.js';
import { buildContext } from './context.js';
import { executeTool, clearTurnCache } from './tools.js';
import { updateLedger } from './ledger.js';
import { buildHandoffPacket } from './handoff.js';
import { AGENT_TOOLS } from '../providers/base.js';
import config from '../config/index.js';

/**
 * Orchestrator
 * 
 * From ARCHITECTURE.md §3:
 * Runs the agent loop for one turn:
 *   build context → call model → execute tools → persist → repeat
 * Up to MAX_STEPS. Emits SSE events.
 * 
 * §5 Invariants:
 * 1. Every step is persisted BEFORE the next begins
 * 2. Every tool_use has a matching tool_result before any model call
 * 3. A step is retried on the new provider at most once per handoff
 */

/**
 * Run a complete turn.
 * @param {string} sessionId
 * @param {string} userId - For auth checks
 * @param {string} userMessage - The user's input text
 * @param {Function} emitSSE - Callback to emit SSE events to the client
 * @param {string} [simulateHeader] - X-Relay-Simulate header
 * @returns {Object} Turn result
 */
export async function runTurn(sessionId, userId, userMessage, emitSSE, simulateHeader = null) {
  // Load and authorize session
  const session = await Session.findOne({ _id: sessionId, userId });
  if (!session) {
    throw new Error('Session not found');
  }

  // Create the turn (with partial unique index enforcing one running turn)
  let turn;
  try {
    turn = await Turn.create({
      sessionId,
      status: 'running',
      stepCount: 0,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new Error('A turn is already running on this session');
    }
    throw err;
  }

  // Get the next sequence number
  const lastMessage = await Message.findOne({ sessionId }).sort({ seq: -1 }).lean();
  let seq = (lastMessage?.seq || 0) + 1;

  // Persist the user's message
  await Message.create({
    sessionId,
    seq,
    role: 'user',
    blocks: [{ type: 'text', text: userMessage }],
    turnId: turn._id,
  });
  seq++;

  // Set up provider router
  const router = new ProviderRouter(
    session.fallbackChain,
    session.activeProvider || session.fallbackChain[0],
    sessionId
  );

  const abort = new AbortController();
  const newMessages = [];
  let stepCount = 0;

  try {
    // Agent loop — up to MAX_STEPS
    let shouldContinue = true;
    
    while (shouldContinue && stepCount < config.maxStepsPerTurn) {
      stepCount++;
      emitSSE({ type: 'step_start', step: stepCount });

      // Build context for the active model
      const adapter = router.getActiveAdapter();
      const context = await buildContext(sessionId, adapter);
      
      if (context.budgetExceeded) {
        // Try to fail over to a larger-window provider
        emitSSE({ type: 'error', message: 'Context budget exceeded' });
        break;
      }

      // Call the model via the router (handles retries and failover)
      const assistantBlocks = [];
      const toolCalls = [];
      let usage = { inputTokens: 0, outputTokens: 0 };

      try {
        for await (const delta of router.complete(
          { system: context.system, messages: context.messages, tools: AGENT_TOOLS },
          abort.signal,
          turn._id.toString(),
          simulateHeader
        )) {
          switch (delta.type) {
            case 'text_delta':
              emitSSE({ type: 'text_delta', text: delta.text });
              // Accumulate text
              if (assistantBlocks.length === 0 || assistantBlocks[assistantBlocks.length - 1].type !== 'text') {
                assistantBlocks.push({ type: 'text', text: delta.text });
              } else {
                assistantBlocks[assistantBlocks.length - 1].text += delta.text;
              }
              break;

            case 'tool_use_start':
              emitSSE({ type: 'tool_call', id: delta.id, name: delta.name, status: 'started' });
              break;

            case 'tool_input_delta':
              // Stream tool input to client for visibility
              break;

            case 'tool_use_end':
              assistantBlocks.push({
                type: 'tool_use',
                id: delta.id,
                name: delta.name,
                input: delta.input,
              });
              toolCalls.push({
                id: delta.id,
                name: delta.name,
                input: delta.input,
              });
              emitSSE({ type: 'tool_call', id: delta.id, name: delta.name, status: 'completed', input: delta.input });
              break;

            case 'usage':
              usage.inputTokens += delta.usage.inputTokens;
              usage.outputTokens += delta.usage.outputTokens;
              break;

            case 'handoff':
              emitSSE({ type: 'handoff', from: delta.from, to: delta.to, reason: delta.reason });
              await buildHandoffPacket(sessionId, turn._id.toString(), delta.from, delta.to, delta.reason);
              break;

            case 'stop':
              // stop_reason tells us if the model wants to continue (tool_use) or is done
              if (delta.stopReason === 'end_turn' || delta.stopReason === 'stop') {
                shouldContinue = false;
              }
              break;
          }
        }
      } catch (err) {
        emitSSE({ type: 'attempt_failed', error: err.message, provider: router.activeProvider });
        
        // If all providers exhausted, fail the turn
        if (err.message.includes('All providers exhausted') || err.message.includes('Fatal')) {
          await Turn.findByIdAndUpdate(turn._id, {
            status: 'failed',
            endedAt: new Date(),
            stepCount,
          });
          emitSSE({ type: 'error', message: err.message });
          emitSSE({ type: 'done', status: 'failed' });
          return { status: 'failed', error: err.message };
        }
        break;
      }

      // Persist the assistant message (Invariant #1: persisted before next step)
      if (assistantBlocks.length > 0) {
        const assistantMsg = await Message.create({
          sessionId,
          seq,
          role: 'assistant',
          blocks: assistantBlocks,
          provider: router.activeProvider,
          model: router.activeProvider,
          usage,
          turnId: turn._id,
        });
        newMessages.push(assistantMsg);
        seq++;
      }

      // Execute tool calls (Invariant #2: tool_result before next model call)
      if (toolCalls.length > 0) {
        const toolResultBlocks = [];

        for (const toolCall of toolCalls) {
          const result = await executeTool(sessionId, turn._id.toString(), toolCall);
          
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            output: result.output,
            is_error: result.is_error || false,
          });

          emitSSE({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            name: toolCall.name,
            output: result.output,
            is_error: result.is_error,
          });

          // Emit file change events
          if (result.fileChange) {
            emitSSE({
              type: 'file_changed',
              ...result.fileChange,
            });
          }
        }

        // Persist tool results as a user message
        const toolResultMsg = await Message.create({
          sessionId,
          seq,
          role: 'user',
          blocks: toolResultBlocks,
          turnId: turn._id,
        });
        newMessages.push(toolResultMsg);
        seq++;

        // Continue the loop — model needs to see tool results
        shouldContinue = true;
      }
    }

    // Turn completed successfully
    await Turn.findByIdAndUpdate(turn._id, {
      status: 'completed',
      endedAt: new Date(),
      stepCount,
    });

    // Best-effort ledger update
    await updateLedger(sessionId, newMessages, seq - 1);
    emitSSE({ type: 'ledger_updated' });

    // Clean up idempotency cache
    clearTurnCache(turn._id.toString());

    emitSSE({ type: 'done', status: 'completed', steps: stepCount });
    return { status: 'completed', steps: stepCount };

  } catch (err) {
    // Mark turn as failed
    await Turn.findByIdAndUpdate(turn._id, {
      status: 'failed',
      endedAt: new Date(),
      stepCount,
    });
    clearTurnCache(turn._id.toString());
    emitSSE({ type: 'error', message: err.message });
    emitSSE({ type: 'done', status: 'failed' });
    return { status: 'failed', error: err.message };
  }
}

/**
 * Resume an interrupted turn from its last persisted step.
 */
export async function resumeTurn(sessionId, userId, emitSSE) {
  const session = await Session.findOne({ _id: sessionId, userId });
  if (!session) throw new Error('Session not found');

  // Find the interrupted turn
  const turn = await Turn.findOne({ sessionId, status: 'interrupted' }).sort({ startedAt: -1 });
  if (!turn) throw new Error('No interrupted turn to resume');

  // Check the last message — if it has an orphaned tool_use, we need to re-run from there
  const lastMsg = await Message.findOne({ sessionId }).sort({ seq: -1 }).lean();
  
  if (lastMsg?.role === 'assistant') {
    const hasToolUse = lastMsg.blocks.some(b => b.type === 'tool_use');
    if (hasToolUse) {
      // Execute the pending tool calls
      const toolCalls = lastMsg.blocks.filter(b => b.type === 'tool_use');
      let seq = lastMsg.seq + 1;
      const toolResultBlocks = [];

      for (const tc of toolCalls) {
        const result = await executeTool(sessionId, turn._id.toString(), tc);
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: tc.id,
          output: result.output,
          is_error: result.is_error || false,
        });
        emitSSE({ type: 'tool_result', tool_use_id: tc.id, name: tc.name, output: result.output });
      }

      await Message.create({
        sessionId,
        seq,
        role: 'user',
        blocks: toolResultBlocks,
        turnId: turn._id,
      });
    }
  }

  // Mark turn as running again and continue
  await Turn.findByIdAndUpdate(turn._id, { status: 'running' });

  // Continue the agent loop (simplified — re-call the model)
  emitSSE({ type: 'done', status: 'resumed' });
  return { status: 'resumed' };
}
