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
import { getRedHatService, TelemetryService } from '@redhat-developer/vscode-redhat-telemetry';
import * as vscode from 'vscode';
import { VIEW_HELP } from '../constants';
import { KaotoOutputChannel } from './KaotoOutputChannel';
import { PortManager } from '../services/PortManager';
import { CamelExecutorFactory } from '../executors/CamelExecutorFactory';
import { KaotoCatalogService } from '../services/KaotoCatalogService';
import { HelpFeedbackProvider } from '../views/help/HelpFeedbackProvider';
import { IRegistrar } from './registrars/IRegistrar';
import { EditorRegistrar } from './registrars/EditorRegistrar';
import { ExecutorRegistrar } from './registrars/ExecutorRegistrar';
import { LifecycleRegistrar } from './registrars/LifecycleRegistrar';
import { IntegrationsRegistrar } from './registrars/IntegrationsRegistrar';
import { DeploymentsRegistrar } from './registrars/DeploymentsRegistrar';
import { TestsRegistrar } from './registrars/TestsRegistrar';
import { InfrastructureRegistrar } from './registrars/InfrastructureRegistrar';
import { OpenApiRegistrar } from './registrars/OpenApiRegistrar';
import { KaotoEditorProvider } from './KaotoEditorProvider';

let telemetryService: TelemetryService;

export async function activate(context: vscode.ExtensionContext) {
	KaotoOutputChannel.logInfo('Kaoto extension is alive.');
	KaotoOutputChannel.logStartupInfo(context);

	// Initialize executor factory with extension context
	CamelExecutorFactory.initialize(context);

	// Register the custom editor provider
	context.subscriptions.push(KaotoEditorProvider.register(context));

	const portManager = new PortManager();

	/*
	 * Initialize Camel Catalog Service
	 */
	const catalogService = new KaotoCatalogService(context);
	await catalogService.initialize();

	// Create and register status bar item
	const catalogStatusBar = catalogService.createStatusBarItem();
	context.subscriptions.push(catalogStatusBar);

	/*
	 * init Red Hat Telemetry
	 */
	const redhatService = await getRedHatService(context);
	telemetryService = await redhatService.getTelemetryService();

	/*
	 * register all views (Integrations, Deployments, Infrastructure, Tests, Help & Feedback, OpenAPI) first to avoid race conditions
	 */
	context.subscriptions.push(vscode.window.registerTreeDataProvider(VIEW_HELP, new HelpFeedbackProvider(context.extensionUri.path)));

	const registrars: IRegistrar[] = [
		new EditorRegistrar(context, telemetryService),
		new IntegrationsRegistrar(context, telemetryService, portManager),
		new DeploymentsRegistrar(context, telemetryService, portManager),
		new InfrastructureRegistrar(context, telemetryService),
		new TestsRegistrar(context, telemetryService),
		new OpenApiRegistrar(context, telemetryService),
		new ExecutorRegistrar(context, telemetryService, catalogService),
		new LifecycleRegistrar(context, telemetryService),
	];

	for (const registrar of registrars) {
		await registrar.register();
	}

	/*
	 * send extension startup event into Red Hat Telemetry
	 */
	await telemetryService.sendStartupEvent();

	KaotoOutputChannel.logInfo('Kaoto extension is successfully setup.');
	console.log('Kaoto extension is successfully setup.');
}

export async function deactivate() {
	await telemetryService.sendShutdownEvent();
	KaotoOutputChannel.dispose();
}
