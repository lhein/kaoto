import { InMemoryEventBus } from '@kaoto/kaoto';
import { PostMessageBridge } from './bridge/PostMessageBridge';

declare const acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };

const vscodeApi = acquireVsCodeApi();
const bus = new InMemoryEventBus();
const bridge = new PostMessageBridge(bus, (msg) => vscodeApi.postMessage(msg));

// Forward all outbound editor events to the host
const outbound = [
  'editor:ready',
  'editor:document:changed',
  'editor:undoRedo:performed',
  'editor:notifications:set',
  'editor:step:updated',
] as const;
for (const event of outbound) {
  bridge.forwardOutbound(event);
}

// Signal readiness — host will respond with editor:document:init
bus.emit('editor:ready', undefined);

export { bus };
