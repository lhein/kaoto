import { FunctionComponent, ReactNode, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { ExportDocumentPreviewModal } from '../../components/Visualization/ContextToolbar/ExportDocument/ExportDocumentPreviewModal';
import { HiddenCanvas } from '../../components/Visualization/ContextToolbar/FlowExportImage/HiddenCanvas';
import { useGraphLayout } from '../../components/Visualization/Custom/hooks/use-graph-layout.hook';
import { useCanvasEntities } from '../../hooks/useCanvasEntities';
import { useVisibleVizNodes } from '../../hooks/use-visible-viz-nodes';
import { sourceSchemaConfig } from '../../models/camel';
import { EntityType } from '../../models/entities';
import { EntitiesContext, VisibleFlowsContext } from '../../providers';

/** SPIKE: a route on the canvas and whether it is shown */
export interface CanvasRoute {
  id: string;
  visible: boolean;
}

/** SPIKE: something the New menu can add, e.g. a route or a REST configuration */
export interface CanvasNewEntity {
  name: string;
  title: string;
  description?: string;
}

/**
 * SPIKE: the state and actions of the canvas toolbar, without any UI. The host draws the controls itself, e.g. with
 * Carbon, and calls the actions; the canvas keeps the logic.
 */
export interface CanvasTools {
  routes: CanvasRoute[];
  toggleRoute(id: string): void;
  /** Shows only this route */
  focusRoute(id: string): void;
  showAllRoutes(): void;
  hideAllRoutes(): void;

  /** Whether the file can hold more than one route, so the New menu makes sense */
  canAddEntities: boolean;
  newEntities: CanvasNewEntity[];
  newEntityGroups: Record<string, CanvasNewEntity[]>;
  addEntity(name: string): void;

  /** There are shown routes to export */
  canExport: boolean;
  isExportingImage: boolean;
  exportImage(): void;
  openDocumentation(): void;
}

export type RenderCanvasTools = (tools: CanvasTools) => ReactNode;

/** Draws the visible flows on a hidden canvas and downloads them, once they are resolved (from #4980) */
const ImageExport: FunctionComponent<{ onComplete: () => void }> = ({ onComplete }) => {
  const visualEntities = useContext(EntitiesContext)?.visualEntities ?? [];
  const { visibleFlows } = useContext(VisibleFlowsContext)!;
  const { vizNodes, isResolving } = useVisibleVizNodes(visualEntities, visibleFlows);
  const layout = useGraphLayout();

  if (isResolving) return null;
  return <HiddenCanvas autoDownload vizNodes={vizNodes} layout={layout} onComplete={onComplete} />;
};

/**
 * SPIKE: builds the {@link CanvasTools} inside the providers of the canvas and renders what the host makes of them into
 * the host's element. The portal keeps the contexts, so the host's controls work as if they sat in the canvas.
 */
export const CanvasToolsPortal: FunctionComponent<{ container: HTMLElement; render: RenderCanvasTools }> = ({
  container,
  render,
}) => {
  const entitiesContext = useContext(EntitiesContext);
  const visualEntities = entitiesContext?.visualEntities ?? [];
  const currentSchemaType = entitiesContext?.currentSchemaType;
  const { visibleFlows, visualFlowsApi } = useContext(VisibleFlowsContext)!;
  const { commonEntities, groupedEntities, createEntity } = useCanvasEntities();
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isDocumentationOpen, setIsDocumentationOpen] = useState(false);

  const routes = useMemo(
    () => visualEntities.map((entity) => ({ id: entity.id, visible: !!visibleFlows[entity.id] })),
    [visualEntities, visibleFlows],
  );
  const canExport = routes.some((route) => route.visible);

  const toEntity = ({ name, title, description }: CanvasNewEntity) => ({ name, title, description });

  const tools: CanvasTools = {
    routes,
    toggleRoute: (id) => {
      visualFlowsApi.toggleFlowVisible(id);
    },
    focusRoute: (id) => {
      visualFlowsApi.hideFlows();
      visualFlowsApi.toggleFlowVisible(id);
    },
    showAllRoutes: () => {
      visualFlowsApi.showFlows();
    },
    hideAllRoutes: () => {
      visualFlowsApi.hideFlows();
    },

    canAddEntities: !!currentSchemaType && sourceSchemaConfig.config[currentSchemaType].multipleRoute,
    newEntities: commonEntities.map(toEntity),
    newEntityGroups: Object.fromEntries(
      Object.entries(groupedEntities).map(([group, entities]) => [group, entities.map(toEntity)]),
    ),
    addEntity: (name) => {
      createEntity(name as EntityType);
    },

    canExport,
    isExportingImage,
    exportImage: () => {
      if (canExport) setIsExportingImage(true);
    },
    openDocumentation: () => {
      setIsDocumentationOpen(true);
    },
  };

  return (
    <>
      {createPortal(render(tools), container)}
      {isExportingImage && (
        <ImageExport
          onComplete={() => {
            setIsExportingImage(false);
          }}
        />
      )}
      {isDocumentationOpen && (
        <ExportDocumentPreviewModal
          onClose={() => {
            setIsDocumentationOpen(false);
          }}
        />
      )}
    </>
  );
};
