// packages/kaoto-vscode/src/webview/bridge/KaotoHostController.ts
import type { IEventBus, KaotoEvents } from '@kaoto/kaoto/models';
import type * as vscode from 'vscode';

export interface KaotoHostControllerOptions {
	getSettings: () => Promise<Record<string, unknown>>;
	getContent: () => Promise<string>;
	getMetadata: (key: string) => Promise<unknown>;
	setMetadata: (key: string, value: unknown) => Promise<void>;
	getResourceContent: (path: string) => Promise<string | undefined>;
	saveResourceContent: (path: string, content: string) => Promise<void>;
	isResourceExist: (path: string) => Promise<boolean>;
	deleteResource: (path: string) => Promise<boolean>;
	getResourcesContentByType: (fileType: string) => Promise<{ path: string; content: string }[]>;
	askUserForFileSelection: (include: string, exclude?: string, options?: Record<string, unknown>) => Promise<string[] | string | undefined>;
	getSuggestions: (topic: string, word: string, context: Record<string, unknown>) => Promise<{ value: string; description?: string; group?: string }[]>;
	getRuntimeInfoFromMavenContext: () => Promise<unknown | undefined>;
}

interface BridgeMessage {
	type: string;
	payload: unknown;
}

export class KaotoHostController {
	private readonly disposables: Array<{ dispose(): void }> = [];
	private fileUri = '';

	constructor(
		private readonly bus: IEventBus,
		private readonly options: KaotoHostControllerOptions,
	) {}

	async initialize(panel: vscode.WebviewPanel, fileUri: string): Promise<void> {
		this.fileUri = fileUri;

		// Pre-fetch content and settings so the editor:ready handler can emit synchronously.
		const [initialContent, initialSettings] = await Promise.all([this.options.getContent(), this.options.getSettings()]);

		// Inbound: messages from the webview
		this.disposables.push(
			panel.webview.onDidReceiveMessage((msg: BridgeMessage) => {
				if (msg?.type) {
					this.bus.emit(msg.type as keyof KaotoEvents, msg.payload as never);
				}
			}),
		);

		// Outbound: forward bus events to the webview
		const outboundEvents: Array<keyof KaotoEvents> = [
			'editor:document:init',
			'editor:document:externalChange',
			'editor:settings:updated',
			'host:theme:changed',
			'host:notification:show',
			'host:capabilities:advertised',
			'host:execution:stateChanged',
		];
		for (const event of outboundEvents) {
			this.disposables.push({
				dispose: this.bus.on(event, (payload) => {
					void panel.webview.postMessage({ type: event, payload });
				}),
			});
		}

		// editor:ready → push document init + settings synchronously from pre-fetched values
		this.disposables.push({
			dispose: this.bus.on('editor:ready', () => {
				this.bus.emit('editor:document:init', { content: initialContent, fileUri: this.fileUri });
				this.bus.emit('editor:settings:updated', { settings: initialSettings });
			}),
		});

		// Register request handlers
		this.disposables.push({
			dispose: this.bus.handle('editor:document:getContent', async () => ({
				content: await this.options.getContent(),
			})),
		});
		this.disposables.push({
			dispose: this.bus.handle('editor:metadata:get', async ({ key }) => ({
				value: await this.options.getMetadata(key),
			})),
		});
		this.disposables.push({
			dispose: this.bus.handle('editor:metadata:set', async ({ key, value }) => {
				await this.options.setMetadata(key, value);
			}),
		});
		this.disposables.push({
			dispose: this.bus.handle('editor:resource:getContent', async ({ path }) => ({
				content: await this.options.getResourceContent(path),
			})),
		});
		this.disposables.push({
			dispose: this.bus.handle('editor:resource:save', async ({ path, content }) => {
				await this.options.saveResourceContent(path, content);
			}),
		});
		this.disposables.push({
			dispose: this.bus.handle('editor:resource:exists', async ({ path }) => ({
				exists: await this.options.isResourceExist(path),
			})),
		});
		this.disposables.push({
			dispose: this.bus.handle('editor:resource:delete', async ({ path }) => ({
				success: await this.options.deleteResource(path),
			})),
		});
		this.disposables.push({
			dispose: this.bus.handle('editor:resource:getByType', async ({ fileType }) => ({
				resources: await this.options.getResourcesContentByType(fileType),
			})),
		});
		this.disposables.push({
			dispose: this.bus.handle('host:ui:pickFile', async ({ include, exclude, options }) => ({
				selection: await this.options.askUserForFileSelection(include, exclude, options),
			})),
		});
		this.disposables.push({
			dispose: this.bus.handle('editor:suggestions:get', async ({ topic, word, context }) => ({
				suggestions: await this.options.getSuggestions(topic, word, context),
			})),
		});
		this.disposables.push({
			dispose: this.bus.handle('editor:maven:getRuntimeInfo', async () => ({
				runtimeInfo: await this.options.getRuntimeInfoFromMavenContext(),
			})),
		});

		const onDisposeSub = panel.onDidDispose(() => this.dispose());
		this.disposables.push({ dispose: () => onDisposeSub.dispose() });
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
		this.disposables.length = 0;
	}
}
