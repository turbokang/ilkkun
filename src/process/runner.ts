import type { Subprocess } from 'bun';
import type { CLIOptions, Config, NormalizedEvent, AgentType } from '../types';
import type { BaseAdapter } from '../adapters/base';
import { StreamProcessor } from '../stream/processor';
import { SignalHandler } from './signal-handler';

/**
 * Publisher interface that both RedisPublisher and StdoutPublisher implement
 */
interface Publisher {
  publish(event: NormalizedEvent): Promise<void>;
  pushSessionStart(sessionId: string, source: AgentType): Promise<void>;
  pushSessionEnd(sessionId: string, source: AgentType, exitCode: number, durationMs: number): Promise<void>;
  close(): Promise<void>;
}

export class ProcessRunner {
  private process: Subprocess | null = null;
  private startTime: number = 0;

  constructor(
    private adapter: BaseAdapter,
    private options: CLIOptions,
    private config: Config,
    private publisher: Publisher,
    private signalHandler: SignalHandler
  ) {}

  async run(): Promise<number> {
    // Parse extra args if provided
    const extraArgs = this.options.extraArgs
      ? this.parseExtraArgs(this.options.extraArgs)
      : undefined;

    // Build command using adapter
    const command = this.adapter.buildCommand(
      this.options.prompt,
      this.options.cwd,
      extraArgs
    );

    // Create stream processor
    const processor = new StreamProcessor(
      this.adapter,
      this.options.sessionId,
      this.config
    );

    // Record start time
    this.startTime = Date.now();

    // Push session start event
    await this.publisher.pushSessionStart(
      this.options.sessionId,
      this.options.agent
    );

    // Spawn process
    this.process = Bun.spawn({
      cmd: command,
      cwd: this.options.cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    // Register cleanup handler
    this.signalHandler.register(() => this.kill());

    // Set up timeout if specified
    let timeoutId: Timer | null = null;
    if (this.options.timeout && this.options.timeout > 0) {
      timeoutId = setTimeout(() => {
        console.error(`Process timeout after ${this.options.timeout}ms`);
        this.kill();
      }, this.options.timeout);
    }

    // Process stdout stream
    const stdout = this.process.stdout;
    const stdoutPromise = stdout && typeof stdout !== 'number'
      ? this.processStream(stdout, processor, 'stdout')
      : Promise.resolve();

    // Process stderr stream
    const stderr = this.process.stderr;
    const stderrPromise = stderr && typeof stderr !== 'number'
      ? this.processStream(stderr, processor, 'stderr')
      : Promise.resolve();

    // Wait for both streams and process exit
    await Promise.all([stdoutPromise, stderrPromise]);
    const exitCode = await this.process.exited;

    // Clear timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Calculate duration
    const duration = Date.now() - this.startTime;

    // Push session end event
    await this.publisher.pushSessionEnd(
      this.options.sessionId,
      this.options.agent,
      exitCode,
      duration
    );

    return exitCode;
  }

  private async processStream(
    stream: ReadableStream<Uint8Array>,
    processor: StreamProcessor,
    streamType: 'stdout' | 'stderr'
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });

        if (streamType === 'stderr') {
          // Log stderr but don't treat as error events (could be warnings)
          if (this.config.logLevel === 'debug') {
            console.error('[stderr]', text);
          }
        } else {
          // Process stdout chunks through StreamProcessor
          const events = processor.processChunk(text);

          // Publish each normalized event
          for (const event of events) {
            await this.publisher.publish(event);
          }
        }
      }

      // Flush remaining buffer
      if (streamType === 'stdout') {
        const remaining = processor.flush();
        for (const event of remaining) {
          await this.publisher.publish(event);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse extra arguments string into array
   */
  private parseExtraArgs(extraArgs: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < extraArgs.length; i++) {
      const char = extraArgs[i];

      if ((char === '"' || char === "'") && !inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuote) {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      args.push(current);
    }

    return args;
  }

  kill(): void {
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
  }
}
