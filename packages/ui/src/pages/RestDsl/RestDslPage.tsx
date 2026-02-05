import './RestDslPage.scss';

import { CanvasFormTabsContextResult, TypeaheadItem } from '@kaoto/forms';
import {
  Alert,
  AlertGroup,
  Button,
  Form,
  FormGroup,
  MenuToggle,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Popover,
  Select,
  SelectList,
  SelectOption,
  Split,
  TextInput,
} from '@patternfly/react-core';
import { EllipsisVIcon, HelpIcon } from '@patternfly/react-icons';
import { FunctionComponent, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { parse as parseYaml } from 'yaml';

import { getCamelRandomId } from '../../camel-utils/camel-random-id';
import { useLocalStorage } from '../../hooks';
import { useRuntimeContext } from '../../hooks/useRuntimeContext/useRuntimeContext';
import { EntityType } from '../../models/camel/entities';
import { CatalogKind } from '../../models/catalog-kind';
import { LocalStorageKeys } from '../../models/local-storage-keys';
import { CamelCatalogService } from '../../models/visualization/flows/camel-catalog.service';
import { CamelRestConfigurationVisualEntity } from '../../models/visualization/flows/camel-rest-configuration-visual-entity';
import { CamelRestVisualEntity } from '../../models/visualization/flows/camel-rest-visual-entity';
import { CamelRouteVisualEntity } from '../../models/visualization/flows/camel-route-visual-entity';
import { CamelComponentFilterService } from '../../models/visualization/flows/support/camel-component-filter.service';
import { EntitiesContext, SettingsContext } from '../../providers';
import {
  ACTION_ID_CONFIRM,
  ActionConfirmationModalContext,
  ActionConfirmationModalContextProvider,
} from '../../providers/action-confirmation-modal.provider';
import { getValue, setValue } from '../../utils';
import { RestDslDetails } from './RestDslDetails';
import { RestDslImportWizard } from './RestDslImportWizard';
import { RestDslNav } from './RestDslNav';
import {
  ApicurioArtifact,
  ApicurioArtifactSearchResult,
  ImportLoadSource,
  ImportOperation,
  ImportSourceOption,
  RestEditorSelection,
  RestVerb,
} from './restDslTypes';

type OperationVerbToggleProps = {
  toggleRef: React.Ref<HTMLButtonElement>;
  operationVerb: RestVerb;
  onToggle: () => void;
};

const OperationVerbToggle: FunctionComponent<OperationVerbToggleProps> = ({ toggleRef, operationVerb, onToggle }) => {
  return (
    <MenuToggle ref={toggleRef} onClick={onToggle}>
      {operationVerb.toUpperCase()}
    </MenuToggle>
  );
};

const createOperationVerbToggleRenderer =
  (operationVerb: RestVerb, onToggle: () => void) => (toggleRef: React.Ref<HTMLButtonElement>) => (
    <OperationVerbToggle toggleRef={toggleRef} operationVerb={operationVerb} onToggle={onToggle} />
  );

const OperationTypeHelp: FunctionComponent = () => (
  <Popover
    bodyContent="Select the HTTP method to create for this REST operation."
    triggerAction="hover"
    withFocusTrap={false}
  >
    <Button variant="plain" aria-label="More info about Operation Type" icon={<HelpIcon />} />
  </Popover>
);

type RestDslImportMenuToggleProps = {
  toggleRef: React.Ref<HTMLButtonElement>;
  onToggle: () => void;
};

const RestDslImportMenuToggle: FunctionComponent<RestDslImportMenuToggleProps> = ({ toggleRef, onToggle }) => {
  return (
    <MenuToggle
      ref={toggleRef}
      variant="plain"
      aria-label="Rest DSL actions"
      onClick={onToggle}
      icon={<EllipsisVIcon />}
    />
  );
};

const createRestDslImportMenuToggleRenderer = (onToggle: () => void) => (toggleRef: React.Ref<HTMLButtonElement>) => (
  <RestDslImportMenuToggle toggleRef={toggleRef} onToggle={onToggle} />
);

const trimUnderscoreEdges = (value: string) => {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === '_') start += 1;
  while (end > start && value[end - 1] === '_') end -= 1;
  return value.slice(start, end);
};

const normalizeOperationIdFallback = (value: string) => {
  let result = '';
  let lastUnderscore = false;
  for (const ch of value) {
    const isAllowed = /[\w.-]/.test(ch);
    if (isAllowed) {
      result += ch;
      lastUnderscore = false;
    } else if (!lastUnderscore) {
      result += '_';
      lastUnderscore = true;
    }
  }
  return trimUnderscoreEdges(result);
};

type OperationVerbSelectProps = {
  isOpen: boolean;
  selected: RestVerb;
  verbs: RestVerb[];
  onSelect: (value: RestVerb) => void;
  onOpenChange: (isOpen: boolean) => void;
  onToggle: () => void;
};

const OperationVerbSelect: FunctionComponent<OperationVerbSelectProps> = ({
  isOpen,
  selected,
  verbs,
  onSelect,
  onOpenChange,
  onToggle,
}) => {
  const toggleRenderer = useMemo(() => createOperationVerbToggleRenderer(selected, onToggle), [selected, onToggle]);

  return (
    <Select
      isOpen={isOpen}
      selected={selected}
      onSelect={(_event, value) => onSelect(value as RestVerb)}
      onOpenChange={onOpenChange}
      toggle={toggleRenderer}
    >
      <SelectList>
        {verbs.map((verb) => (
          <SelectOption key={verb} itemId={verb}>
            {verb.toUpperCase()}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};

const REST_METHODS = CamelComponentFilterService.REST_DSL_METHODS;
const NAV_MIN_WIDTH = 220;
const NAV_MAX_WIDTH = 520;
const ALLOWED_REST_TARGET_ENDPOINTS = ['direct:'] as const;
const OPENAPI_METHODS: RestVerb[] = ['get', 'post', 'put', 'delete', 'head', 'patch'];

export const RestDslPage: FunctionComponent = () => {
  const entitiesContext = useContext(EntitiesContext);
  const actionConfirmation = useContext(ActionConfirmationModalContext);
  const settingsAdapter = useContext(SettingsContext);
  const { selectedCatalog } = useRuntimeContext();
  const catalogKey = selectedCatalog?.version ?? selectedCatalog?.name ?? 'default';

  const restConfiguration = useMemo(() => {
    return entitiesContext?.visualEntities.find((entity) => entity.type === EntityType.RestConfiguration) as
      | CamelRestConfigurationVisualEntity
      | undefined;
  }, [entitiesContext?.visualEntities]);

  const restEntities = useMemo(() => {
    return (entitiesContext?.visualEntities ?? []).filter(
      (entity) => entity.type === EntityType.Rest,
    ) as CamelRestVisualEntity[];
  }, [entitiesContext?.visualEntities]);

  const directRouteInputs = useMemo(() => {
    const inputs = new Set<string>();
    (entitiesContext?.visualEntities ?? []).forEach((entity) => {
      if (entity.type !== EntityType.Route) return;
      const routeEntity = entity as CamelRouteVisualEntity;
      const uri = routeEntity.entityDef?.route?.from?.uri;
      if (typeof uri === 'string' && uri.startsWith('direct:')) {
        inputs.add(uri);
      }
    });
    return inputs;
  }, [entitiesContext?.visualEntities]);

  const normalizeOperationId = useCallback((value: string, method: RestVerb, path: string) => {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
    const fallback = `${method}_${path}`;
    return normalizeOperationIdFallback(fallback) || `${method}_${Date.now()}`;
  }, []);

  const buildImportOperations = useCallback(
    (spec: Record<string, unknown>) => {
      const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;
      const operations: ImportOperation[] = [];

      Object.entries(paths).forEach(([path, pathItem]) => {
        OPENAPI_METHODS.forEach((method) => {
          const operation = pathItem?.[method] as Record<string, unknown> | undefined;
          if (!operation) return;
          const rawOperationId = typeof operation.operationId === 'string' ? operation.operationId : '';
          const operationId = normalizeOperationId(rawOperationId, method, path);
          const routeExists = directRouteInputs.has(`direct:${operationId}`);
          operations.push({
            operationId,
            method,
            path,
            selected: true,
            routeExists,
          });
        });
      });

      return operations;
    },
    [directRouteInputs, normalizeOperationId],
  );

  const directEndpointItems = useMemo<TypeaheadItem<string>[]>(() => {
    const endpoints = new Set<string>();
    const visited = new WeakSet<object>();
    const isAllowedRestTargetEndpoint = (uri: string) =>
      ALLOWED_REST_TARGET_ENDPOINTS.some((scheme) => uri.startsWith(scheme));

    const addEndpointIfAllowed = (uri: string) => {
      if (isAllowedRestTargetEndpoint(uri)) {
        endpoints.add(uri);
      }
    };

    const collectDirectEndpoint = (value: Record<string, unknown>) => {
      const directName = getValue(value, 'parameters.name');
      if (typeof directName === 'string' && directName.trim()) {
        endpoints.add(`direct:${directName.trim()}`);
      }
    };

    const collectUriValue = (value: Record<string, unknown>) => {
      const uriValue = getValue(value, 'uri');
      if (typeof uriValue !== 'string') return;
      if (isAllowedRestTargetEndpoint(uriValue)) {
        endpoints.add(uriValue);
        return;
      }
      if (uriValue === 'direct') {
        collectDirectEndpoint(value);
      }
    };

    const collectObject = (value: Record<string, unknown>) => {
      if (visited.has(value)) return;
      visited.add(value);
      collectUriValue(value);
      Object.values(value).forEach((item) => collect(item));
    };

    const collect = (value: unknown) => {
      if (!value) return;
      if (typeof value === 'string') {
        addEndpointIfAllowed(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => collect(item));
        return;
      }
      if (typeof value === 'object') {
        collectObject(value as Record<string, unknown>);
      }
    };

    (entitiesContext?.visualEntities ?? []).forEach((entity) => {
      if (entity.type === EntityType.Route) {
        const routeEntity = entity as CamelRouteVisualEntity;
        collect(routeEntity.entityDef);
        return;
      }
      collect((entity as unknown as { entityDef?: unknown }).entityDef ?? entity);
    });

    return Array.from(endpoints)
      .sort((a, b) => a.localeCompare(b))
      .map((uri) => ({ name: uri, value: uri }));
  }, [entitiesContext?.visualEntities]);

  const canAddRestEntities = useMemo(() => {
    return Boolean(entitiesContext?.camelResource && 'addNewEntity' in entitiesContext.camelResource);
  }, [entitiesContext?.camelResource]);

  const canDeleteRestEntities = useMemo(() => {
    return Boolean(entitiesContext?.camelResource && 'removeEntity' in entitiesContext.camelResource);
  }, [entitiesContext?.camelResource]);

  const defaultSelection = useMemo<RestEditorSelection | undefined>(() => {
    if (restConfiguration) return { kind: 'restConfiguration' };
    const firstRest = restEntities[0];
    if (firstRest) return { kind: 'rest', restId: firstRest.id };
    return undefined;
  }, [restConfiguration, restEntities]);

  const [selection, setSelection] = useState<RestEditorSelection | undefined>(defaultSelection);
  const [navWidth, setNavWidth] = useLocalStorage(LocalStorageKeys.RestDslNavWidth, 288);
  const resizeRef = useRef<{ startX: number; startWidth: number; isDragging: boolean } | null>(null);
  const [isAddOperationOpen, setIsAddOperationOpen] = useState(false);
  const [addOperationRestId, setAddOperationRestId] = useState<string | undefined>(undefined);
  const [operationId, setOperationId] = useState('');
  const [operationPath, setOperationPath] = useState('');
  const [operationVerb, setOperationVerb] = useState<RestVerb>('get');
  const [isVerbSelectOpen, setIsVerbSelectOpen] = useState(false);
  const [isImportOpenApiOpen, setIsImportOpenApiOpen] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [openApiSpecText, setOpenApiSpecText] = useState('');
  const [openApiSpecUri, setOpenApiSpecUri] = useState('');
  const [openApiError, setOpenApiError] = useState('');
  const [importOperations, setImportOperations] = useState<ImportOperation[]>([]);
  const [isOpenApiParsed, setIsOpenApiParsed] = useState(false);
  const [openApiLoadSource, setOpenApiLoadSource] = useState<ImportLoadSource>(undefined);
  const [importSource, setImportSource] = useState<ImportSourceOption>('uri');
  const [importCreateRest, setImportCreateRest] = useState(false);
  const [importCreateRoutes, setImportCreateRoutes] = useState(true);
  const [importSelectAll, setImportSelectAll] = useState(true);
  const [apicurioArtifacts, setApicurioArtifacts] = useState<ApicurioArtifact[]>([]);
  const [filteredApicurioArtifacts, setFilteredApicurioArtifacts] = useState<ApicurioArtifact[]>([]);
  const [apicurioSearch, setApicurioSearch] = useState('');
  const [apicurioError, setApicurioError] = useState('');
  const [isApicurioLoading, setIsApicurioLoading] = useState(false);
  const [selectedApicurioId, setSelectedApicurioId] = useState('');
  const [isImportBusy, setIsImportBusy] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [toUriValue, setToUriValue] = useState('');
  const toUriFieldRef = useRef<HTMLDivElement | null>(null);
  const openApiFileInputRef = useRef<HTMLInputElement | null>(null);
  const uriInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selection) {
      setSelection(defaultSelection);
      return;
    }

    if (selection.kind === 'restConfiguration' && !restConfiguration) {
      setSelection(defaultSelection);
      return;
    }

    if (selection.kind !== 'restConfiguration') {
      const restEntity = restEntities.find((entity) => entity.id === selection.restId);
      if (!restEntity) {
        setSelection(defaultSelection);
      }
    }
  }, [defaultSelection, restConfiguration, restEntities, selection]);

  const selectedFormState = useMemo(() => {
    if (!selection) return undefined;

    if (selection.kind === 'restConfiguration') {
      if (!restConfiguration) return undefined;
      return {
        title: 'Rest Configuration',
        entity: restConfiguration,
        path: restConfiguration.getRootPath(),
        omitFields: restConfiguration.getOmitFormFields(),
      };
    }

    const restEntity = restEntities.find((entity) => entity.id === selection.restId);
    if (!restEntity) return undefined;

    if (selection.kind === 'rest') {
      return {
        title: 'Rest',
        entity: restEntity,
        path: restEntity.getRootPath(),
        omitFields: restEntity.getOmitFormFields(),
      };
    }

    const operationPath = `${restEntity.getRootPath()}.${selection.verb}.${selection.index}`;
    return {
      title: `${selection.verb.toUpperCase()} Operation`,
      entity: restEntity,
      path: operationPath,
      omitFields: ['to'],
    };
  }, [restConfiguration, restEntities, selection]);

  const getOperationToUri = useCallback(
    (selectionValue: RestEditorSelection | undefined) => {
      if (selectionValue?.kind !== 'operation') return '';
      const restEntity = restEntities.find((entity) => entity.id === selectionValue.restId);
      if (!restEntity) return '';
      const restDefinition = restEntity.restDef?.rest ?? {};
      const operations = (restDefinition as Record<string, unknown>)[selectionValue.verb] as
        | Record<string, unknown>[]
        | undefined;
      const selectedOperation = operations?.[selectionValue.index];
      if (!selectedOperation) return '';
      const toValue = (selectedOperation as { to?: unknown }).to;
      if (typeof toValue === 'string') return toValue;
      if (toValue && typeof toValue === 'object') {
        return String((toValue as { uri?: string })?.uri ?? '');
      }
      return '';
    },
    [restEntities],
  );

  const toUriSchema = useMemo(() => {
    if (selection?.kind !== 'operation' || !selectedFormState) return undefined;
    const schema = selectedFormState.entity.getNodeSchema(selectedFormState.path) as
      | { properties?: Record<string, unknown>; required?: string[] }
      | undefined;
    const toSchema = schema?.properties?.to as
      | { properties?: Record<string, unknown>; required?: string[] }
      | undefined;
    const uriSchema = toSchema?.properties?.uri as
      | { title?: string; description?: string; default?: unknown; type?: string }
      | undefined;
    const isRequired =
      (Array.isArray(schema?.required) && schema?.required.includes('to')) ||
      (Array.isArray(toSchema?.required) && toSchema?.required.includes('uri'));

    return {
      title: uriSchema?.title ?? (toSchema as { title?: string } | undefined)?.title ?? 'To URI',
      description: uriSchema?.description ?? (toSchema as { description?: string } | undefined)?.description,
      defaultValue: uriSchema?.default ?? (toSchema as { default?: unknown } | undefined)?.default,
      required: isRequired,
    };
  }, [selectedFormState, selection]);

  const selectionKey = useMemo(() => {
    if (!selection) return 'none';
    if (selection.kind === 'restConfiguration') return 'restConfiguration';
    if (selection.kind === 'rest') return `rest-${selection.restId}`;
    return `op-${selection.restId}-${selection.verb}-${selection.index}`;
  }, [selection]);

  const lastSelectionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastSelectionKeyRef.current === selectionKey) return;
    lastSelectionKeyRef.current = selectionKey;
    setToUriValue(getOperationToUri(selection));
  }, [getOperationToUri, selection, selectionKey]);

  const selectedToUriItem = useMemo<TypeaheadItem<string> | undefined>(() => {
    if (!toUriValue) return undefined;
    return (
      directEndpointItems.find((item) => item.value === toUriValue) ?? {
        name: toUriValue,
        value: toUriValue,
      }
    );
  }, [directEndpointItems, toUriValue]);

  const formTabsValue: CanvasFormTabsContextResult = useMemo(
    () => ({
      selectedTab: 'All',
      setSelectedTab: () => {},
    }),
    [],
  );

  const handleOnChangeProp = useCallback(
    (path: string, value: unknown) => {
      if (!selectedFormState || !entitiesContext) return;

      let updatedValue = value;
      if (typeof value === 'string' && value.trim() === '') {
        updatedValue = undefined;
      }

      const newModel = selectedFormState.entity.getNodeDefinition(selectedFormState.path) ?? {};
      setValue(newModel, path, updatedValue);
      selectedFormState.entity.updateModel(selectedFormState.path, newModel);
      entitiesContext.updateSourceCodeFromEntities();
    },
    [entitiesContext, selectedFormState],
  );

  const handleToUriChange = useCallback(
    (item?: TypeaheadItem<string>) => {
      const nextValue = item?.value ?? '';
      setToUriValue(nextValue);
      handleOnChangeProp('to', nextValue || undefined);
    },
    [handleOnChangeProp],
  );

  const handleToUriClear = useCallback(() => {
    setToUriValue('');
    handleOnChangeProp('to', undefined);
  }, [handleOnChangeProp]);

  const handleSelectOperation = useCallback((restId: string, verb: RestVerb, index: number) => {
    setSelection({ kind: 'operation', restId, verb, index });
  }, []);

  const handleSelectRestConfiguration = useCallback(() => {
    setSelection({ kind: 'restConfiguration' });
  }, []);

  const handleSelectRest = useCallback((restId: string) => {
    setSelection({ kind: 'rest', restId });
  }, []);

  const handleImportMenuToggle = useCallback(() => {
    setIsImportMenuOpen((prev) => !prev);
  }, []);

  const importMenuToggleRenderer = useMemo(
    () => createRestDslImportMenuToggleRenderer(handleImportMenuToggle),
    [handleImportMenuToggle],
  );

  const openImportOpenApi = useCallback(() => {
    setIsImportOpenApiOpen(true);
    setIsImportMenuOpen(false);
    setOpenApiError('');
    setOpenApiSpecText('');
    setOpenApiSpecUri('');
    setImportOperations([]);
    setIsOpenApiParsed(false);
    setOpenApiLoadSource(undefined);
    setImportSelectAll(true);
    setImportCreateRest(false);
    setApicurioSearch('');
    setApicurioError('');
    setApicurioArtifacts([]);
    setFilteredApicurioArtifacts([]);
    setImportSource('uri');
    setSelectedApicurioId('');
  }, []);

  const closeImportOpenApi = useCallback(() => {
    setIsImportOpenApiOpen(false);
  }, []);

  const parseOpenApiSpec = useCallback(
    (specText: string): boolean => {
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
        const operations = buildImportOperations(spec);
        if (operations.length === 0) {
          setOpenApiError('No operations were found in the specification.');
          setImportOperations([]);
          setIsOpenApiParsed(false);
          return false;
        }

        setImportOperations(operations);
        setImportSelectAll(true);
        setOpenApiError('');
        setIsOpenApiParsed(true);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid OpenAPI specification.';
        setOpenApiError(message || 'Invalid OpenAPI specification.');
        setImportOperations([]);
        setIsOpenApiParsed(false);
        return false;
      }
    },
    [buildImportOperations],
  );

  const handleParseOpenApiSpec = useCallback(() => {
    const ok = parseOpenApiSpec(openApiSpecText);
    if (ok) {
      setOpenApiLoadSource('manual');
    }
  }, [openApiSpecText, parseOpenApiSpec]);

  const handleFetchOpenApiSpec = useCallback(async (): Promise<boolean> => {
    const uri = openApiSpecUri.trim();
    if (!uri) {
      setOpenApiError('Provide a specification URI to fetch.');
      setIsOpenApiParsed(false);
      return false;
    }

    try {
      const response = await fetch(uri);
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
      const message = error instanceof Error ? error.message : 'Unable to fetch specification from the provided URI.';
      setOpenApiError(message);
      setIsOpenApiParsed(false);
      return false;
    }
  }, [openApiSpecUri, parseOpenApiSpec]);

  const fetchApicurioArtifacts = useCallback(async () => {
    const apicurioRegistryUrl = settingsAdapter.getSettings().apicurioRegistryUrl;
    if (!apicurioRegistryUrl) return;

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
  }, [settingsAdapter]);

  const handleLoadFromApicurio = useCallback(
    async (artifactId: string): Promise<boolean> => {
      const apicurioRegistryUrl = settingsAdapter.getSettings().apicurioRegistryUrl;
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
    [parseOpenApiSpec, settingsAdapter],
  );

  useEffect(() => {
    if (!isImportOpenApiOpen || importSource !== 'apicurio') return;
    fetchApicurioArtifacts();
  }, [fetchApicurioArtifacts, importSource, isImportOpenApiOpen]);

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
    closeImportOpenApi();
  }, [closeImportOpenApi, entitiesContext, importCreateRest, importCreateRoutes, importOperations, openApiSpecUri]);

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
      setIsImportBusy(true);
      const ok = await handleFetchOpenApiSpec();
      setIsImportBusy(false);
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

  useEffect(() => {
    if (selection?.kind !== 'operation') return;
    const container = toUriFieldRef.current;
    if (!container) return;
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="rest-operation-to-uri-typeahead-select-input"]',
    );
    if (!input) return;

    const handleInput = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      const nextValue = target?.value ?? '';
      setToUriValue(nextValue);
    };

    input.addEventListener('input', handleInput);
    return () => {
      input.removeEventListener('input', handleInput);
    };
  }, [selection]);

  const normalizeRestTargetEndpoint = useCallback((value: string) => {
    if (value.startsWith('direct:')) return value;
    return `direct:${value}`;
  }, []);

  const directRouteExists = useMemo(() => {
    if (!toUriValue) return false;
    const normalized = normalizeRestTargetEndpoint(toUriValue.trim());
    return directRouteInputs.has(normalized);
  }, [directRouteInputs, normalizeRestTargetEndpoint, toUriValue]);

  const handleCreateDirectRoute = useCallback(() => {
    if (!entitiesContext || !canAddRestEntities) return;
    const rawValue = toUriValue?.trim();
    if (!rawValue) return;

    const normalized = normalizeRestTargetEndpoint(rawValue);
    if (!normalized.startsWith('direct:')) return;

    const camelResource = entitiesContext.camelResource as unknown as {
      addNewEntity: (type?: EntityType) => string;
      getVisualEntities: () => Array<{ id: string; type: EntityType }>;
    };

    const newId = camelResource.addNewEntity(EntityType.Route);
    const routeEntity = camelResource
      .getVisualEntities()
      .find((entity) => entity.type === EntityType.Route && entity.id === newId) as CamelRouteVisualEntity | undefined;

    routeEntity?.updateModel('route.from.uri', normalized);
    entitiesContext.updateEntitiesFromCamelResource();
  }, [canAddRestEntities, entitiesContext, normalizeRestTargetEndpoint, toUriValue]);

  const handleCreateRestConfiguration = useCallback(() => {
    if (!entitiesContext || !canAddRestEntities || restConfiguration) return;

    const camelResource = entitiesContext.camelResource as { addNewEntity: (type?: EntityType) => string };
    camelResource.addNewEntity(EntityType.RestConfiguration);
    entitiesContext.updateEntitiesFromCamelResource();
    setSelection({ kind: 'restConfiguration' });
  }, [canAddRestEntities, entitiesContext, restConfiguration]);

  const handleCreateRest = useCallback(() => {
    if (!entitiesContext || !canAddRestEntities) return;

    const camelResource = entitiesContext.camelResource as { addNewEntity: (type?: EntityType) => string };
    const newId = camelResource.addNewEntity(EntityType.Rest);
    entitiesContext.updateEntitiesFromCamelResource();
    if (newId) {
      setSelection({ kind: 'rest', restId: newId });
    }
  }, [canAddRestEntities, entitiesContext]);

  const openAddOperationModal = useCallback(
    (restId: string) => {
      setAddOperationRestId(restId);
      setOperationVerb('get');
      setOperationId(getCamelRandomId('rest'));
      setOperationPath('');
      setIsAddOperationOpen(true);
      requestAnimationFrame(() => {
        uriInputRef.current?.focus();
      });
    },
    [setIsAddOperationOpen],
  );

  const closeAddOperationModal = useCallback(() => {
    setIsAddOperationOpen(false);
    setAddOperationRestId(undefined);
  }, []);

  const handleVerbToggle = useCallback(() => {
    setIsVerbSelectOpen((prev) => !prev);
  }, [setNavWidth]);

  const handleCreateOperation = useCallback(() => {
    if (!entitiesContext || !addOperationRestId) return;
    const restEntity = restEntities.find((entity) => entity.id === addOperationRestId);
    if (!restEntity) return;

    const restDefinition = restEntity.restDef.rest ?? {};
    const operations = (restDefinition as Record<string, unknown>)[operationVerb] as
      | Record<string, unknown>[]
      | undefined;
    const normalizedOperations = operations ? [...operations] : [];
    const resolvedId = operationId.trim() || getCamelRandomId(operationVerb);

    normalizedOperations.push({
      id: resolvedId,
      path: operationPath.trim() || '/',
      to: {
        uri: `direct:${resolvedId}`,
      },
    });

    (restDefinition as Record<string, unknown>)[operationVerb] = normalizedOperations;
    restEntity.updateModel(restEntity.getRootPath(), restDefinition);
    entitiesContext.updateEntitiesFromCamelResource();

    setSelection({
      kind: 'operation',
      restId: addOperationRestId,
      verb: operationVerb,
      index: normalizedOperations.length - 1,
    });
    closeAddOperationModal();
  }, [
    addOperationRestId,
    closeAddOperationModal,
    entitiesContext,
    operationId,
    operationPath,
    operationVerb,
    restEntities,
  ]);

  const confirmDelete = useCallback(
    async (title: string, text: string) => {
      if (!actionConfirmation) {
        return globalThis.confirm(text);
      }

      const result = await actionConfirmation.actionConfirmation({
        title,
        text,
      });
      return result === ACTION_ID_CONFIRM;
    },
    [actionConfirmation],
  );

  const handleDeleteRestConfiguration = useCallback(async () => {
    if (!entitiesContext || !restConfiguration || !canDeleteRestEntities) return;
    const shouldDelete = await confirmDelete('Delete Rest Configuration', 'This will remove the Rest Configuration.');
    if (!shouldDelete) return;

    const camelResource = entitiesContext.camelResource as { removeEntity: (ids?: string[]) => void };
    camelResource.removeEntity([restConfiguration.id]);
    entitiesContext.updateEntitiesFromCamelResource();
    setSelection(undefined);
  }, [canDeleteRestEntities, confirmDelete, entitiesContext, restConfiguration]);

  const handleDeleteRest = useCallback(
    async (restEntity: CamelRestVisualEntity) => {
      if (!entitiesContext || !canDeleteRestEntities) return;
      const label = restEntity.restDef?.rest?.path || restEntity.id;
      const shouldDelete = await confirmDelete('Delete Rest Element', `This will remove ${label}.`);
      if (!shouldDelete) return;

      const camelResource = entitiesContext.camelResource as { removeEntity: (ids?: string[]) => void };
      camelResource.removeEntity([restEntity.id]);
      entitiesContext.updateEntitiesFromCamelResource();
      setSelection(undefined);
    },
    [canDeleteRestEntities, confirmDelete, entitiesContext],
  );

  const handleDeleteOperation = useCallback(
    async (restEntity: CamelRestVisualEntity, verb: RestVerb, index: number) => {
      if (!entitiesContext) return;
      const restDefinition = restEntity.restDef.rest ?? {};
      const operations = (restDefinition as Record<string, unknown>)[verb] as Record<string, unknown>[] | undefined;
      if (!operations?.[index]) return;
      const pathLabel = (operations[index] as { path?: string }).path ?? '';
      const shouldDelete = await confirmDelete(
        'Delete Operation',
        `This will remove ${verb.toUpperCase()} ${pathLabel || ''}.`,
      );
      if (!shouldDelete) return;

      const updated = operations.filter((_operation, idx) => idx !== index);
      if (updated.length === 0) {
        delete (restDefinition as Record<string, unknown>)[verb];
      } else {
        (restDefinition as Record<string, unknown>)[verb] = updated;
      }

      restEntity.updateModel(restEntity.getRootPath(), restDefinition);
      entitiesContext.updateEntitiesFromCamelResource();
      setSelection({ kind: 'rest', restId: restEntity.id });
    },
    [confirmDelete, entitiesContext],
  );

  const handleResizeStart = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      resizeRef.current = {
        startX: event.clientX,
        startWidth: navWidth,
        isDragging: true,
      };
      event.preventDefault();
    },
    [navWidth],
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeRef.current?.isDragging) return;
      const delta = event.clientX - resizeRef.current.startX;
      const nextWidth = resizeRef.current.startWidth + delta;
      const clamped = Math.max(NAV_MIN_WIDTH, Math.min(NAV_MAX_WIDTH, nextWidth));
      setNavWidth(clamped);
    };

    const handleMouseUp = () => {
      if (resizeRef.current) {
        resizeRef.current.isDragging = false;
      }
    };

    globalThis.addEventListener('mousemove', handleMouseMove);
    globalThis.addEventListener('mouseup', handleMouseUp);

    return () => {
      globalThis.removeEventListener('mousemove', handleMouseMove);
      globalThis.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const formKey = useMemo(() => {
    if (!selection) return `rest-form-${catalogKey}-none`;
    if (selection.kind === 'restConfiguration') return `rest-form-${catalogKey}-config`;
    if (selection.kind === 'rest') return `rest-form-${catalogKey}-rest-${selection.restId}`;
    return `rest-form-${catalogKey}-op-${selection.restId}-${selection.verb}-${selection.index}`;
  }, [catalogKey, selection]);

  const operationSchema = useMemo(() => {
    return CamelCatalogService.getComponent(CatalogKind.Processor, operationVerb)?.propertiesSchema;
  }, [operationVerb]);

  const getOperationFieldHelp = useCallback(
    (fieldName: string, fallbackTitle?: string) => {
      const schemaProperty = operationSchema?.properties?.[fieldName] as
        | { title?: string; description?: string; default?: unknown; type?: string; enum?: unknown[] }
        | undefined;
      const description = schemaProperty?.description;
      const defaultValue = schemaProperty?.default;
      const title = schemaProperty?.title ?? fallbackTitle ?? fieldName;
      const type = schemaProperty?.type ?? (Array.isArray(schemaProperty?.enum) ? 'enum' : undefined);

      if (!description && defaultValue === undefined) return undefined;

      return (
        <Popover
          bodyContent={
            <div>
              <strong>
                {title}
                {type ? ` <${type}>` : ''}
              </strong>
              {description && <p>{description}</p>}
              {defaultValue !== undefined && (
                <p>
                  Default:{' '}
                  {typeof defaultValue === 'string' ||
                  typeof defaultValue === 'number' ||
                  typeof defaultValue === 'boolean'
                    ? String(defaultValue)
                    : JSON.stringify(defaultValue)}
                </p>
              )}
            </div>
          }
          triggerAction="hover"
          withFocusTrap={false}
        >
          <Button variant="plain" aria-label={`More info about ${title}`} icon={<HelpIcon />} />
        </Popover>
      );
    },
    [operationSchema],
  );

  return (
    <ActionConfirmationModalContextProvider>
      <AlertGroup isToast className="rest-dsl-page-toast">
        {importStatus && (
          <Alert
            variant={importStatus.type === 'success' ? 'success' : 'danger'}
            title={importStatus.message}
            isLiveRegion
          />
        )}
      </AlertGroup>
      <div className="rest-dsl-page">
        <Split className="rest-dsl-page-split" hasGutter>
          <RestDslNav
            navWidth={navWidth}
            isImportMenuOpen={isImportMenuOpen}
            importMenuToggleRenderer={importMenuToggleRenderer}
            onImportMenuSelect={() => setIsImportMenuOpen(false)}
            onImportOpenApi={openImportOpenApi}
            restConfiguration={restConfiguration}
            restEntities={restEntities}
            restMethods={REST_METHODS}
            selection={selection}
            canAddRestEntities={canAddRestEntities}
            canDeleteRestEntities={canDeleteRestEntities}
            onCreateRestConfiguration={handleCreateRestConfiguration}
            onDeleteRestConfiguration={handleDeleteRestConfiguration}
            onSelectRestConfiguration={handleSelectRestConfiguration}
            onCreateRest={handleCreateRest}
            onDeleteRest={handleDeleteRest}
            onSelectRest={handleSelectRest}
            onAddOperation={openAddOperationModal}
            onSelectOperation={handleSelectOperation}
            onDeleteOperation={handleDeleteOperation}
            getListItemClass={getListItemClass}
          />
          <button
            type="button"
            className="rest-dsl-page-resize-handle"
            onMouseDown={handleResizeStart}
            aria-label="Resize panels"
          >
            <hr className="rest-dsl-page-resize-handle-line" />
            <span className="rest-dsl-page-resize-grip" aria-hidden="true">
              ||
            </span>
          </button>
          <RestDslDetails
            formKey={formKey}
            selectedFormState={selectedFormState}
            selection={selection}
            formTabsValue={formTabsValue}
            toUriSchema={toUriSchema}
            toUriFieldRef={toUriFieldRef}
            selectedToUriItem={selectedToUriItem}
            directEndpointItems={directEndpointItems}
            toUriValue={toUriValue}
            directRouteExists={directRouteExists}
            onToUriChange={handleToUriChange}
            onToUriClear={handleToUriClear}
            onCreateDirectRoute={handleCreateDirectRoute}
            onChangeProp={handleOnChangeProp}
          />
        </Split>
        {isAddOperationOpen && (
          <Modal isOpen variant={ModalVariant.small} onClose={closeAddOperationModal} aria-label="Add REST Operation">
            <ModalHeader title="Add REST Operation" />
            <ModalBody>
              <Form>
                <FormGroup
                  label="Operation Id"
                  fieldId="rest-operation-id"
                  labelHelp={getOperationFieldHelp('id', 'Id')}
                >
                  <TextInput
                    id="rest-operation-id"
                    value={operationId}
                    onChange={(_event, value) => setOperationId(value)}
                  />
                </FormGroup>
                <FormGroup
                  label="URI"
                  fieldId="rest-operation-uri"
                  isRequired
                  labelHelp={getOperationFieldHelp('path', 'Path')}
                >
                  <TextInput
                    id="rest-operation-uri"
                    value={operationPath}
                    onChange={(_event, value) => setOperationPath(value)}
                    isRequired
                    ref={uriInputRef}
                  />
                </FormGroup>
                <FormGroup
                  label="Operation Type"
                  fieldId="rest-operation-type"
                  isRequired
                  labelHelp={<OperationTypeHelp />}
                >
                  <OperationVerbSelect
                    isOpen={isVerbSelectOpen}
                    selected={operationVerb}
                    verbs={REST_METHODS}
                    onSelect={(value) => {
                      setOperationVerb(value);
                      setIsVerbSelectOpen(false);
                    }}
                    onOpenChange={setIsVerbSelectOpen}
                    onToggle={handleVerbToggle}
                  />
                </FormGroup>
              </Form>
            </ModalBody>
            <ModalFooter>
              <Button variant="primary" onClick={handleCreateOperation} isDisabled={!operationPath.trim()}>
                Add Operation
              </Button>
              <Button variant="link" onClick={closeAddOperationModal}>
                Cancel
              </Button>
            </ModalFooter>
          </Modal>
        )}
        <RestDslImportWizard
          isOpen={isImportOpenApiOpen}
          apicurioRegistryUrl={settingsAdapter.getSettings().apicurioRegistryUrl}
          importSource={importSource}
          openApiSpecUri={openApiSpecUri}
          openApiSpecText={openApiSpecText}
          openApiError={openApiError}
          apicurioError={apicurioError}
          apicurioSearch={apicurioSearch}
          filteredApicurioArtifacts={filteredApicurioArtifacts}
          selectedApicurioId={selectedApicurioId}
          isApicurioLoading={isApicurioLoading}
          isImportBusy={isImportBusy}
          isOpenApiParsed={isOpenApiParsed}
          importCreateRest={importCreateRest}
          importCreateRoutes={importCreateRoutes}
          importSelectAll={importSelectAll}
          importOperations={importOperations}
          openApiLoadSource={openApiLoadSource}
          openApiFileInputRef={openApiFileInputRef}
          onClose={closeImportOpenApi}
          onImportSourceChange={handleImportSourceChange}
          onOpenApiSpecUriChange={setOpenApiSpecUri}
          onFetchOpenApiSpec={handleFetchOpenApiSpec}
          onOpenApiSpecTextChange={setOpenApiSpecText}
          onParseOpenApiSpec={handleParseOpenApiSpec}
          onToggleImportCreateRest={setImportCreateRest}
          onToggleImportCreateRoutes={setImportCreateRoutes}
          onToggleSelectAllOperations={handleToggleSelectAllOperations}
          onToggleOperation={handleToggleOperation}
          onUploadOpenApiClick={handleUploadOpenApiClick}
          onUploadOpenApiFile={handleUploadOpenApiFile}
          onApicurioSearchChange={setApicurioSearch}
          onFetchApicurioArtifacts={fetchApicurioArtifacts}
          onSelectApicurioArtifact={setSelectedApicurioId}
          onWizardNext={handleWizardNext}
          onImportOpenApi={handleImportOpenApi}
        />
      </div>
    </ActionConfirmationModalContextProvider>
  );
};

const getListItemClass = (selection: RestEditorSelection | undefined, target: RestEditorSelection): string => {
  const isSelected =
    selection?.kind === target.kind &&
    (target.kind === 'restConfiguration' ||
      (selection?.kind !== 'restConfiguration' &&
        selection?.restId === (target as { restId?: string }).restId &&
        (target.kind !== 'operation' ||
          (selection?.kind === 'operation' && selection.verb === target.verb && selection.index === target.index))));

  return `rest-dsl-page-item${isSelected ? ' rest-dsl-page-item-selected' : ''}`;
};
