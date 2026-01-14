import { EdgeStyle } from '@patternfly/react-topology';

import { IVisualizationNode } from '../../../models/visualization/base-visual-entity';
import { CamelComponentSchemaService } from '../../../models/visualization/flows/support/camel-component-schema.service';
import { CanvasDefaults } from './canvas.defaults';
import { CanvasEdge, CanvasNode, CanvasNodesAndEdges } from './canvas.models';

export class FlowService {
  static nodes: CanvasNode[] = [];
  static edges: CanvasEdge[] = [];
  private static visitedNodes: string[] = [];

  static getFlowDiagram(scope: string, vizNode: IVisualizationNode): CanvasNodesAndEdges {
    this.nodes = [];
    this.edges = [];
    this.visitedNodes = [];

    this.appendNodesAndEdges(vizNode);

    this.nodes.forEach((node) => {
      node.id = `${scope}|${node.id}`;
      node.children = node.children?.map((child) => `${scope}|${child}`);
      node.parentNode = node.parentNode ? `${scope}|${node.parentNode}` : undefined;
    });
    this.edges.forEach((edge) => {
      edge.id = `${scope}|${edge.id}`;
      edge.source = `${scope}|${edge.source}`;
      edge.target = `${scope}|${edge.target}`;
    });

    return { nodes: this.nodes, edges: this.edges };
  }

  /** Method for iterating over all the IVisualizationNode and its children using a depth-first algorithm */
  private static appendNodesAndEdges(vizNodeParam: IVisualizationNode): void {
    if (this.visitedNodes.includes(vizNodeParam.id)) {
      return;
    }

    const children = vizNodeParam.getChildren() ?? [];
    const hasRealChildren = children.length > 0;
    const isRootGroup = this.isRootGroupNode(vizNodeParam, hasRealChildren);

    if (hasRealChildren) {
      children.forEach((child) => {
        this.appendNodesAndEdges(child);
      });
    } else {
      vizNodeParam.data.isGroup = false;
    }

    let node: CanvasNode;

    if (isRootGroup) {
      node = this.getGroup(vizNodeParam.id, {
        label: vizNodeParam.id,
        children: this.collectDescendantIds(vizNodeParam),
        parentNode: vizNodeParam.getParentNode()?.id,
        data: { vizNode: vizNodeParam },
      });
    } else {
      const parentNode = this.getRootGroupId(vizNodeParam);
      node = this.getCanvasNode(vizNodeParam, parentNode);
      node.group = false;
      node.children = [];
    }

    /** Add node */
    this.nodes.push(node);
    this.visitedNodes.push(node.id);

    /** Add edges */
    this.edges.push(...this.getEdgesFromVizNode(vizNodeParam));
  }

  private static getCanvasNode(vizNodeParam: IVisualizationNode, parentNode?: string): CanvasNode {
    const canvasNode = this.getNode(vizNodeParam.id, { parentNode, data: { vizNode: vizNodeParam } });

    if (vizNodeParam.data.isPlaceholder) {
      canvasNode.type = 'node-placeholder';
    }

    return canvasNode;
  }

  private static getEdgesFromVizNode(vizNodeParam: IVisualizationNode): CanvasEdge[] {
    const edges: CanvasEdge[] = [];
    const prev = vizNodeParam.getPreviousNode?.();
    const next = vizNodeParam.getNextNode?.();

    const children = vizNodeParam.getChildren() ?? [];
    const hasChildren = children.length > 0;
    const isRootGroup = this.isRootGroupNode(vizNodeParam, hasChildren);

    /**
     *  Priority Rule 1: Normal flow
     */
    if (next && !hasChildren) {
      edges.push(this.getEdge(vizNodeParam.id, next.id));
    } else if (!hasChildren && prev && vizNodeParam.data?.isGroup === true) {
      /**
       *  Priority Rule 2 (Fallback):
       * If node was a group like "choice" → now empty → keep it after its previous sibling
       */
      edges.push(this.getEdge(prev.id, vizNodeParam.id));
    }

    if (hasChildren && !isRootGroup) {
      const branchEntries = this.getBranchEntryNodes(children);
      branchEntries.forEach((child) => {
        edges.push(this.getEdge(vizNodeParam.id, child.id));
      });

      if (next) {
        const branchLeaves = branchEntries.flatMap((child) => this.getBranchLeaves(child));
        branchLeaves.forEach((leaf) => {
          edges.push(this.getEdge(leaf.id, next.id));
        });
      }
    }

    return edges;
  }

  private static getGroup(
    id: string,
    options: { label?: string; children?: string[]; parentNode?: string; data?: CanvasNode['data'] } = {},
  ): CanvasNode {
    return {
      id,
      type: 'group',
      group: true,
      label: options.label ?? id,
      children: options.children ?? [],
      parentNode: options.parentNode,
      data: options.data,
      style: {
        padding: CanvasDefaults.DEFAULT_GROUP_PADDING,
      },
    };
  }

  private static getNode(id: string, options: { parentNode?: string; data?: CanvasNode['data'] } = {}): CanvasNode {
    return {
      id,
      type: 'node',
      parentNode: options.parentNode,
      data: options.data,
      width: CanvasDefaults.DEFAULT_NODE_WIDTH,
      height: CanvasDefaults.DEFAULT_NODE_HEIGHT,
      shape: CanvasDefaults.DEFAULT_NODE_SHAPE,
    };
  }

  private static getEdge(source: string, target: string): CanvasEdge {
    return {
      id: `${source} >>> ${target}`,
      type: 'edge',
      source,
      target,
      edgeStyle: EdgeStyle.solid,
    };
  }

  private static isRootGroupNode(node: IVisualizationNode, hasChildren: boolean): boolean {
    return node.data.isGroup === true && hasChildren && node.getParentNode?.() === undefined;
  }

  private static getRootGroupId(node: IVisualizationNode): string | undefined {
    const rootGroup = this.getRootGroupNode(node);
    return rootGroup && rootGroup !== node ? rootGroup.id : undefined;
  }

  private static getRootGroupNode(node: IVisualizationNode): IVisualizationNode | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current: IVisualizationNode | undefined = node;
    while (current?.getParentNode?.()) {
      current = current.getParentNode();
    }

    if (current?.data?.isGroup === true && current.getParentNode?.() === undefined) {
      return current;
    }

    return undefined;
  }

  private static collectDescendantIds(node: IVisualizationNode): string[] {
    const children = node.getChildren() ?? [];
    return children.flatMap((child) => [child.id, ...this.collectDescendantIds(child)]);
  }

  private static getBranchEntryNodes(children: IVisualizationNode[]): IVisualizationNode[] {
    let hasPrimaryBranch = false;

    return children.filter((child) => {
      const processorName = child.data?.processorName;
      const isSpecialChild = CamelComponentSchemaService.SPECIAL_CHILD_PROCESSORS.includes(processorName);

      if (isSpecialChild) {
        return true;
      }

      if (!hasPrimaryBranch) {
        hasPrimaryBranch = true;
        return true;
      }

      return false;
    });
  }

  private static getBranchLeaves(node: IVisualizationNode): IVisualizationNode[] {
    const children = node.getChildren() ?? [];
    const hasChildren = children.length > 0;
    const next = node.getNextNode?.();

    if (hasChildren) {
      const branchEntries = this.getBranchEntryNodes(children);
      const branchLeaves = branchEntries.flatMap((child) => this.getBranchLeaves(child));

      if (next && this.isNextInSameParent(node, next)) {
        return this.getBranchLeaves(next);
      }

      return branchLeaves;
    }

    if (next && this.isNextInSameParent(node, next)) {
      return this.getBranchLeaves(next);
    }

    return [node];
  }

  private static isNextInSameParent(node: IVisualizationNode, next: IVisualizationNode): boolean {
    return node.getParentNode?.() === next.getParentNode?.();
  }
}
