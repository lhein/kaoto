import './Canvas.scss';

import { CatalogIcon } from '@patternfly/react-icons';
import {
  action,
  createTopologyControlButtons,
  defaultControlButtonsOptions,
  GRAPH_LAYOUT_END_EVENT,
  isNode,
  Model,
  Point,
  SELECTION_EVENT,
  SelectionEventListener,
  TopologyControlBar,
  TopologyControlButton,
  TopologyView,
  useEventListener,
  useVisualizationController,
  VisualizationSurface,
} from '@patternfly/react-topology';
import { runInAction } from 'mobx';
import clsx from 'clsx';
import {
  FunctionComponent,
  PropsWithChildren,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { CatalogModalContext } from '../../../dynamic-catalog/catalog-modal.provider';
import { useLocalStorage } from '../../../hooks';
import { usePrevious } from '../../../hooks/previous.hook';
import { LocalStorageKeys } from '../../../models';
import { BaseVisualCamelEntity } from '../../../models/visualization/base-visual-entity';
import { VisibleFlowsContext } from '../../../providers/visible-flows.provider';
import { HorizontalLayoutIcon } from '../../Icons/HorizontalLayout';
import { VerticalLayoutIcon } from '../../Icons/VerticalLayout';
import useDeleteHotkey from '../Custom/hooks/delete-hotkey.hook';
import { VisualizationEmptyState } from '../EmptyState';
import { CanvasDefaults } from './canvas.defaults';
import { CanvasEdge, CanvasNode, LayoutType } from './canvas.models';
import { CanvasSideBar } from './CanvasSideBar';
import { FlowService } from './flow.service';

interface CanvasProps {
  entities: BaseVisualCamelEntity[];
  contextToolbar?: ReactNode;
}

export const Canvas: FunctionComponent<PropsWithChildren<CanvasProps>> = ({ entities, contextToolbar }) => {
  const [initialized, setInitialized] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<CanvasNode | undefined>(undefined);
  const [activeLayout, setActiveLayout] = useLocalStorage(LocalStorageKeys.CanvasLayout, CanvasDefaults.DEFAULT_LAYOUT);
  const [sidebarWidth, setSidebarWidth] = useLocalStorage(
    LocalStorageKeys.CanvasSidebarWidth,
    CanvasDefaults.DEFAULT_SIDEBAR_WIDTH,
  );

  /** Context to interact with the Canvas catalog */
  const catalogModalContext = useContext(CatalogModalContext);

  const controller = useVisualizationController();
  const { visibleFlows } = useContext(VisibleFlowsContext)!;
  const shouldShowEmptyState = useMemo(() => {
    const areNoFlows = entities.length === 0;
    const areAllFlowsHidden = Object.values(visibleFlows).every((visible) => !visible);
    return areNoFlows || areAllFlowsHidden;
  }, [entities.length, visibleFlows]);

  const wasEmptyStateVisible = usePrevious(shouldShowEmptyState);
  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectedNode(undefined);
  }, []);

  useDeleteHotkey(selectedNode?.data?.vizNode, clearSelection);

  /** Draw graph */
  useEffect(() => {
    clearSelection();
    const nodes: CanvasNode[] = [];
    const edges: CanvasEdge[] = [];

    entities.forEach((entity) => {
      if (visibleFlows[entity.id]) {
        const { nodes: childNodes, edges: childEdges } = FlowService.getFlowDiagram(entity.id, entity.toVizNode());
        nodes.push(...childNodes);
        edges.push(...childEdges);
      }
    });

    const model: Model = {
      nodes,
      edges,
      graph: {
        id: 'g1',
        type: 'graph',
        layout: activeLayout,
      },
    };

    if (!initialized || wasEmptyStateVisible) {
      controller.fromModel(model, false);
      setInitialized(true);

      requestAnimationFrame(() => {
        controller.getGraph().fit(CanvasDefaults.CANVAS_FIT_PADDING);
      });
      return;
    }

    requestAnimationFrame(() => {
      controller.fromModel(model, true);
      controller.getGraph().layout();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, entities, visibleFlows]);

  useEventListener<SelectionEventListener>(SELECTION_EVENT, setSelectedIds);
  useEventListener(GRAPH_LAYOUT_END_EVENT, () => {
    const layout = controller.getGraph().getLayout();
    const isHorizontal = layout === LayoutType.DagreHorizontal;
    const isVertical = layout === LayoutType.DagreVertical;
    if (!isHorizontal && !isVertical) {
      return;
    }

    const graph = controller.getGraph();
    const topLevelNodes = graph.getNodes();
    const nodes = (() => {
      const allNodes: typeof topLevelNodes = [];
      const stack = [...topLevelNodes];
      while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        allNodes.push(node);
        node.getChildren().forEach((child) => {
          if (isNode(child)) {
            stack.push(child);
          }
        });
      }
      return allNodes;
    })();
    const nodeByVizId = new Map<string, (typeof nodes)[number]>();
    nodes.forEach((node) => {
      const vizNode = node.getData()?.vizNode;
      if (vizNode?.id) {
        nodeByVizId.set(vizNode.id, node);
      }
    });

    const getAncestors = (node: (typeof nodes)[number]) => {
      const chain: (typeof nodes)[number][] = [];
      let current: (typeof nodes)[number] | undefined = node;
      while (current) {
        chain.push(current);
        const incoming = current.getTargetEdges();
        if (incoming.length === 0) break;
        current = incoming[0].getSource();
      }
      return chain;
    };

    const findBranchNode = (sources: (typeof nodes)[number][]) => {
      const ancestorLists = sources.map((source) => getAncestors(source));
      if (ancestorLists.length === 0) return undefined;
      const [first, ...rest] = ancestorLists;
      return first.find(
        (candidate) =>
          candidate.getSourceEdges().length > 1 && rest.every((list) => list.some((node) => node === candidate)),
      );
    };

    const mergeCandidates = nodes.filter((node) => node.getTargetEdges().length > 1);

    runInAction(() => {
      topLevelNodes.forEach((routeContainer) => {
        if (!routeContainer.isGroup?.()) return;

        const routeCenter = routeContainer.getBounds().getCenter();
        const routeChildren = routeContainer
          .getChildren()
          .filter(isNode)
          .filter((node) => !node.isGroup?.() && node.getParent?.() === routeContainer);
        const entryNodes = routeChildren.filter((node) => node.getTargetEdges().length === 0);

        if (entryNodes.length === 0) return;

        const firstEntry = entryNodes.reduce((best, node) => {
          const bestPos = best.getBounds().getCenter();
          const nodePos = node.getBounds().getCenter();
          if (isHorizontal) {
            return nodePos.x < bestPos.x ? node : best;
          }
          return nodePos.y < bestPos.y ? node : best;
        }, entryNodes[0]);

        const sameContainer = (node: (typeof nodes)[number]) => node.getParent?.() === routeContainer;
        let current: (typeof nodes)[number] | undefined = firstEntry;

        while (current && sameContainer(current)) {
          const bounds = current.getBounds();
          if (isHorizontal) {
            current.setPosition(new Point(bounds.x, routeCenter.y - bounds.height / 2));
          } else {
            current.setPosition(new Point(routeCenter.x - bounds.width / 2, bounds.y));
          }

          const outgoing = current.getSourceEdges();
          if (outgoing.length !== 1) break;

          const next = outgoing[0].getTarget();
          if (next.getTargetEdges().length !== 1) break;

          current = next;
        }
      });

      mergeCandidates.forEach((mergeNode) => {
        const incoming = mergeNode.getTargetEdges();

        const branchNode = findBranchNode(incoming.map((edge) => edge.getSource()));
        if (!branchNode) return;

        let routeContainer = mergeNode.getParent();
        while (routeContainer && !routeContainer.isGroup?.()) {
          routeContainer = routeContainer.getParent();
        }
        if (!routeContainer) return;

        const routeCenter = routeContainer.getBounds().getCenter();
        const sameContainer = (node: (typeof nodes)[number]) => node.getParent?.() === routeContainer;
        let current: (typeof nodes)[number] | undefined = mergeNode;

        while (current && sameContainer(current)) {
          const bounds = current.getBounds();
          if (isHorizontal) {
            current.setPosition(new Point(bounds.x, routeCenter.y - bounds.height / 2));
          } else {
            current.setPosition(new Point(routeCenter.x - bounds.width / 2, bounds.y));
          }

          const outgoing = current.getSourceEdges();
          if (outgoing.length !== 1) break;

          const next = outgoing[0].getTarget();
          if (next.getTargetEdges().length !== 1) break;

          current = next;
        }
      });
    });
  });

  /** Set select node and pan it into view */
  useEffect(() => {
    let resizeTimeout: number | undefined;

    if (!selectedIds[0]) {
      setSelectedNode(undefined);
    } else {
      const selectedNode = controller.getNodeById(selectedIds[0]);
      if (selectedNode) {
        setSelectedNode(selectedNode as unknown as CanvasNode);
        resizeTimeout = setTimeout(
          action(() => {
            controller.getGraph().panIntoView(selectedNode, { offset: 20, minimumVisible: 100 });
            resizeTimeout = undefined;
          }),
          500,
        ) as unknown as number;
      }
      return () => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
      };
    }
  }, [selectedIds, controller]);

  const controlButtons = useMemo(() => {
    const customButtons: TopologyControlButton[] = [
      {
        id: 'topology-control-bar-h_layout-button',
        icon: <HorizontalLayoutIcon />,
        tooltip: 'Horizontal Layout',
        callback: action(() => {
          setActiveLayout(LayoutType.DagreHorizontal);
          controller.getGraph().setLayout(LayoutType.DagreHorizontal);
          controller.getGraph().layout();
        }),
      },
      {
        id: 'topology-control-bar-v_layout-button',
        icon: <VerticalLayoutIcon />,
        tooltip: 'Vertical Layout',
        callback: action(() => {
          setActiveLayout(LayoutType.DagreVertical);
          controller.getGraph().setLayout(LayoutType.DagreVertical);
          controller.getGraph().layout();
        }),
      },
    ];
    if (catalogModalContext) {
      customButtons.push({
        id: 'topology-control-bar-catalog-button',
        icon: <CatalogIcon />,
        tooltip: 'Open Catalog',
        callback: action(() => {
          catalogModalContext.getNewComponent();
        }),
      });
    }

    return createTopologyControlButtons({
      ...defaultControlButtonsOptions,
      fitToScreen: false,
      zoomInCallback: action(() => {
        controller.getGraph().scaleBy(4 / 3);
      }),
      zoomOutCallback: action(() => {
        controller.getGraph().scaleBy(3 / 4);
      }),
      resetViewCallback: action(() => {
        controller.getGraph().reset();
        controller.getGraph().layout();
        controller.getGraph().fit(CanvasDefaults.CANVAS_FIT_PADDING);
      }),
      legend: false,
      customButtons,
    });
  }, [catalogModalContext, controller, setActiveLayout]);

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'rect') {
        clearSelection();
      }
    },
    [clearSelection],
  );

  const isSidebarOpen = useMemo(() => selectedIds.length > 0, [selectedIds.length]);

  return (
    <TopologyView
      className={clsx({ hidden: !initialized })}
      defaultSideBarSize={sidebarWidth + 'px'}
      minSideBarSize="210px"
      onSideBarResize={setSidebarWidth}
      sideBarResizable
      sideBarOpen={isSidebarOpen}
      sideBar={isSidebarOpen ? <CanvasSideBar selectedNode={selectedNode} onClose={clearSelection} /> : null}
      contextToolbar={contextToolbar}
      controlBar={<TopologyControlBar controlButtons={controlButtons} />}
      onClick={handleCanvasClick}
    >
      <VisualizationSurface state={{ selectedIds }} />

      {shouldShowEmptyState && (
        <VisualizationEmptyState
          className="canvas-empty-state"
          data-testid="visualization-empty-state"
          entitiesNumber={entities.length}
        />
      )}
    </TopologyView>
  );
};
