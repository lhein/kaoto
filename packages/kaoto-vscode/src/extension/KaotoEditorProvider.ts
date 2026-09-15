/**
 * Copyright 2025 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { InMemoryEventBus } from '@kaoto/kaoto';
import * as path from 'path'; // NOSONAR
import * as vscode from 'vscode';
import { KAOTO_EDITOR_VIEW_TYPE } from '../constants';
import { MavenRuntimeDetector } from '../services/MavenRuntimeDetector';
import { getSuggestions } from '../services/SuggestionRegistry';
import { KaotoHostController, KaotoHostControllerOptions } from '../webview/bridge';

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export class KaotoEditorProvider implements vscode.CustomTextEditorProvider {
	static register(context: vscode.ExtensionContext): vscode.Disposable {
		return vscode.window.registerCustomEditorProvider(KAOTO_EDITOR_VIEW_TYPE, new KaotoEditorProvider(context), {
			webviewOptions: { retainContextWhenHidden: true },
		});
	}

	constructor(private readonly context: vscode.ExtensionContext) {}

	async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void> {
		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
		};
		panel.webview.html = this.getWebviewHtml(panel.webview);

		const bus = new InMemoryEventBus();
		const catalogUrl = this.getCatalogUrl(panel.webview);
		const options = this.buildOptions(document, catalogUrl);
		const controller = new KaotoHostController(bus, options);
		await controller.initialize(panel, document.uri.toString());
	}

	private getCatalogUrl(webview: vscode.Webview): string {
		const customCatalogUrl = vscode.workspace.getConfiguration().get<string | null>('kaoto.catalog.url')?.trim();
		if (customCatalogUrl) {
			return customCatalogUrl;
		}
		return webview
			.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'editors', 'kaoto', 'camel-catalog', 'index.json'))
			.toString();
	}

	private getWebviewHtml(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'KaotoWebviewApp.js'));
		const nonce = getNonce();
		return `<!DOCTYPE html>
<html lang="en">
<head>
		<meta charset="UTF-8">
		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:; connect-src ${webview.cspSource};">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Kaoto</title>
		<style>
			html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
			#root > *, .canvas-surface, .pf-v6-c-page, .pf-v6-c-page__main,
			.pf-topology-container, .pf-topology-content,
			#topology-resize-panel, .pf-v6-c-drawer, .pf-v6-c-drawer__main,
			.pf-v6-c-drawer__content, .pf-v6-c-drawer__panel { height: 100% !important; }
		</style>
</head>
<body>
		<div id="root"></div>
		<script nonce="${nonce}">window.__webpack_nonce__ = '${nonce}';</script>
		<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	private buildOptions(document: vscode.TextDocument, catalogUrl: string): KaotoHostControllerOptions {
		return {
			getSettings: async () => ({ catalogUrl }),
			getContent: async () => document.getText(),
			getMetadata: async (_key) => undefined,
			setMetadata: async (_key, _value) => {},
			getResourceContent: async (relativePath) => {
				try {
					const targetFile = path.resolve(path.dirname(document.uri.fsPath), relativePath);
					return new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(targetFile)));
				} catch {
					return undefined;
				}
			},
			saveResourceContent: async (relativePath, content) => {
				const targetFile = path.resolve(path.dirname(document.uri.fsPath), relativePath);
				await vscode.workspace.fs.writeFile(vscode.Uri.file(targetFile), new TextEncoder().encode(content));
			},
			isResourceExist: async (relativePath) => {
				try {
					const targetFile = path.resolve(path.dirname(document.uri.fsPath), relativePath);
					await vscode.workspace.fs.stat(vscode.Uri.file(targetFile));
					return true;
				} catch {
					return false;
				}
			},
			deleteResource: async (relativePath) => {
				try {
					const targetFile = path.resolve(path.dirname(document.uri.fsPath), relativePath);
					await vscode.workspace.fs.delete(vscode.Uri.file(targetFile));
					return true;
				} catch {
					return false;
				}
			},
			getResourcesContentByType: async (_fileType) => [],
			askUserForFileSelection: async (_include, _exclude, _options) => undefined,
			getSuggestions: (topic, word, context) =>
				getSuggestions(topic, word, context as import('../services/SuggestionRegistry').SuggestionRequestContext, document.uri.fsPath),
			getRuntimeInfoFromMavenContext: () => MavenRuntimeDetector.getRuntimeInfoFromMavenContext(document.uri.fsPath),
		};
	}
}
