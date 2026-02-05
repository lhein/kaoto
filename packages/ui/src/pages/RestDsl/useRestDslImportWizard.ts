import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { parse as parseYaml } from 'yaml';

import { EntityType } from '../../models/camel/entities';
import { REST_DSL_VERBS } from '../../models/special-processors.constants';
import { CamelRestVisualEntity } from '../../models/visualization/flows/camel-rest-visual-entity';
import { CamelRouteVisualEntity } from '../../models/visualization/flows/camel-route-visual-entity';
import { EntitiesContext, SettingsContext } from '../../providers';
import {
  ApicurioArtifact,
  ApicurioArtifactSearchResult,
  ImportLoadSource,
  ImportOperation,
  ImportSourceOption,
  RestVerb,
} from './restDslTypes';

const buildOperationsFromSpec = (spec: Record<string, unknown>): ImportOperation[] => {
  const operations: ImportOperation[] = [];
  const paths = spec.paths as Record<string, unknown> | undefined;
  if (!paths) return operations;

  Object.entries(paths).forEach(([pathKey, definition]) => {
    if (!definition || typeof definition !== 'object') return;
    REST_DSL_VERBS.forEach((method) => {
      const op = (definition as Record<string, unknown>)[method] as Record<string, unknown> | undefined;
      if (!op) return;
      const operationId = (op.operationId as string | undefined) ?? `${method}-${pathKey}`;
      operations.push({
        operationId,
        method,
        path: pathKey,
        selected: true,
        routeExists: false,
      });
    });
  });

  return operations;
};

type UseRestDslImportWizardArgs = {
  isActive: boolean;
};

export const useRestDslImportWizard = ({ isActive }: UseRestDslImportWizardArgs) => {
  const entitiesContext = useContext(EntitiesContext);
  const settingsAdapter = useContext(SettingsContext);
  const apicurioRegistryUrl = settingsAdapter.getSettings().apicurioRegistryUrl;

  const [importOperations, setImportOperations] = useState<ImportOperation[]>([]);
  const [openApiLoadSource, setOpenApiLoadSource] = useState<ImportLoadSource>(undefined);
  const [importSource, setImportSource] = useState<ImportSourceOption>('uri');
  const [importCreateRest, setImportCreateRest] = useState(false);
  const [importCreateRoutes, setImportCreateRoutes] = useState(true);
  const [importSelectAll, setImportSelectAll] = useState(true);
  const [isOpenApiParsed, setIsOpenApiParsed] = useState(false);
  const [openApiSpecText, setOpenApiSpecText] = useState('');
  const [openApiSpecUri, setOpenApiSpecUri] = useState('');
  const [openApiError, setOpenApiError] = useState('');
  const [apicurioSearch, setApicurioSearch] = useState('');
  const [apicurioError, setApicurioError] = useState('');
  const [apicurioArtifacts, setApicurioArtifacts] = useState<ApicurioArtifact[]>([]);
  const [filteredApicurioArtifacts, setFilteredApicurioArtifacts] = useState<ApicurioArtifact[]>([]);
  const [selectedApicurioId, setSelectedApicurioId] = useState('');
  const [isApicurioLoading, setIsApicurioLoading] = useState(false);
  const [isImportBusy, setIsImportBusy] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const openApiFileInputRef = useRef<HTMLInputElement | null>(null);

  const resetImportWizard = useCallback(() => {
    setImportOperations([]);
    setIsOpenApiParsed(false);
    setOpenApiSpecText('');
    setOpenApiSpecUri('');
    setOpenApiError('');
    setOpenApiLoadSource(undefined);
    setImportSource('uri');
    setImportCreateRest(false);
    setImportCreateRoutes(true);
    setImportSelectAll(true);
    setApicurioSearch('');
    setApicurioError('');
    setApicurioArtifacts([]);
    setFilteredApicurioArtifacts([]);
    setSelectedApicurioId('');
  }, []);

  const parseOpenApiSpec = useCallback((specText: string): boolean => {
    if (!specText.trim()) {
      setOpenApiError('Provide an OpenAPI specification to import.');
      setImportOperations([]);
      setIsOpenApiParsed(false);
      return false;
    }

    try {
      const spec = parseYaml(specText) as Record<string, unknown>;
      if (!spec || typeof spec !== 'object' || !('paths' in spec)) {
        throw new Error('Invalid spec');
      }

      setOpenApiSpecText(JSON.stringify(spec, null, 2));
      const operations = buildOperationsFromSpec(spec);
      if (operations.length === 0) {
        setOpenApiError('No operations were found in the specification.');
        setImportOperations([]);
        setIsOpenApiParsed(false);
        return false;
      }

      setOpenApiError('');
      setImportOperations(operations);
      setImportSelectAll(true);
      setIsOpenApiParsed(true);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid OpenAPI specification.';
      setOpenApiError(message);
      setImportOperations([]);
      setIsOpenApiParsed(false);
      return false;
    }
  }, []);

  const fetchApicurioArtifacts = useCallback(async () => {
    if (!apicurioRegistryUrl) {
      setApicurioError('Apicurio Registry URL is missing.');
      return;
    }

    setIsApicurioLoading(true);
    setApicurioError('');
    try {
      const response = await fetch(`${apicurioRegistryUrl}/apis/registry/v2/search/artifacts`);
      if (!response.ok) {
        throw new Error(`Failed to fetch artifacts (${response.status})`);
      }
      const result = (await response.json()) as ApicurioArtifactSearchResult;
      const artifacts = (result.artifacts ?? []).filter((artifact) => artifact.type === 'OPENAPI');
      setApicurioArtifacts(artifacts);
      setFilteredApicurioArtifacts(artifacts);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch artifacts from Apicurio Registry.';
      setApicurioError(message);
    } finally {
      setIsApicurioLoading(false);
    }
  }, [apicurioRegistryUrl]);

  const handleLoadFromApicurio = useCallback(
    async (artifactId: string): Promise<boolean> => {
      if (!apicurioRegistryUrl) return false;

      setIsApicurioLoading(true);
      setApicurioError('');
      try {
        const artifactUrl = `${apicurioRegistryUrl}/apis/registry/v2/groups/default/artifacts/${artifactId}`;
        const response = await fetch(artifactUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch artifact (${response.status})`);
        }
        const specText = await response.text();
        const parsed = parseOpenApiSpec(specText);
        if (parsed) {
          setOpenApiLoadSource('apicurio');
        }
        setOpenApiSpecUri(artifactUrl);
        return parsed;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to download the selected artifact.';
        setApicurioError(message);
        return false;
      } finally {
        setIsApicurioLoading(false);
      }
    },
    [apicurioRegistryUrl, parseOpenApiSpec],
  );

  useEffect(() => {
    if (!isActive || importSource !== 'apicurio') return;
    fetchApicurioArtifacts();
  }, [fetchApicurioArtifacts, importSource, isActive]);

  useEffect(() => {
    if (!apicurioSearch.trim()) {
      setFilteredApicurioArtifacts(apicurioArtifacts);
      return;
    }
    const lowered = apicurioSearch.toLowerCase();
    setFilteredApicurioArtifacts(apicurioArtifacts.filter((artifact) => artifact.name.toLowerCase().includes(lowered)));
  }, [apicurioArtifacts, apicurioSearch]);

  useEffect(() => {
    if (!importStatus) return;
    const timeoutId = globalThis.setTimeout(() => {
      setImportStatus(null);
    }, 5000);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [importStatus]);

  const handleFetchOpenApiSpec = useCallback(async () => {
    const trimmed = openApiSpecUri.trim();
    if (!trimmed) {
      setOpenApiError('Provide a specification URI to fetch.');
      return false;
    }

    setIsImportBusy(true);
    setOpenApiError('');
    try {
      const response = await fetch(trimmed);
      if (!response.ok) {
        throw new Error(`Failed to fetch specification (${response.status})`);
      }
      const specText = await response.text();
      const parsed = parseOpenApiSpec(specText);
      if (parsed) {
        setOpenApiLoadSource('uri');
      }
      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch the specification.';
      setOpenApiError(message);
      setIsOpenApiParsed(false);
      return false;
    } finally {
      setIsImportBusy(false);
    }
  }, [openApiSpecUri, parseOpenApiSpec]);

  const handleUploadOpenApiClick = useCallback(() => {
    openApiFileInputRef.current?.click();
  }, []);

  const handleUploadOpenApiFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const content = await file.text();
        const parsed = parseOpenApiSpec(content);
        if (parsed) {
          setOpenApiLoadSource('file');
        }
        setOpenApiSpecUri(file.name);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to read the uploaded specification.';
        setOpenApiError(message);
        setIsOpenApiParsed(false);
      } finally {
        event.target.value = '';
      }
    },
    [parseOpenApiSpec],
  );

  const handleToggleSelectAllOperations = useCallback((checked: boolean) => {
    setImportSelectAll(checked);
    setImportOperations((prev) =>
      prev.map((operation) => ({
        ...operation,
        selected: checked,
      })),
    );
  }, []);

  const handleToggleOperation = useCallback((operationId: string, method: RestVerb, path: string, checked: boolean) => {
    setImportOperations((prev) => {
      const next = prev.map((operation) =>
        operation.operationId === operationId && operation.method === method && operation.path === path
          ? { ...operation, selected: checked }
          : operation,
      );
      setImportSelectAll(next.every((operation) => operation.selected));
      return next;
    });
  }, []);

  const handleImportOpenApi = useCallback(() => {
    if (!entitiesContext || (!importCreateRest && !importCreateRoutes)) {
      setImportStatus({
        type: 'error',
        message: 'Import failed. Choose at least one option to generate.',
      });
      return;
    }
    const selectedOperations = importOperations.filter((operation) => operation.selected);
    if (selectedOperations.length === 0) {
      setOpenApiError('Select at least one operation to import.');
      setImportStatus({
        type: 'error',
        message: 'Import failed. Select at least one operation.',
      });
      return;
    }

    const camelResource = entitiesContext.camelResource as {
      addNewEntity: (type?: EntityType) => string;
      getVisualEntities: () => Array<{ id: string; type: EntityType }>;
    };

    if (importCreateRoutes) {
      selectedOperations.forEach((operation) => {
        if (operation.routeExists) return;
        const newId = camelResource.addNewEntity(EntityType.Route);
        const routeEntity = camelResource
          .getVisualEntities()
          .find((entity) => entity.type === EntityType.Route && entity.id === newId) as
          | CamelRouteVisualEntity
          | undefined;

        routeEntity?.updateModel('route.id', `route-${operation.operationId}`);
        routeEntity?.updateModel('route.from.id', `direct-from-${operation.operationId}`);
        routeEntity?.updateModel('route.from.uri', `direct:${operation.operationId}`);
        routeEntity?.updateModel('route.from.steps', [
          {
            setBody: {
              constant: `Operation ${operation.operationId} not yet implemented`,
            },
          },
        ]);
      });
    }

    if (importCreateRest) {
      const newRestId = camelResource.addNewEntity(EntityType.Rest);
      const restEntity = camelResource
        .getVisualEntities()
        .find((entity) => entity.type === EntityType.Rest && entity.id === newRestId) as
        | CamelRestVisualEntity
        | undefined;

      if (restEntity) {
        const restDefinition: Record<string, unknown> = { id: newRestId };
        const trimmedSpecUri = openApiSpecUri.trim();
        if (trimmedSpecUri) {
          restDefinition.openApi = { specification: trimmedSpecUri };
        }

        selectedOperations.forEach((operation) => {
          const methodKey = operation.method;
          const list = (restDefinition[methodKey] as Record<string, unknown>[] | undefined) ?? [];
          list.push({
            id: operation.operationId,
            path: operation.path,
            routeId: `route-${operation.operationId}`,
            to: `direct:${operation.operationId}`,
          });
          restDefinition[methodKey] = list;
        });

        restEntity.updateModel(restEntity.getRootPath(), restDefinition);
      }
    }

    entitiesContext.updateEntitiesFromCamelResource();
    setImportStatus({
      type: 'success',
      message: `Import succeeded. ${selectedOperations.length} operation${selectedOperations.length === 1 ? '' : 's'} added.`,
    });
  }, [entitiesContext, importCreateRest, importCreateRoutes, importOperations, openApiSpecUri]);

  const handleImportSourceChange = useCallback((nextSource: ImportSourceOption) => {
    setImportSource(nextSource);
    setOpenApiError('');
    setApicurioError('');
    setImportOperations([]);
    setIsOpenApiParsed(false);
    setOpenApiLoadSource(undefined);
    setImportSelectAll(true);
    setSelectedApicurioId('');
  }, []);

  const handleWizardNext = useCallback(async () => {
    if (isImportBusy) return false;
    setOpenApiError('');
    setApicurioError('');

    if (importSource === 'uri') {
      if (!openApiSpecUri.trim()) {
        setOpenApiError('Provide a specification URI to fetch.');
        return false;
      }
      const ok = await handleFetchOpenApiSpec();
      if (!ok) return false;
    } else if (importSource === 'file') {
      if (!isOpenApiParsed) {
        setOpenApiError('Upload a specification file to continue.');
        return false;
      }
    } else {
      if (!selectedApicurioId) {
        setApicurioError('Select an artifact to continue.');
        return false;
      }
      setIsImportBusy(true);
      const ok = await handleLoadFromApicurio(selectedApicurioId);
      setIsImportBusy(false);
      if (!ok) return false;
    }

    if (!isOpenApiParsed) {
      setOpenApiError('Parse the specification before continuing.');
      return false;
    }

    return true;
  }, [
    handleFetchOpenApiSpec,
    handleLoadFromApicurio,
    importSource,
    isImportBusy,
    isOpenApiParsed,
    openApiSpecUri,
    selectedApicurioId,
  ]);

  const handleParseOpenApiSpec = useCallback(() => {
    parseOpenApiSpec(openApiSpecText);
  }, [openApiSpecText, parseOpenApiSpec]);

  const importOperationsWithRouteExists = useMemo(() => {
    if (!entitiesContext) return importOperations;
    const routes = entitiesContext.entities
      .filter((entity) => entity.type === EntityType.Route)
      .map((entity) => {
        const model = entity.toJSON() as { route?: { from?: { uri?: string } } };
        return model.route?.from?.uri;
      })
      .filter((uri): uri is string => typeof uri === 'string');

    return importOperations.map((operation) => ({
      ...operation,
      routeExists: routes.includes(`direct:${operation.operationId}`),
    }));
  }, [entitiesContext, importOperations]);

  return {
    openApiSpecUri,
    openApiSpecText,
    openApiError,
    apicurioRegistryUrl,
    apicurioError,
    apicurioSearch,
    filteredApicurioArtifacts,
    selectedApicurioId,
    isApicurioLoading,
    isImportBusy,
    isOpenApiParsed,
    importCreateRest,
    importCreateRoutes,
    importSelectAll,
    importOperations: importOperationsWithRouteExists,
    openApiLoadSource,
    importSource,
    importStatus,
    openApiFileInputRef,
    resetImportWizard,
    setOpenApiSpecUri,
    setOpenApiSpecText,
    setApicurioSearch,
    setSelectedApicurioId,
    setImportCreateRest,
    setImportCreateRoutes,
    handleFetchOpenApiSpec,
    handleParseOpenApiSpec,
    handleImportSourceChange,
    handleToggleSelectAllOperations,
    handleToggleOperation,
    handleUploadOpenApiClick,
    handleUploadOpenApiFile,
    handleWizardNext,
    handleImportOpenApi,
    fetchApicurioArtifacts,
  };
};
