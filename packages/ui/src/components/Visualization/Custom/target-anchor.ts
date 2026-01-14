import { AbstractAnchor, Point } from '@patternfly/react-topology';

import { LayoutType } from '../Canvas';

export class TargetAnchor extends AbstractAnchor {
  getLocation(_reference: Point): Point {
    const rect = this.owner.getBounds();
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const layout = this.owner.getGraph?.().getLayout?.();
    const isHorizontal = layout === LayoutType.DagreHorizontal;

    if (isHorizontal) {
      return new Point(rect.x, centerY);
    }

    return new Point(centerX, rect.y);
  }

  getReferencePoint(): Point {
    return super.getReferencePoint();
  }
}

export class SourceAnchor extends AbstractAnchor {
  getLocation(_reference: Point): Point {
    const rect = this.owner.getBounds();
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const layout = this.owner.getGraph?.().getLayout?.();
    const isHorizontal = layout === LayoutType.DagreHorizontal;

    if (isHorizontal) {
      return new Point(rect.x + rect.width, centerY);
    }

    return new Point(centerX, rect.y + rect.height);
  }

  getReferencePoint(): Point {
    return super.getReferencePoint();
  }
}
