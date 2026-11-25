import './EditorHeader.scss';

import { CarbonIconType, Redo, Undo } from '@carbon/icons-react';
import { IconButton } from '@carbon/react';
import { FunctionComponent } from 'react';

import { useUndoRedo } from '../../../hooks/useUndoRedo';
import { CopyFileButton } from './CopyFileButton';

interface EditorHeaderProps {
  /** Icon of what the editor shows, e.g. the code or the flow */
  icon: CarbonIconType;
  /** Path of the open file; the header shows its name */
  path: string;
  /** Content of the open file, which the header copies to the clipboard */
  content: string;
  /** SPIKE: receives the element the canvas toolbar is rendered into */
  toolbarSlotRef?: (element: HTMLDivElement | null) => void;
  /** SPIKE: the canvas toolbar shows the copy button between its tools, so the header leaves out its own */
  hideCopy?: boolean;
}

const fileNameOf = (path: string): string => path.split('/').pop() ?? path;

/**
 * Header bar above the open file, styled like the one of the Explorer: an icon and the name of the file on the left, and
 * on the right undo and redo followed by the tools for the file (copy to the clipboard), as in the toolbar of the
 * Kaoto editor
 */
export const EditorHeader: FunctionComponent<EditorHeaderProps> = ({
  icon: Icon,
  path,
  content,
  toolbarSlotRef,
  hideCopy,
}) => {
  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  return (
    <div className="cs--editor-header">
      <Icon className="cs--editor-header__icon" aria-hidden="true" />
      <h2 className="cs--editor-header__title">{fileNameOf(path)}</h2>
      <div className="cs--editor-header__actions">
        <div className="cs--editor-header__group">
          <IconButton label="Undo" disabled={!canUndo} onClick={undo} kind="ghost" size="sm">
            <Undo />
          </IconButton>
          <IconButton label="Redo" disabled={!canRedo} onClick={redo} kind="ghost" size="sm">
            <Redo />
          </IconButton>
        </div>
        {toolbarSlotRef && <div ref={toolbarSlotRef} className="cs--editor-header__canvas-tools" />}
        {!hideCopy && (
          <div className="cs--editor-header__group">
            <CopyFileButton content={content} />
          </div>
        )}
      </div>
    </div>
  );
};
