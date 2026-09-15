// Required by @patternfly/react-topology (uses 'global' as an alias for globalThis)
(globalThis as unknown as Record<string, unknown>).global = globalThis;

import '@patternfly/react-core/dist/styles/base.css';
import '@patternfly/react-topology/dist/esm/css/topology-components.css';
import '@patternfly/react-topology/dist/esm/css/topology-view.css';
import '@patternfly/react-topology/dist/esm/css/topology-controlbar.css';
import '@patternfly/react-topology/dist/esm/css/topology-side-bar.css';
import { InMemoryEventBus, RouteVisualization, SuggestionRegistryProvider } from '@kaoto/kaoto';
import React, { createElement, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { PostMessageBridge } from './bridge/PostMessageBridge';

declare const acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };

interface Settings {
	catalogUrl: string;
	runtimeCatalogName: string;
	testingCatalogName: string;
}

const DEFAULT_SETTINGS: Settings = { catalogUrl: '', runtimeCatalogName: '', testingCatalogName: '' };

const vscodeApi = acquireVsCodeApi();
export const bus = new InMemoryEventBus();
// PostMessageBridge monkey-patches bus.emit so all outbound events are
// automatically forwarded via postMessage — no forwardOutbound() calls needed.
new PostMessageBridge(bus, (msg) => vscodeApi.postMessage(msg));

// ---- React app ----

// eslint-disable-next-line @typescript-eslint/naming-convention
const KaotoApp: React.FC = () => {
	const [code, setCode] = useState('');
	const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		// Subscribe to inbound events BEFORE signalling readiness to the host.
		// This prevents the race where editor:document:init arrives before the
		// handler is registered.
		const unsubInit = bus.on('editor:document:init', ({ content }) => {
			setCode(content);
			setReady(true);
		});
		const unsubExternal = bus.on('editor:document:externalChange', ({ content }) => {
			setCode(content);
		});
		const unsubSettings = bus.on('editor:settings:updated', ({ settings: s }) => {
			setSettings((prev: Settings) => ({ ...prev, ...(s as Partial<Settings>) }));
		});

		// Signal readiness only after subscriptions are in place.
		bus.emit('editor:ready', undefined);

		return () => {
			unsubInit();
			unsubExternal();
			unsubSettings();
		};
	}, []);

	if (!ready) {
		return null;
	}

	return createElement(
		MemoryRouter,
		null,
		createElement(
			SuggestionRegistryProvider,
			null,
			createElement(RouteVisualization, {
				catalogUrl: settings.catalogUrl,
				runtimeCatalogName: settings.runtimeCatalogName,
				testingCatalogName: settings.testingCatalogName,
				code,
				codeChange: (newCode: string) => {
					setCode(newCode);
					bus.emit('editor:document:changed', { content: newCode, isDirty: true });
				},
			}),
		),
	);
};

const container = document.getElementById('root');
if (container) {
	createRoot(container).render(createElement(KaotoApp));
}
