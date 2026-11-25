import { Download, Image } from '@carbon/icons-react';
import { IconButton, MenuButton, MenuItem, MenuItemDivider, MenuItemSelectable } from '@carbon/react';
import type { CanvasNewEntity, CanvasTools } from '@kaoto/kaoto/components';
import { FunctionComponent } from 'react';

import { CopyFileButton } from './CopyFileButton';

interface CanvasToolbarProps {
  tools: CanvasTools;
  /** Content of the open file, which the copy button puts on the clipboard */
  content: string;
}

const newEntityItem = (tools: CanvasTools, entity: CanvasNewEntity) => (
  <MenuItem
    key={entity.name}
    label={entity.title}
    onClick={() => {
      tools.addEntity(entity.name);
    }}
  />
);

/**
 * SPIKE: the canvas toolbar drawn with Carbon. The state and the actions come from the canvas (`CanvasTools`); only the
 * controls are kaoto-web's, so it can put its own copy button between them.
 */
export const CanvasToolbar: FunctionComponent<CanvasToolbarProps> = ({ tools, content }) => {
  const shownCount = tools.routes.filter((route) => route.visible).length;
  const routesLabel = tools.routes.length === 1 ? tools.routes[0].id : `Routes ${shownCount}/${tools.routes.length}`;

  return (
    <>
      <div className="cs--editor-header__group">
        <MenuButton label={routesLabel} kind="ghost" size="sm" menuAlignment="bottom-end">
          {tools.routes.map((route) => (
            <MenuItemSelectable
              key={route.id}
              label={route.id}
              selected={route.visible}
              onChange={() => {
                tools.toggleRoute(route.id);
              }}
            />
          ))}
          <MenuItemDivider />
          <MenuItem label="Show all" onClick={tools.showAllRoutes} />
          <MenuItem label="Hide all" onClick={tools.hideAllRoutes} />
        </MenuButton>

        {tools.canAddEntities && (
          <MenuButton label="New" kind="ghost" size="sm" menuAlignment="bottom-end">
            {tools.newEntities.map((entity) => newEntityItem(tools, entity))}
            {Object.entries(tools.newEntityGroups).map(([group, entities]) => (
              <MenuItem key={group} label={group}>
                {entities.map((entity) => newEntityItem(tools, entity))}
              </MenuItem>
            ))}
          </MenuButton>
        )}
      </div>

      <div className="cs--editor-header__group">
        <CopyFileButton content={content} />
        <IconButton
          label="Export as image"
          kind="ghost"
          size="sm"
          disabled={!tools.canExport || tools.isExportingImage}
          onClick={tools.exportImage}
        >
          <Image />
        </IconButton>
        <IconButton
          label="Generate route documentation"
          kind="ghost"
          size="sm"
          align="bottom-end"
          onClick={tools.openDocumentation}
        >
          <Download />
        </IconButton>
      </div>
    </>
  );
};
