// packages/kaoto-vscode/src/webview/bridge/PostMessageBridge.ts
import type { IEventBus, KaotoEvents } from '@kaoto/kaoto/models';

interface BridgeMessage {
  type: string;
  payload: unknown;
  __correlationId?: string;
  __isRequest?: boolean;
  __isResponse?: boolean;
}

export class PostMessageBridge {
  private readonly unsubscribers: Array<() => void> = [];
  private readonly messageHandler: (event: MessageEvent) => void;
  private forwarding = false;

  constructor(
    private readonly bus: IEventBus,
    private readonly postMessage: (msg: BridgeMessage) => void,
  ) {
    // Intercept all outbound bus.emit calls and forward via postMessage.
    // Guard with `forwarding` to avoid re-forwarding inbound messages back out.
    const originalEmit = bus.emit.bind(bus);
    bus.emit = <E extends keyof KaotoEvents>(event: E, payload: KaotoEvents[E]): void => {
      originalEmit(event, payload);
      if (!this.forwarding) {
        this.postMessage({ type: event as string, payload });
      }
    };
    this.unsubscribers.push(() => {
      bus.emit = originalEmit;
    });

    // Inbound: listen on window.message and re-emit into the bus
    this.messageHandler = (event: MessageEvent) => {
      const msg = event.data as BridgeMessage | undefined;
      if (!msg || typeof msg.type !== 'string') return;
      this.forwarding = true;
      try {
        this.bus.emit(msg.type as keyof KaotoEvents, msg.payload as never);
      } finally {
        this.forwarding = false;
      }
    };

    window.addEventListener('message', this.messageHandler);
  }

  /**
   * Subscribe a bus event for outbound forwarding via postMessage.
   * Call once per event the host wants to receive.
   */
  forwardOutbound<E extends keyof KaotoEvents>(event: E): void {
    const unsub = this.bus.on(event, (payload) => {
      this.postMessage({ type: event as string, payload });
    });
    this.unsubscribers.push(unsub);
  }

  dispose(): void {
    window.removeEventListener('message', this.messageHandler);
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
  }
}
