import { render, screen } from '@testing-library/react';
import { FunctionComponent, useRef } from 'react';

import type { FocusRequest } from './useExplorer';
import { useExplorerFocus } from './useExplorerFocus';

const Harness: FunctionComponent<{ focusRequest: FocusRequest | undefined; items: string[] }> = ({
  focusRequest,
  items,
}) => {
  const treeRef = useRef<HTMLUListElement>(null);
  const fallbackRef = useRef<HTMLButtonElement>(null);
  useExplorerFocus(focusRequest, treeRef, fallbackRef);

  return (
    <>
      <button ref={fallbackRef}>Toolbar</button>
      <ul ref={treeRef}>
        {items.map((id) => (
          <li key={id} id={id} role="treeitem" aria-selected={false} tabIndex={-1}>
            {id}
          </li>
        ))}
      </ul>
    </>
  );
};

describe('useExplorerFocus', () => {
  it('moves no focus without a request', () => {
    render(<Harness focusRequest={undefined} items={['a']} />);

    expect(document.body).toHaveFocus();
  });

  it('focuses the tree node', () => {
    render(<Harness focusRequest={{ target: 'node', nodeId: 'b' }} items={['a', 'b']} />);

    expect(screen.getByRole('treeitem', { name: 'b' })).toHaveFocus();
  });

  it('focuses the first node when the node is gone', () => {
    render(<Harness focusRequest={{ target: 'node', nodeId: 'gone' }} items={['a', 'b']} />);

    expect(screen.getByRole('treeitem', { name: 'a' })).toHaveFocus();
  });

  it('focuses the toolbar when the tree is empty', () => {
    render(<Harness focusRequest={{ target: 'node', nodeId: 'gone' }} items={[]} />);

    expect(screen.getByRole('button', { name: 'Toolbar' })).toHaveFocus();
  });

  it('focuses the element that opened the field or dialog', () => {
    const opener = document.createElement('button');
    document.body.append(opener);

    render(<Harness focusRequest={{ target: 'opener', opener }} items={['a']} />);

    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('focuses the toolbar when the opener is gone', () => {
    const opener = document.createElement('button');

    render(<Harness focusRequest={{ target: 'opener', opener }} items={['a']} />);

    expect(screen.getByRole('button', { name: 'Toolbar' })).toHaveFocus();
  });

  it('focuses again when the same target is asked for twice', () => {
    const { rerender } = render(<Harness focusRequest={{ target: 'node', nodeId: 'a' }} items={['a']} />);
    screen.getByRole('button', { name: 'Toolbar' }).focus();

    rerender(<Harness focusRequest={{ target: 'node', nodeId: 'a' }} items={['a']} />);

    expect(screen.getByRole('treeitem', { name: 'a' })).toHaveFocus();
  });
});
