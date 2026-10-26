import Anthropic from '@anthropic-ai/sdk';
import { BaseAdapter } from './base.js';
import config from '../config/index.js';

/**
 * Anthropic Adapter
 * 
 * From ARCHITECTURE.md §7.1:
 * - System prompt: top-level `system` field
 * - Tool call arguments: parsed object
 * - Tool results: tool_result block inside a user message
 * - Strict user/assistant role alternation
 * - Tool IDs: toolu_... format
 */
export class AnthropicAdapter extends BaseAdapter {
  constructor(model = 'claude-3-5-sonnet-20241022') {
    super(`anthropic:${model}`, {
      contextWindow: model.includes('sonnet') ? 200000 : 200000,
      parallelTools: true,
    });
    this.model = model;
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
  }

  toRequest({ system, messages, tools }) {
    // Convert canonical messages to Anthropic format
    const anthropicMessages = [];
    
    for (const msg of messages) {
      const content = [];
      for (const block of msg.blocks) {
        if (block.type === 'text') {
          content.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          content.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input || {},
          });
        } else if (block.type === 'tool_result') {
          content.push({
            type: 'tool_result',
            tool_use_id: block.tool_use_id,
            content: block.output || '',
            is_error: block.is_error || false,
          });
        }
      }
      
      if (content.length > 0) {
        anthropicMessages.push({ role: msg.role, content });
      }
    }

    // Ensure strict alternation (Anthropic requires user/assistant/user/...)
    const fixed = this._ensureAlternation(anthropicMessages);

    // Convert tools to Anthropic format
    const anthropicTools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    return {
      model: this.model,
      max_tokens: 4096,
      system,
      messages: fixed,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    };
  }

  async *stream(req, signal) {
    const stream = this.client.messages.stream(req, { signal });
    
    let currentToolId = null;
    let currentToolName = null;
    let toolInputBuffer = '';

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block;
        if (block.type === 'text') {
          // text block starting
        } else if (block.type === 'tool_use') {
          currentToolId = block.id;
          currentToolName = block.name;
          toolInputBuffer = '';
          yield { type: 'tool_use_start', id: block.id, name: block.name };
        }
      } else if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta') {
          yield { type: 'text_delta', text: delta.text };
        } else if (delta.type === 'input_json_delta') {
          toolInputBuffer += delta.partial_json;
          yield { type: 'tool_input_delta', delta: delta.partial_json };
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolId) {
          // Parse accumulated tool input
          let input = {};
          try {
            if (toolInputBuffer) {
              input = JSON.parse(toolInputBuffer);
            }
          } catch (e) {
            // Malformed tool input — will become an error tool_result
            input = { _parseError: true, _raw: toolInputBuffer };
          }
          yield { type: 'tool_use_end', id: currentToolId, name: currentToolName, input };
          currentToolId = null;
          currentToolName = null;
          toolInputBuffer = '';
        }
      } else if (event.type === 'message_delta') {
        if (event.usage) {
          yield {
            type: 'usage',
            usage: {
              inputTokens: event.usage.input_tokens || 0,
              outputTokens: event.usage.output_tokens || 0,
            },
          };
        }
        if (event.delta?.stop_reason) {
          yield { type: 'stop', stopReason: event.delta.stop_reason };
        }
      } else if (event.type === 'message_start') {
        if (event.message?.usage) {
          yield {
            type: 'usage',
            usage: {
              inputTokens: event.message.usage.input_tokens || 0,
              outputTokens: event.message.usage.output_tokens || 0,
            },
          };
        }
      }
    }
  }

  /**
   * Ensure strict user/assistant alternation as required by Anthropic.
   * Merges consecutive same-role messages.
   */
  _ensureAlternation(messages) {
    if (messages.length === 0) return messages;
    
    const result = [messages[0]];
    for (let i = 1; i < messages.length; i++) {
      const prev = result[result.length - 1];
      const curr = messages[i];
      
      if (prev.role === curr.role) {
        // Merge content arrays
        prev.content = [...prev.content, ...curr.content];
      } else {
        result.push(curr);
      }
    }
    
    // Anthropic requires first message to be 'user'
    if (result[0]?.role !== 'user') {
      result.unshift({ role: 'user', content: [{ type: 'text', text: '(session resumed)' }] });
    }
    
    return result;
  }
}
