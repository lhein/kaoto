import './CustomEdge.scss';

import { Icon } from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';
import {
  DefaultConnectorTerminal,
  DefaultEdge,
  EdgeModel,
  EdgeTerminalType,
  getClosestVisibleParent,
  GraphElement,
  isEdge,
  observer,
  Point,
} from '@patternfly/react-topology';
import { FunctionComponent } from 'react';

import { AddStepMode, IVisualizationNode } from '../../../../models';
import { LayoutType } from '../../Canvas';
import { CanvasDefaults } from '../../Canvas/canvas.defaults';
import { AddStepIcon } from './AddStepIcon';

type DefaultEdgeProps = Parameters<typeof DefaultEdge>[0];
interface CustomEdgeProps extends DefaultEdgeProps {
  /** We're not providing Data to edges */
  element: GraphElement<EdgeModel, unknown>;
}

export const CustomEdge: FunctionComponent<CustomEdgeProps> = observer(({ element }) => {
  if (!isEdge(element)) {
    throw new Error('EdgeEndWithButton must be used only on Edge elements');
  }

  /* If the edge connects to nodes in a collapsed group don't draw */
  const sourceParent = getClosestVisibleParent(element.getSource());
  const targetParent = getClosestVisibleParent(element.getTarget());
  if (sourceParent?.isCollapsed() && sourceParent === targetParent) {
    return null;
  }

  const startPoint = element.getStartPoint();
  const endPoint = element.getEndPoint();
  const isHorizontal = element.getGraph().getLayout() === LayoutType.DagreHorizontal;
  const isAligned =
    (isHorizontal && Math.abs(startPoint.y - endPoint.y) < CanvasDefaults.EDGE_ALIGNMENT_TOLERANCE) ||
    (!isHorizontal && Math.abs(startPoint.x - endPoint.x) < CanvasDefaults.EDGE_ALIGNMENT_TOLERANCE);
  const isBranching = element.getSource().getSourceEdges().length > 1;
  const isMerging = element.getTarget().getTargetEdges().length > 1;
  const leadIn =
    isBranching || isMerging ? CanvasDefaults.EDGE_LEAD_IN_BRANCHING : CanvasDefaults.EDGE_LEAD_IN_DEFAULT;
  const tailLength = CanvasDefaults.EDGE_TAIL_LENGTH;

  let x = startPoint.x + (endPoint.x - startPoint.x - CanvasDefaults.ADD_STEP_ICON_SIZE) / 2;
  let y = startPoint.y + (endPoint.y - startPoint.y - CanvasDefaults.ADD_STEP_ICON_SIZE) / 2;
  if (isHorizontal) {
    /** If the layout is horizontal, we need to pull the AddStepIcon to the left to substract the edge connector width */
    x -= 6;
  } else if (element.getSource().isGroup()) {
    /** If the edge starts from a group, we need to pull the AddStepIcon to the top to substract the edge connector height */
    y -= 6;
  } else {
    /** If the edge starts from a node, we need to push the AddStepIcon to the bottom to save the node label */
    y += 4;
  }

  const vizNode: IVisualizationNode | undefined = element.getTarget().getData().vizNode;
  const shouldShowPrepend = !vizNode?.data.isPlaceholder && vizNode?.getNodeInteraction().canHavePreviousStep;

  const pathPoints = (() => {
    if (isAligned) {
      return [startPoint, endPoint];
    }

    if (isHorizontal) {
      const directionX = Math.sign(endPoint.x - startPoint.x) || 1;
      let junctionX = startPoint.x + directionX * leadIn;
      const minJunctionX = endPoint.x - directionX * tailLength;
      if ((directionX > 0 && junctionX > minJunctionX) || (directionX < 0 && junctionX < minJunctionX)) {
        junctionX = minJunctionX;
      }
      let tailStartX = endPoint.x - directionX * tailLength;
      if ((directionX > 0 && tailStartX < junctionX) || (directionX < 0 && tailStartX > junctionX)) {
        tailStartX = junctionX;
      }
      return [
        startPoint,
        new Point(junctionX, startPoint.y),
        new Point(junctionX, endPoint.y),
        new Point(tailStartX, endPoint.y),
        endPoint,
      ];
    }

    const directionY = Math.sign(endPoint.y - startPoint.y) || 1;
    let junctionY = startPoint.y + directionY * leadIn;
    const minJunctionY = endPoint.y - directionY * tailLength;
    if ((directionY > 0 && junctionY > minJunctionY) || (directionY < 0 && junctionY < minJunctionY)) {
      junctionY = minJunctionY;
    }
    let tailStartY = endPoint.y - directionY * tailLength;
    if ((directionY > 0 && tailStartY < junctionY) || (directionY < 0 && tailStartY > junctionY)) {
      tailStartY = junctionY;
    }
    return [
      startPoint,
      new Point(startPoint.x, junctionY),
      new Point(endPoint.x, junctionY),
      new Point(endPoint.x, tailStartY),
      endPoint,
    ];
  })();

  const d = `M${pathPoints[0].x} ${pathPoints[0].y} ${pathPoints
    .slice(1)
    .map((b: Point) => `L${b.x} ${b.y}`)
    .join(' ')}`;

  return (
    <g className="custom-edge">
      <path className="custom-edge__background" d={d} />
      <path className="custom-edge__body" d={d} />
      <DefaultConnectorTerminal
        isTarget={false}
        edge={element}
        size={CanvasDefaults.EDGE_ARROW_SIZE}
        terminalType={EdgeTerminalType.none}
      />
      <DefaultConnectorTerminal
        isTarget
        edge={element}
        size={CanvasDefaults.EDGE_ARROW_SIZE}
        terminalType={EdgeTerminalType.directional}
        startPoint={pathPoints[pathPoints.length - 2]}
        endPoint={pathPoints[pathPoints.length - 1]}
      />

      {shouldShowPrepend && (
        <foreignObject x={x} y={y} width={CanvasDefaults.ADD_STEP_ICON_SIZE} height={CanvasDefaults.ADD_STEP_ICON_SIZE}>
          <AddStepIcon
            className="custom-edge__add-step"
            title="Add step"
            vizNode={vizNode}
            mode={AddStepMode.PrependStep}
          >
            <Icon size="lg">
              <PlusCircleIcon />
            </Icon>
          </AddStepIcon>
        </foreignObject>
      )}
    </g>
  );
});
