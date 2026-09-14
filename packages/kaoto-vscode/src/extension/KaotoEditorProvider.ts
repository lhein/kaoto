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

export class KaotoEditorProvider implements vscode.CustomTextEditorProvider {
  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      KAOTO_EDITOR_VIEW_TYPE,
      new KaotoEditorProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } },
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const bus = new InMemoryEventBus();
    const options = this.buildOptions(document);
    const controller = new KaotoHostController(bus, options);
    await controller.initialize(panel, document.uri.toString());
  }

  private buildOptions(document: vscode.TextDocument): KaotoHostControllerOptions {
    return {
      getSettings: async () => ({}),
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
        getSuggestions(topic, word, context, document.uri.fsPath),
      getRuntimeInfoFromMavenContext: () =>
        MavenRuntimeDetector.getRuntimeInfoFromMavenContext(document.uri.fsPath),
    };
  }
}
