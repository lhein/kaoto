// packages/ui/src/event-bus/InMemoryEventBus.ts
import type { IEventBus, KaotoEvents, KaotoRequests, KaotoResponses } from './types';

type EventHandler<E extends keyof KaotoEvents> = (payload: KaotoEvents[E]) => void;
type RequestHandler<Req extends keyof KaotoRequests> = (
  payload: KaotoRequests[Req],
) => Promise<KaotoResponses[Req]> | KaotoResponses[Req];

export class InMemoryEventBus implements IEventBus {
  private readonly eventListeners = new Map<string, Set<EventHandler<never>>>();
  private readonly requestHandlers = new Map<string, RequestHandler<never>>();

  emit<E extends keyof KaotoEvents>(event: E, payload: KaotoEvents[E]): void {
    const listeners = this.eventListeners.get(event as string);
    if (!listeners) return;
    for (const handler of listeners) {
      handler(payload as never);
    }
  }

  on<E extends keyof KaotoEvents>(event: E, handler: (payload: KaotoEvents[E]) => void): () => void {
    if (!this.eventListeners.has(event as string)) {
      this.eventListeners.set(event as string, new Set());
    }
    this.eventListeners.get(event as string)!.add(handler as EventHandler<never>);
    return () => {
      this.eventListeners.get(event as string)?.delete(handler as EventHandler<never>);
    };
  }

  handle<Req extends keyof KaotoRequests, Res = KaotoResponses[Req]>(
    req: Req,
    handler: (payload: KaotoRequests[Req]) => Promise<Res> | Res,
  ): () => void {
    this.requestHandlers.set(req as string, handler as RequestHandler<never>);
    return () => {
      this.requestHandlers.delete(req as string);
    };
  }

  async request<Req extends keyof KaotoRequests, Res = KaotoResponses[Req]>(
    req: Req,
    payload: KaotoRequests[Req],
    timeoutMs = 5_000,
  ): Promise<Res> {
    const handler = this.requestHandlers.get(req as string) as RequestHandler<Req> | undefined;

    if (!handler) {
      return new Promise<Res>((_, reject) =>
        setTimeout(() => {
          reject(new Error(`IEventBus request timeout: ${String(req)}`));
        }, timeoutMs),
      );
    }

    return handler(payload) as Promise<Res>;
  }
}
