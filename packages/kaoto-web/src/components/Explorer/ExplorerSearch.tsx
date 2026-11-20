import { Search } from '@carbon/react';
import { FunctionComponent } from 'react';

import { useExplorerContext, useExplorerState } from './ExplorerContext';

/** The field that filters the tree by name */
export const ExplorerSearch: FunctionComponent = () => {
  const { actions } = useExplorerContext();
  const searchText = useExplorerState((state) => state.searchText);

  return (
    <div className="cs--explorer__search">
      <Search
        size="sm"
        labelText="Search files"
        placeholder="Search files…"
        value={searchText}
        onChange={(event) => {
          actions.setSearchText(event.target.value);
        }}
        data-testid="explorer-search"
      />
    </div>
  );
};
