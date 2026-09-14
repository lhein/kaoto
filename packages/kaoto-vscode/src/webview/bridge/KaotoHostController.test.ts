// packages/kaoto-vscode/src/webview/bridge/KaotoHostController.test.ts
import { describe, it, expect, vi } from 'vitest';
import { InMemoryEventBus } from '@kaoto/kaoto';
import { KaotoHostController } from './KaotoHostController';
import type { KaotoHostControllerOptions } from './KaotoHostController';

const makePanel = () => ({
  webview: {
    postMessage: vi.fn(),
    onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
  },
  onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
});

const makeOptions = (overrides: Partial<KaotoHostControllerOptions> = {}): KaotoHostControllerOptions => ({
  getSettings: vi.fn().mockResolvedValue({ catalogUrl: '', colorScheme: 'Light' }),
  getContent: vi.fn().mockResolvedValue('content'),
  getMetadata: vi.fn().mockResolvedValue(undefined),
  setMetadata: vi.fn().mockResolvedValue(undefined),
  getResourceContent: vi.fn().mockResolvedValue(undefined),
  saveResourceContent: vi.fn().mockResolvedValue(undefined),
  isResourceExist: vi.fn().mockResolvedValue(false),
  deleteResource: vi.fn().mockResolvedValue(false),
  getResourcesContentByType: vi.fn().mockResolvedValue([]),
  askUserForFileSelection: vi.fn().mockResolvedValue(undefined),
  getSuggestions: vi.fn().mockResolvedValue([]),
  getRuntimeInfoFromMavenContext: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('KaotoHostController', () => {
  it('emits editor:document:init after editor:ready', async () => {
    const bus = new InMemoryEventBus();
    const panel = makePanel();
    const options = makeOptions({ getContent: vi.fn().mockResolvedValue('hello yaml') });

    const controller = new KaotoHostController(bus, options);
    await controller.initialize(panel as never, 'file:///test.camel.yaml');

    bus.emit('editor:ready', undefined);
    await Promise.resolve(); // flush microtasks

    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'editor:document:init', payload: expect.objectContaining({ content: 'hello yaml' }) }),
    );
  });

  it('handles editor:document:getContent request', async () => {
    const bus = new InMemoryEventBus();
    const panel = makePanel();
    const options = makeOptions({ getContent: vi.fn().mockResolvedValue('current yaml') });

    const controller = new KaotoHostController(bus, options);
    await controller.initialize(panel as never, 'file:///test.camel.yaml');

    const result = await bus.request('editor:document:getContent', undefined);
    expect(result).toEqual({ content: 'current yaml' });
  });
});
