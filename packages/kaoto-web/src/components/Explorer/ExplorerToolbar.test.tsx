import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { ExplorerContext, ExplorerController } from './ExplorerContext';
import { ExplorerToolbar } from './ExplorerToolbar';

describe('ExplorerToolbar', () => {
  const openCreateDialog = vi.fn();
  const startCreate = vi.fn();
  const addButtonRef = createRef<HTMLButtonElement>();

  const renderToolbar = () =>
    render(
      <ExplorerContext.Provider value={{ openCreateDialog, startCreate } as unknown as ExplorerController}>
        <ExplorerToolbar addButtonRef={addButtonRef} />
      </ExplorerContext.Provider>,
    );

  beforeEach(() => {
    openCreateDialog.mockReset();
    startCreate.mockReset();
  });

  it('shows the heading of the panel', () => {
    renderToolbar();

    expect(screen.getByRole('heading', { name: 'Explorer' })).toBeInTheDocument();
  });

  it('opens the Create new file dialog and names the button that opened it', async () => {
    const user = userEvent.setup();
    renderToolbar();
    const button = screen.getByRole('button', { name: 'Create a file' });

    await user.click(button);

    expect(openCreateDialog).toHaveBeenCalledWith(button);
    expect(addButtonRef.current).toBe(button);
  });

  it.each([
    ['New file', 'file'],
    ['New folder', 'folder'],
  ])('starts creating with %s', async (name, kind) => {
    const user = userEvent.setup();
    renderToolbar();
    const button = screen.getByRole('button', { name });

    await user.click(button);

    expect(startCreate).toHaveBeenCalledWith(kind, button);
  });

  it('cannot be rendered outside of an Explorer', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<ExplorerToolbar addButtonRef={addButtonRef} />)).toThrow(
      'useExplorerContext must be used within an Explorer',
    );
  });
});
