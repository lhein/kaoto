import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { createExplorerController, withExplorer } from './explorer-controller.mock';
import { ExplorerToolbar } from './ExplorerToolbar';

describe('ExplorerToolbar', () => {
  const addButtonRef = createRef<HTMLButtonElement>();

  const renderToolbar = () => {
    const controller = createExplorerController();
    render(withExplorer(controller, <ExplorerToolbar addButtonRef={addButtonRef} />));
    return controller.actions;
  };

  it('shows the heading of the panel', () => {
    renderToolbar();

    expect(screen.getByRole('heading', { name: 'Explorer' })).toBeInTheDocument();
  });

  it('opens the Create new file dialog and names the button that opened it', async () => {
    const user = userEvent.setup();
    const actions = renderToolbar();
    const button = screen.getByRole('button', { name: 'Create a file' });

    await user.click(button);

    expect(actions.openCreateDialog).toHaveBeenCalledWith(button);
    expect(addButtonRef.current).toBe(button);
  });

  it.each([
    ['New file', 'file'],
    ['New folder', 'folder'],
  ])('starts creating with %s', async (name, kind) => {
    const user = userEvent.setup();
    const actions = renderToolbar();
    const button = screen.getByRole('button', { name });

    await user.click(button);

    expect(actions.startCreate).toHaveBeenCalledWith(kind, button);
  });

  it('cannot be rendered outside of an Explorer', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<ExplorerToolbar addButtonRef={addButtonRef} />)).toThrow(
      'useExplorerContext must be used within an Explorer',
    );
  });
});
