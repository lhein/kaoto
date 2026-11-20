import { describe, expect, it } from 'vitest';

import { TEST_FILES } from '../../../test/files';
import { buildTree, toFolderId } from './build-tree';
import { filterFiles } from './filterFiles';

const TREE = buildTree(TEST_FILES);

describe('filterFiles', () => {
  it('returns the original array when query is empty', () => {
    expect(filterFiles(TREE, '')).toBe(TREE);
  });

  it('returns only nodes whose name contains the query', () => {
    const result = filterFiles(TREE, 'main');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(toFolderId('integrations'));
    expect(result[0].children?.map((c) => c.id)).toEqual(['main-flow']);
  });

  it('excludes non-matching siblings when a child matches', () => {
    const result = filterFiles(TREE, 'rest-api');
    const routes = result[0].children?.find((c) => c.id === toFolderId('integrations/routes'));
    expect(routes?.children?.map((c) => c.id)).toEqual(['rest-api']);
  });

  it('returns a folder with all its children when the folder name matches', () => {
    const result = filterFiles(TREE, 'resources');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(toFolderId('resources'));
    // All original children are kept so the user can browse folder contents
    expect(result[0].children).toHaveLength(3); // schema, mapping, templates
  });

  it('recurses into 3-level deep folders', () => {
    const result = filterFiles(TREE, 'kafka');
    const async_ = result[0].children
      ?.find((c) => c.id === toFolderId('integrations/routes'))
      ?.children?.find((c) => c.id === toFolderId('integrations/routes/async'));
    expect(async_?.children?.map((c) => c.id)).toEqual(['kafka-consumer', 'kafka-producer']);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterFiles(TREE, 'nonexistent-xyz')).toHaveLength(0);
  });

  it('does not mutate the original nodes', () => {
    const original = TREE[1]; // resources
    filterFiles(TREE, 'resources');
    expect(original.children).toHaveLength(3); // schema, mapping, templates
  });
});
