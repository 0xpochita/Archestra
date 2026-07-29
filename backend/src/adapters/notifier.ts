export interface NotifierAdapter {
  send(channel: string, text: string): Promise<void>;
}

export class MemoryNotifier implements NotifierAdapter {
  readonly calls: Array<{ channel: string; text: string }> = [];

  async send(channel: string, text: string): Promise<void> {
    this.calls.push({ channel, text });
  }
}
