// packages/ui/src/event-bus/InMemoryEventBus.test.ts
import { describe, expect, it, vi } from 'vitest';

import { InMemoryEventBus } from './InMemoryEventBus';

describe('InMemoryEventBus', () => {
  it('delivers emitted events to subscribers', () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.on('editor:ready', handler);
    bus.emit('editor:ready', undefined);
    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it('unsubscribes correctly', () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    const unsub = bus.on('editor:ready', handler);
    unsub();
    bus.emit('editor:ready', undefined);
    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers events only to matching subscribers', () => {
    const bus = new InMemoryEventBus();
    const readyHandler = vi.fn();
    const changedHandler = vi.fn();
    bus.on('editor:ready', readyHandler);
    bus.on('editor:document:changed', changedHandler);
    bus.emit('editor:ready', undefined);
    expect(readyHandler).toHaveBeenCalledOnce();
    expect(changedHandler).not.toHaveBeenCalled();
  });

  it('resolves request/reply via handle', async () => {
    const bus = new InMemoryEventBus();
    bus.handle('editor:document:getContent', () => ({ content: 'hello' }));
    const result = await bus.request('editor:document:getContent', undefined);
    expect(result).toEqual({ content: 'hello' });
  });

  it('rejects request on timeout', async () => {
    const bus = new InMemoryEventBus();
    await expect(bus.request('editor:document:getContent', undefined, 50)).rejects.toThrow('timeout');
  });

  it('unregisters handle correctly', async () => {
    const bus = new InMemoryEventBus();
    const unsub = bus.handle('editor:document:getContent', () => ({ content: 'hi' }));
    unsub();
    await expect(bus.request('editor:document:getContent', undefined, 50)).rejects.toThrow('timeout');
  });
});
