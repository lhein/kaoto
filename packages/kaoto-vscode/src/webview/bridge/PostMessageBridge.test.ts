// packages/kaoto-vscode/src/webview/bridge/PostMessageBridge.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryEventBus } from '@kaoto/kaoto';
import { PostMessageBridge } from './PostMessageBridge';

interface BridgeMessage {
	type: string;
	payload: unknown;
}

describe('PostMessageBridge', () => {
	let bus: InMemoryEventBus;
	let postMessageMock: (msg: BridgeMessage) => void;
	let capturedMessageHandler: ((event: MessageEvent) => void) | undefined;

	beforeEach(() => {
		bus = new InMemoryEventBus();
		postMessageMock = vi.fn() as (msg: BridgeMessage) => void;
		capturedMessageHandler = undefined;

		vi.spyOn(window, 'addEventListener').mockImplementation((type: string, handler: EventListenerOrEventListenerObject) => {
			if (type === 'message') {
				capturedMessageHandler = handler as (event: MessageEvent) => void;
			}
		});
	});

	it('forwards bus events to postMessage', () => {
		new PostMessageBridge(bus, postMessageMock);
		bus.emit('editor:ready', undefined);
		expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'editor:ready' }));
	});

	it('dispatches incoming postMessage events into the bus', () => {
		new PostMessageBridge(bus, postMessageMock);
		const handler = vi.fn();
		bus.on('editor:document:init', handler);

		capturedMessageHandler!({
			data: { type: 'editor:document:init', payload: { content: 'x', fileUri: 'file:///a.yaml' } },
		} as MessageEvent);

		expect(handler).toHaveBeenCalledWith({ content: 'x', fileUri: 'file:///a.yaml' });
	});

	it('ignores messages with unknown type', () => {
		new PostMessageBridge(bus, postMessageMock);
		const handler = vi.fn();
		bus.on('editor:ready', handler);

		capturedMessageHandler!({ data: { type: '__unknown__', payload: {} } } as MessageEvent);
		expect(handler).not.toHaveBeenCalled();
	});

	it('disposes cleanly', () => {
		const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
		const bridge = new PostMessageBridge(bus, postMessageMock);
		bridge.dispose();
		expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
	});
});
