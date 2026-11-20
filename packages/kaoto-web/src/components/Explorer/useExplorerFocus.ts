import { RefObject, useEffect } from 'react';

import type { FocusRequest } from './useExplorer';

/**
 * Moves the focus when the controller asks for it. A field or dialog that closes unmounts, so the focus goes back by
 * hand: to the tree node, or to the first node or the toolbar when that node is gone; to the element that opened it,
 * or to the toolbar when that one is gone, as the empty-state link is once a file exists.
 */
export const useExplorerFocus = (
  focusRequest: FocusRequest | undefined,
  treeRef: RefObject<HTMLElement | null>,
  fallbackRef: RefObject<HTMLElement | null>,
): void => {
  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.target === 'opener') {
      (focusRequest.opener.isConnected ? focusRequest.opener : fallbackRef.current)?.focus();
      return;
    }
    const items = [...(treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])];
    const target = items.find((item) => item.id === focusRequest.nodeId) ?? items[0] ?? fallbackRef.current;
    target?.focus();
  }, [focusRequest, treeRef, fallbackRef]);
};
