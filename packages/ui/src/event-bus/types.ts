// packages/ui/src/event-bus/types.ts

export interface IEventBus {
  emit<E extends keyof KaotoEvents>(event: E, payload: KaotoEvents[E]): void;
  on<E extends keyof KaotoEvents>(
    event: E,
    handler: (payload: KaotoEvents[E]) => void,
  ): () => void;
  request<Req extends keyof KaotoRequests, Res = KaotoResponses[Req]>(
    req: Req,
    payload: KaotoRequests[Req],
    timeoutMs?: number,
  ): Promise<Res>;
  /** Register a handler that responds to a request. Returns an unsubscribe fn. */
  handle<Req extends keyof KaotoRequests, Res = KaotoResponses[Req]>(
    req: Req,
    handler: (payload: KaotoRequests[Req]) => Promise<Res> | Res,
  ): () => void;
}

export type KaotoEvents = {
  // Editor Lifecycle
  'editor:ready': void;
  'editor:undoRedo:performed': { command: 'undo' | 'redo' };
  'editor:undoRedo:requested': { command: 'undo' | 'redo' };
  'editor:notifications:set': { path: string; notifications: unknown[] };
  'editor:step:updated': { action: string; stepType: string; stepName: string };

  // Document Lifecycle
  'editor:document:init': { content: string; fileUri: string; readonly?: boolean };
  'editor:document:changed': { content: string; isDirty: boolean };
  'editor:document:saveRequested': void;
  'editor:document:externalChange': { content: string };

  // Settings & Configuration
  'editor:settings:updated': { settings: Record<string, unknown>; catalogUrl?: string };

  // Theme, Preview & Layout
  'host:theme:changed': { theme: 'light' | 'dark' | 'high-contrast' };
  'host:preview:toggled': { visible: boolean };
  'host:layout:changed': { sidebarPosition?: 'left' | 'right'; panelVisible?: boolean };

  // Host Capabilities & Execution Intents
  'host:capabilities:advertised': {
    canRun?: boolean;
    canDebug?: boolean;
    canTrace?: boolean;
    canDeploy?: boolean;
  };
  'editor:execution:startIntent': { mode: 'run' | 'debug' | 'trace' | 'deploy' };
  'editor:execution:stopIntent': void;
  'host:execution:stateChanged': { status: 'idle' | 'starting' | 'running' | 'stopped' | 'error' };

  // Canvas Overlays (KDP-006 — defined but not wired in this plan)
  'canvas:overlay:setHighlights': { highlights: unknown[] };
  'canvas:overlay:setDecorators': { decorators: unknown[] };
  'canvas:overlay:clear': { nodeIds?: string[]; kind?: 'highlights' | 'decorators' | 'all' };

  // Host UI Feedback
  'host:notification:show': { message: string; type: 'info' | 'warning' | 'error' };
};

export type KaotoRequests = {
  // Document
  'editor:document:getContent': void;
  'editor:document:validate': { content: string };
  'editor:preview:get': void;
  // Metadata
  'editor:metadata:get': { key: string };
  'editor:metadata:set': { key: string; value: unknown };
  // Resources
  'editor:resource:getContent': { path: string };
  'editor:resource:save': { path: string; content: string };
  'editor:resource:exists': { path: string };
  'editor:resource:delete': { path: string };
  'editor:resource:getByType': { fileType: string };
  // Host UI
  'host:ui:pickFile': { include: string; exclude?: string; options?: Record<string, unknown> };
  // Suggestions & Maven
  'editor:suggestions:get': { topic: string; word: string; context: Record<string, unknown> };
  'editor:maven:getRuntimeInfo': void;
};

export type KaotoResponses = {
  // Document
  'editor:document:getContent': { content: string };
  'editor:document:validate': { valid: boolean; errors?: string[] };
  'editor:preview:get': { svg: string | undefined };
  // Metadata
  'editor:metadata:get': { value: unknown };
  'editor:metadata:set': void;
  // Resources
  'editor:resource:getContent': { content: string | undefined };
  'editor:resource:save': void;
  'editor:resource:exists': { exists: boolean };
  'editor:resource:delete': { success: boolean };
  'editor:resource:getByType': { resources: { path: string; content: string }[] };
  // Host UI
  'host:ui:pickFile': { selection: string[] | string | undefined };
  // Suggestions & Maven
  'editor:suggestions:get': { suggestions: { value: string; description?: string; group?: string }[] };
  'editor:maven:getRuntimeInfo': { runtimeInfo: unknown | undefined };
};
