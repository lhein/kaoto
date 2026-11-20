/* eslint-disable react-refresh/only-export-components -- helpers of the tests, not part of the app */
import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router';

import { filesStore } from '../../services/files/files.store';
import { storeTestFiles, withFiles } from '../../test/files';
import { resetTestIndexedDB } from '../../test/indexed-db';
import { Explorer } from './Explorer';

/** What the Explorer tests share: the stored test files, the routes around the Explorer and a few helpers */

export type User = ReturnType<typeof userEvent.setup>;

/** Starts every test from the stored test files */
export const storeExplorerTestFiles = async (): Promise<void> => {
  resetTestIndexedDB();
  await storeTestFiles();
};

export const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route path="/workspace" element={withFiles(<Explorer />)} />
      </Routes>
    </MemoryRouter>,
  );

/**
 * Renders Explorer inside a nested route that mirrors the real app structure:
 * the inner Route provides :fileId when navigated to the file path,
 * so that useParams() inside Explorer returns fileId for selection sync.
 */
export const renderWithNavigation = (children?: ReactNode, initialPath = '/workspace') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/workspace"
          element={withFiles(
            <>
              <Explorer />
              {children}
              <Outlet />
            </>,
          )}
        >
          <Route index element={null} />
          <Route path="file/:fileId" element={null} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

/** Shows the current path, to check where the Explorer navigated to */
export const LocationDisplay = () => <div data-testid="location">{useLocation().pathname}</div>;

export const storedPaths = async (): Promise<string[]> => (await filesStore.getFiles()).map((file) => file.path);

export const storedFile = async (id: string) => (await filesStore.getFiles()).find((file) => file.id === id);
