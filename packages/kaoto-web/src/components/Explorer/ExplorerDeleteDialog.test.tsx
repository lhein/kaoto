import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ExplorerDeleteDialog } from './ExplorerDeleteDialog';

describe('ExplorerDeleteDialog', () => {
  it('asks about a file with its full path', () => {
    render(
      <ExplorerDeleteDialog path="routes/orders.camel.yaml" isFolder={false} onDelete={vi.fn()} onClose={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Delete file?' });
    expect(dialog).toHaveTextContent('Are you sure you want to delete routes/orders.camel.yaml?');
  });

  it('asks about a folder and says that its contents go with it', () => {
    render(<ExplorerDeleteDialog path="routes/orders" isFolder onDelete={vi.fn()} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Delete folder?' });
    expect(dialog).toHaveTextContent('Are you sure you want to delete the folder routes/orders and all its contents?');
  });

  it('deletes and closes once the deletion is confirmed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ExplorerDeleteDialog path="a.camel.yaml" isFolder={false} onDelete={onDelete} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
