import OpenAI from 'openai';
import { BaseAdapter } from './base.js';
import config from '../config/index.js';

/**
 * OpenAI-compatible Adapter
 * 
 * Works with OpenAI, Groq, OpenRouter, and any OpenAI-compatible API.
 * 
 * From ARCHITECTURE.md §7.1:
 * - System prompt: first message with role "system"
 * - Tool call arguments: JSON string (may be malformed/partial in streams)
 * - Tool results: separate role "tool" message
 * - Permissive role alternation
 * - Tool IDs: call_... format
 */
export class OpenAIAdapter extends BaseAdapter {
  constructor(providerId = 'openai', model = 'gpt-4o', baseURL = null, apiKey = null) {
    const contextWindows = {
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-3.5-turbo': 16384,
    };

    super(`${providerId}:${model}`, {
      contextWindow: contextWindows[model] || 128000,
      parallelTools: true,
    });

    this.model = model;
    this.client = new OpenAI({
      apiKey: apiKey || config.openaiApiKey,
      baseURL: baseURL || undefined,
    });
  }

  toRequest({ system, messages, tools }) {
    // System prompt as first message
    const openaiMessages = [
      { role: 'system', content: system },
    ];

    // Convert canonical messages to OpenAI format
    for (const msg of messages) {
      if (msg.role === 'assistant') {
        const content = [];
        const toolCalls = [];

        for (const block of msg.blocks) {
          if (block.type === 'text') {
            content.push(block.text);
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              type: 'function',
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input || {}),
              },
            });
          }
        }

        const openaiMsg = { role: 'assistant' };
        if (content.length > 0) openaiMsg.content = content.join('\n');
        if (toolCalls.length > 0) openaiMsg.tool_calls = toolCalls;
        if (!openaiMsg.content && toolCalls.length === 0) openaiMsg.content = '';
        openaiMessages.push(openaiMsg);
      } else if (msg.role === 'user') {
        // User messages may contain tool_results
        const toolResults = msg.blocks.filter(b => b.type === 'tool_result');
        const textBlocks = msg.blocks.filter(b => b.type === 'text');

        // Tool results become separate role:"tool" messages
        for (const tr of toolResults) {
          openaiMessages.push({
            role: 'tool',
            tool_call_id: tr.tool_use_id,
            content: tr.output || '',
          });
        }

        // Regular text from user
        if (textBlocks.length > 0) {
          openaiMessages.push({
            role: 'user',
            content: textBlocks.map(b => b.text).join('\n'),
          });
        }
      }
    }

    // Convert tools to OpenAI format
    const openaiTools = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    return {
      model: this.model,
      max_tokens: 4096,
      messages: openaiMessages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      stream: true,
    };
  }

  async *stream(req, signal) {
    const stream = await this.client.chat.completions.create(req, { signal });

    const toolCalls = new Map(); // index → { id, name, args }

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta;
      if (!delta) continue;

      // Text content
      if (delta.content) {
        yield { type: 'text_delta', text: delta.content };
      }

      // Tool calls (OpenAI streams these incrementally)
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          
          if (!toolCalls.has(idx)) {
            toolCalls.set(idx, { id: tc.id || '', name: '', args: '' });
          }
          
          const tracked = toolCalls.get(idx);
          
          if (tc.id) tracked.id = tc.id;
          if (tc.function?.name) {
            tracked.name = tc.function.name;
            yield { type: 'tool_use_start', id: tracked.id, name: tracked.name };
          }
          if (tc.function?.arguments) {
            tracked.args += tc.function.arguments;
            yield { type: 'tool_input_delta', delta: tc.function.arguments };
          }
        }
      }

      // Finish reason
      if (choice.finish_reason) {
        // Emit tool_use_end for all accumulated tool calls
        for (const [, tc] of toolCalls) {
          let input = {};
          try {
            if (tc.args) input = JSON.parse(tc.args);
          } catch (e) {
            input = { _parseError: true, _raw: tc.args };
          }
          yield { type: 'tool_use_end', id: tc.id, name: tc.name, input };
        }
        toolCalls.clear();

        yield { type: 'stop', stopReason: choice.finish_reason };
      }

      // Usage info
      if (chunk.usage) {
        yield {
          type: 'usage',
          usage: {
            inputTokens: chunk.usage.prompt_tokens || 0,
            outputTokens: chunk.usage.completion_tokens || 0,
          },
        };
      }
    }
  }
}
