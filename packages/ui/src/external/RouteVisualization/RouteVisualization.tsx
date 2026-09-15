import { VisualizationProvider } from '@patternfly/react-topology';
import { FunctionComponent, useContext, useEffect, useLayoutEffect, useMemo } from 'react';

import { ControllerService } from '../../components/Visualization/Canvas/controller.service';
import { ContextToolbar } from '../../components/Visualization/ContextToolbar/ContextToolbar';
import { CatalogLoaderProvider } from '../../dynamic-catalog/catalog.provider';
import { CatalogTilesProvider } from '../../dynamic-catalog/catalog-tiles.provider';
import { DesignPage } from '../../pages/Design/DesignPage';
import {
  EntitiesProvider,
  KaotoResourceProvider,
  ReloadProvider,
  RuntimeProvider,
  SchemasLoaderProvider,
  VisibleFlowsContext,
  VisibleFlowsProvider,
} from '../../providers';
import { EventNotifier } from '../../utils';

const VisibleFlowsVisualization: FunctionComponent = () => {
  const { visualFlowsApi } = useContext(VisibleFlowsContext)!;

  // `showFlows()` dispatches an action that returns a new `visibleFlows`
  // reference, so depending on `visibleFlows` here would re-run this effect
  // indefinitely. We only need to reveal the flows once per api instance.
  useEffect(() => {
    visualFlowsApi.showFlows();
  }, [visualFlowsApi]);

  return <DesignPage contextToolbar={<ContextToolbar />} />;
};

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
                      <VisibleFlowsVisualization />
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

export const RouteVisualization: FunctionComponent<{
  catalogUrl: string;
  runtimeCatalogName: string;
  testingCatalogName: string;
  code: string;
  codeChange: (code: string) => void;
}> = ({ catalogUrl, runtimeCatalogName, testingCatalogName, code, codeChange }) => {
  const eventNotifier = EventNotifier.getInstance();

  useLayoutEffect(() => {
    return eventNotifier.subscribe('entities:updated', (code: string) => {
      codeChange(code);
    });
  }, [eventNotifier, codeChange]);

  useEffect(() => {
    eventNotifier.next('code:updated', { code });
  }, [code, eventNotifier]);

  return (
    <Viz catalogUrl={catalogUrl} runtimeCatalogName={runtimeCatalogName} testingCatalogName={testingCatalogName} />
  );
};
