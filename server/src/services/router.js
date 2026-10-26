import { AnthropicAdapter } from '../providers/anthropic.js';
import { OpenAIAdapter } from '../providers/openai.js';
import { classifyError, ErrorClass } from './errors.js';
import { buildHandoffPacket } from './handoff.js';
import ProviderAttempt from '../models/ProviderAttempt.js';
import config from '../config/index.js';

/**
 * Provider Router
 * 
 * From ARCHITECTURE.md §6:
 * Holds the session's fallback chain, calls the active adapter,
 * classifies errors, decides retry / failover / fail.
 * 
 * Every attempt is written to provider_attempts.
 * 
 * Dev-only failure injection: X-Relay-Simulate header
 */

/**
 * Parse a provider string like "anthropic:claude-3-5-sonnet-20241022" into an adapter.
 */
function createAdapter(providerString) {
  const [provider, ...modelParts] = providerString.split(':');
  const model = modelParts.join(':');

  switch (provider) {
    case 'anthropic':
      return new AnthropicAdapter(model || undefined);
    case 'openai':
      return new OpenAIAdapter('openai', model || 'gpt-4o');
    case 'groq':
      return new OpenAIAdapter('groq', model || 'llama-3.1-70b-versatile', 
        'https://api.groq.com/openai/v1', config.openaiCompatApiKey);
    case 'openrouter':
      return new OpenAIAdapter('openrouter', model || 'meta-llama/llama-3.1-70b-instruct',
        'https://openrouter.ai/api/v1', config.openaiCompatApiKey);
    default:
      // Try as OpenAI-compatible
      if (config.openaiCompatBaseUrl) {
        return new OpenAIAdapter(provider, model, config.openaiCompatBaseUrl, config.openaiCompatApiKey);
      }
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export class ProviderRouter {
  /**
   * @param {string[]} fallbackChain - e.g. ["anthropic:claude-...", "openai:gpt-4o"]
   * @param {string} activeProvider - Current provider string
   * @param {string} sessionId
   */
  constructor(fallbackChain, activeProvider, sessionId) {
    this.fallbackChain = fallbackChain;
    this.activeProvider = activeProvider || fallbackChain[0];
    this.sessionId = sessionId;
    this.skippedProviders = new Set();
  }

  /**
   * Get the active adapter.
   */
  getActiveAdapter() {
    return createAdapter(this.activeProvider);
  }

  /**
   * Attempt a completion with retry and failover logic.
   * @param {Object} request - Provider request
   * @param {AbortSignal} signal
   * @param {string} turnId
   * @param {string} [simulateHeader] - X-Relay-Simulate header value
   * @yields {CanonicalDelta} - Streaming events
   */
  async *complete(request, signal, turnId, simulateHeader = null) {
    const startTime = Date.now();
    let retries = 0;
    let currentProvider = this.activeProvider;

    while (true) {
      const adapter = createAdapter(currentProvider);

      // Dev-only failure injection
      if (config.enableSimulation && simulateHeader) {
        const [simError, simProvider] = simulateHeader.split('@');
        if (simProvider === currentProvider.split(':')[0]) {
          const simErr = new Error(`Simulated ${simError}`);
          simErr.status = parseInt(simError) || 500;
          throw simErr;
        }
      }

      try {
        const providerReq = adapter.toRequest(request);

        // Stream the response
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        for await (const delta of adapter.stream(providerReq, signal)) {
          if (delta.type === 'usage') {
            totalInputTokens += delta.usage.inputTokens || 0;
            totalOutputTokens += delta.usage.outputTokens || 0;
          }
          yield delta;
        }

        // Log successful attempt
        await ProviderAttempt.create({
          turnId,
          provider: currentProvider,
          outcome: 'success',
          latencyMs: Date.now() - startTime,
          tokensIn: totalInputTokens,
          tokensOut: totalOutputTokens,
        });

        return; // Success — exit
      } catch (error) {
        const classification = classifyError(error);
        
        // Log failed attempt
        await ProviderAttempt.create({
          turnId,
          provider: currentProvider,
          outcome: classification.class,
          errorClass: classification.reason,
          latencyMs: Date.now() - startTime,
        });

        if (classification.class === ErrorClass.FATAL) {
          throw new Error(`Fatal provider error: ${classification.reason}`);
        }

        if (classification.class === ErrorClass.RETRYABLE && retries < config.maxRetries) {
          retries++;
          // Exponential backoff with jitter
          const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 500, 10000);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        // Failover to next provider
        if (classification.skipProvider) {
          this.skippedProviders.add(currentProvider);
        }

        const nextProvider = this._getNextProvider(currentProvider);
        if (!nextProvider) {
          throw new Error(`All providers exhausted. Last error: ${classification.reason}`);
        }

        // Build handoff packet and signal the handoff
        yield {
          type: 'handoff',
          from: currentProvider,
          to: nextProvider,
          reason: classification.reason,
        };

        currentProvider = nextProvider;
        this.activeProvider = nextProvider;
        retries = 0;
      }
    }
  }

  /**
   * Get the next provider in the fallback chain.
   */
  _getNextProvider(currentProvider) {
    const currentIndex = this.fallbackChain.indexOf(currentProvider);
    
    for (let i = currentIndex + 1; i < this.fallbackChain.length; i++) {
      if (!this.skippedProviders.has(this.fallbackChain[i])) {
        return this.fallbackChain[i];
      }
    }

    // Wrap around (skip current and skipped)
    for (let i = 0; i < currentIndex; i++) {
      if (!this.skippedProviders.has(this.fallbackChain[i])) {
        return this.fallbackChain[i];
      }
    }

    return null;
  }
}
