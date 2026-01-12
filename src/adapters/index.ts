/**
 * Adapter factory and exports
 */

import type { AgentType } from '../types';
import { BaseAdapter } from './base';
import { ClaudeAdapter } from './claude';
import { GeminiAdapter } from './gemini';
import { CodexAdapter } from './codex';

/**
 * Get the appropriate adapter instance for the given agent type
 */
export function getAdapter(agent: AgentType): BaseAdapter {
  switch (agent) {
    case 'claude':
      return new ClaudeAdapter();
    case 'gemini':
      return new GeminiAdapter();
    case 'codex':
      return new CodexAdapter();
    default:
      throw new Error(`Unknown agent type: ${agent}`);
  }
}

/**
 * Export all adapter classes
 */
export { BaseAdapter } from './base';
export { ClaudeAdapter } from './claude';
export { GeminiAdapter } from './gemini';
export { CodexAdapter } from './codex';
