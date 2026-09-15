import { VisualizationProvider } from '@patternfly/react-topology';
import { FunctionComponent, useEffect, useLayoutEffect, useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';

import { ControllerService } from '../components/Visualization/Canvas/controller.service';
import { CatalogTilesProvider } from '../dynamic-catalog/catalog-tiles.provider';
import { CatalogLoaderProvider } from '../dynamic-catalog/catalog.provider';
import {
  EntitiesProvider,
  KaotoResourceProvider,
  ReloadProvider,
  RuntimeProvider,
  SchemasLoaderProvider,
  VisibleFlowsProvider,
} from '../providers';
import { EventNotifier } from '../utils';
import { kaotoEditorRouter } from './KaotoEditorRouter';

const Viz: FunctionComponent<{
  catalogUrl: string;
  runtimeCatalogName: string;
  testingCatalogName: string;
}> = ({ catalogUrl, runtimeCatalogName, testingCatalogName }) => {
  const controller = useMemo(() => ControllerService.createController(), []);

  return (
    <ReloadProvider>
      <KaotoResourceProvider>
        <RuntimeProvider
          catalogUrl={catalogUrl}
          runtimeCatalogName={runtimeCatalogName}
          testingCatalogName={testingCatalogName}
        >
          <SchemasLoaderProvider>
            <CatalogLoaderProvider>
              <EntitiesProvider>
                <CatalogTilesProvider>
                  <VisualizationProvider controller={controller}>
                    <VisibleFlowsProvider>
                      <RouterProvider router={kaotoEditorRouter} />
                    </VisibleFlowsProvider>
                  </VisualizationProvider>
                </CatalogTilesProvider>
              </EntitiesProvider>
            </CatalogLoaderProvider>
          </SchemasLoaderProvider>
        </RuntimeProvider>
      </KaotoResourceProvider>
    </ReloadProvider>
  );
};

/**
 * Full Kaoto editor view with tab bar (Design / Beans / Rest / DataMapper / About),
 * toolbar, canvas and properties panel. Requires a SuggestionRegistryProvider ancestor.
 *
 * This is the component to use in the VS Code webview instead of RouteVisualization when
 * the full editor experience (with tabs) is desired.
 */
export const KaotoEditorView: FunctionComponent<{
  catalogUrl: string;
  runtimeCatalogName: string;
  testingCatalogName: string;
  code: string;
  codeChange: (code: string) => void;
}> = ({ catalogUrl, runtimeCatalogName, testingCatalogName, code, codeChange }) => {
  const eventNotifier = EventNotifier.getInstance();

  useLayoutEffect(() => {
    return eventNotifier.subscribe('entities:updated', (newCode: string) => {
      codeChange(newCode);
    });
  }, [eventNotifier, codeChange]);

  useEffect(() => {
    eventNotifier.next('code:updated', { code });
  }, [code, eventNotifier]);

  return (
    <Viz
      catalogUrl={catalogUrl}
      runtimeCatalogName={runtimeCatalogName}
      testingCatalogName={testingCatalogName}
    />
  );
};
