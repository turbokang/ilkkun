export class SignalHandler {
  private handlers: Set<() => Promise<void> | void> = new Set();
  private killed: boolean = false;

  register(handler: () => Promise<void> | void): void {
    this.handlers.add(handler);
  }

  setup(): void {
    const handleSignal = async (signal: string) => {
      if (this.killed) return;

      this.killed = true;
      console.log(`\nReceived ${signal}, cleaning up...`);

      // Run all cleanup handlers
      const cleanupPromises = Array.from(this.handlers).map(async (handler) => {
        try {
          await handler();
        } catch (error) {
          console.error('Error in cleanup handler:', error);
        }
      });

      await Promise.all(cleanupPromises);
      process.exit(0);
    };

    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));
  }

  isKilled(): boolean {
    return this.killed;
  }
}
