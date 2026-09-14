import { InMemoryEventBus } from '@kaoto/kaoto';
import { PostMessageBridge } from './bridge/PostMessageBridge';

declare const acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };

const vscodeApi = acquireVsCodeApi();
const bus = new InMemoryEventBus();
// PostMessageBridge monkey-patches bus.emit so all outbound events are
// automatically forwarded via postMessage — no forwardOutbound() calls needed.
new PostMessageBridge(bus, (msg) => vscodeApi.postMessage(msg));

// Signal readiness — host will respond with editor:document:init
bus.emit('editor:ready', undefined);

export { bus };
