import './RestDslPage.scss';

import {
  CanvasFormTabsContext,
  CanvasFormTabsContextResult,
  FieldWrapper,
  KaotoForm,
  Typeahead,
  TypeaheadItem,
} from '@kaoto/forms';
import {
  Bullseye,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  Form,
  FormGroup,
  List,
  ListItem,
  MenuToggle,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Popover,
  Radio,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  Split,
  SplitItem,
  TextArea,
  TextInput,
  Title,
  Wizard,
  WizardFooterWrapper,
  WizardStep,
} from '@patternfly/react-core';
import { CheckCircleIcon, CodeIcon, EllipsisVIcon, HelpIcon, PlusIcon, TrashIcon } from '@patternfly/react-icons';
import { FunctionComponent, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { parse as parseYaml } from 'yaml';

import { getCamelRandomId } from '../../camel-utils/camel-random-id';
import { customFieldsFactoryfactory } from '../../components/Visualization/Canvas/Form/fields/custom-fields-factory';
import { SuggestionRegistrar } from '../../components/Visualization/Canvas/Form/suggestions/SuggestionsProvider';
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
import { SettingsContext } from '../../providers';
import { EntitiesContext } from '../../providers';
import {
  ACTION_ID_CONFIRM,
  ActionConfirmationModalContext,
  ActionConfirmationModalContextProvider,
} from '../../providers/action-confirmation-modal.provider';
import { getValue, setValue } from '../../utils';

type RestVerb = (typeof CamelComponentFilterService.REST_DSL_METHODS)[number];
type ImportLoadSource = 'uri' | 'file' | 'apicurio' | 'manual' | undefined;

type RestEditorSelection =
  | { kind: 'restConfiguration' }
  | { kind: 'rest'; restId: string }
  | { kind: 'operation'; restId: string; verb: RestVerb; index: number };

type ApicurioArtifact = {
  id: string;
  name: string;
  type: string;
};

type ApicurioArtifactSearchResult = {
  artifacts: ApicurioArtifact[];
};

type ImportSourceOption = 'uri' | 'file' | 'apicurio';

const REST_METHODS = CamelComponentFilterService.REST_DSL_METHODS;
const NAV_MIN_WIDTH = 220;
const NAV_MAX_WIDTH = 520;
const ALLOWED_REST_TARGET_ENDPOINTS = ['direct:'] as const;
const OPENAPI_METHODS: RestVerb[] = ['get', 'post', 'put', 'delete', 'head', 'patch'];

type ImportOperation = {
  operationId: string;
  method: RestVerb;
  path: string;
  selected: boolean;
  routeExists: boolean;
};

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
    return fallback.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || `${method}_${Date.now()}`;
  }, []);

  const buildImportOperations = useCallback(
    (spec: Record<string, unknown>) => {
      const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;
      const operations: ImportOperation[] = [];

      Object.entries(paths).forEach(([path, pathItem]) => {
        OPENAPI_METHODS.forEach((method) => {
          const operation = pathItem?.[method] as Record<string, unknown> | undefined;
          if (!operation) return;
          const operationId = normalizeOperationId(String(operation.operationId ?? ''), method, path);
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

    const collect = (value: unknown) => {
      if (!value) return;
      if (typeof value === 'string') {
        if (isAllowedRestTargetEndpoint(value)) {
          endpoints.add(value);
        }
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => collect(item));
        return;
      }
      if (typeof value === 'object') {
        if (visited.has(value)) return;
        visited.add(value);
        const uriValue = getValue(value, 'uri');
        if (typeof uriValue === 'string') {
          if (isAllowedRestTargetEndpoint(uriValue)) {
            endpoints.add(uriValue);
          } else if (uriValue === 'direct') {
            const directName = getValue(value, 'parameters.name');
            if (typeof directName === 'string' && directName.trim()) {
              endpoints.add(`direct:${directName.trim()}`);
            }
          }
        }
        Object.values(value).forEach((item) => collect(item));
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
  const [importCreateRest, setImportCreateRest] = useState(true);
  const [importCreateRoutes, setImportCreateRoutes] = useState(true);
  const [importSelectAll, setImportSelectAll] = useState(true);
  const [apicurioArtifacts, setApicurioArtifacts] = useState<ApicurioArtifact[]>([]);
  const [filteredApicurioArtifacts, setFilteredApicurioArtifacts] = useState<ApicurioArtifact[]>([]);
  const [apicurioSearch, setApicurioSearch] = useState('');
  const [apicurioError, setApicurioError] = useState('');
  const [isApicurioLoading, setIsApicurioLoading] = useState(false);
  const [selectedApicurioId, setSelectedApicurioId] = useState('');
  const [isImportBusy, setIsImportBusy] = useState(false);
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
      if (!selectionValue || selectionValue.kind !== 'operation') return '';
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
      if (toValue && typeof toValue === 'object' && 'uri' in toValue) {
        return String((toValue as { uri?: string }).uri ?? '');
      }
      return '';
    },
    [restEntities],
  );

  const toUriSchema = useMemo(() => {
    if (!selection || selection.kind !== 'operation' || !selectedFormState) return undefined;
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
        setOpenApiError('Invalid OpenAPI specification.');
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
      setOpenApiError('Unable to fetch specification from the provided URI.');
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
      setApicurioError('Unable to fetch artifacts from Apicurio Registry.');
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
        setApicurioError('Unable to download the selected artifact.');
        return false;
      } finally {
        setIsApicurioLoading(false);
      }
    },
    [parseOpenApiSpec, settingsAdapter],
  );

  useEffect(() => {
    if (!isImportOpenApiOpen) return;
    fetchApicurioArtifacts();
  }, [fetchApicurioArtifacts, isImportOpenApiOpen]);

  useEffect(() => {
    if (!apicurioSearch.trim()) {
      setFilteredApicurioArtifacts(apicurioArtifacts);
      return;
    }
    const lowered = apicurioSearch.toLowerCase();
    setFilteredApicurioArtifacts(apicurioArtifacts.filter((artifact) => artifact.name.toLowerCase().includes(lowered)));
  }, [apicurioArtifacts, apicurioSearch]);

  const handleUploadOpenApiClick = useCallback(() => {
    openApiFileInputRef.current?.click();
  }, []);

  const handleUploadOpenApiFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      try {
        const parsed = parseOpenApiSpec(content);
        if (parsed) {
          setOpenApiLoadSource('file');
        }
        setOpenApiSpecUri(file.name);
      } catch (error) {
        setOpenApiError('Unable to parse the uploaded specification.');
        setIsOpenApiParsed(false);
      }
    };
    reader.onerror = () => {
      setOpenApiError('Unable to read the uploaded specification.');
      setIsOpenApiParsed(false);
    };
    reader.readAsText(file);
    event.target.value = '';
  }, []);

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
    if (!entitiesContext || (!importCreateRest && !importCreateRoutes)) return;
    const selectedOperations = importOperations.filter((operation) => operation.selected);
    if (selectedOperations.length === 0) {
      setOpenApiError('Select at least one operation to import.');
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
            to: `direct:${operation.operationId}`,
          });
          restDefinition[methodKey] = list;
        });

        restEntity.updateModel(restEntity.getRootPath(), restDefinition);
      }
    }

    entitiesContext.updateEntitiesFromCamelResource();
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
        return window.confirm(text);
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
      if (!operations || !operations[index]) return;
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
    (event: React.MouseEvent<HTMLDivElement>) => {
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

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
              {defaultValue !== undefined && <p>Default: {String(defaultValue)}</p>}
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
      <div className="rest-dsl-page">
        <Split className="rest-dsl-page-split" hasGutter>
          <SplitItem className="rest-dsl-page-pane rest-dsl-page-pane-nav" style={{ flexBasis: navWidth }}>
            <Card className="rest-dsl-page-panel">
              <CardHeader>
                <div className="rest-dsl-page-header">
                  <Title headingLevel="h2" size="md">
                    Rest DSL
                  </Title>
                  <Dropdown
                    isOpen={isImportMenuOpen}
                    onSelect={() => setIsImportMenuOpen(false)}
                    toggle={(toggleRef) => (
                      <MenuToggle
                        ref={toggleRef}
                        variant="plain"
                        aria-label="Rest DSL actions"
                        onClick={() => setIsImportMenuOpen((prev) => !prev)}
                        icon={<EllipsisVIcon />}
                      />
                    )}
                  >
                    <DropdownList>
                      <DropdownItem onClick={openImportOpenApi}>Import OpenAPI</DropdownItem>
                    </DropdownList>
                  </Dropdown>
                </div>
              </CardHeader>
              <CardBody className="rest-dsl-page-panel-body">
                <div className="rest-dsl-page-section-header">
                  <Title headingLevel="h3" size="sm" className="rest-dsl-page-section-title">
                    Rest Configuration
                  </Title>
                  <div className="rest-dsl-page-section-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<PlusIcon />}
                      onClick={handleCreateRestConfiguration}
                      isDisabled={!canAddRestEntities || Boolean(restConfiguration)}
                    >
                      Add
                    </Button>
                  </div>
                </div>
                {restConfiguration ? (
                  <List className="rest-dsl-page-list">
                    <ListItem>
                      <div className="rest-dsl-page-rest-header">
                        <button
                          className={getListItemClass(selection, { kind: 'restConfiguration' })}
                          onClick={() => setSelection({ kind: 'restConfiguration' })}
                          type="button"
                        >
                          Rest Configuration
                        </button>
                        <div className="rest-dsl-page-rest-actions">
                          <Button
                            variant="plain"
                            size="sm"
                            icon={<TrashIcon />}
                            aria-label="Delete Rest Configuration"
                            onClick={handleDeleteRestConfiguration}
                            isDisabled={!canDeleteRestEntities}
                          />
                        </div>
                      </div>
                    </ListItem>
                  </List>
                ) : (
                  <p className="rest-dsl-page-empty-text">No rest configuration found.</p>
                )}

                <div className="rest-dsl-page-section-header">
                  <Title headingLevel="h3" size="sm" className="rest-dsl-page-section-title">
                    Rest Services
                  </Title>
                  <div className="rest-dsl-page-section-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<PlusIcon />}
                      onClick={handleCreateRest}
                      isDisabled={!canAddRestEntities}
                    >
                      Add
                    </Button>
                  </div>
                </div>
                {restEntities.length === 0 ? (
                  <p className="rest-dsl-page-empty-text">No rest elements found.</p>
                ) : (
                  <List className="rest-dsl-page-list">
                    {restEntities.map((restEntity) => {
                      const restDefinition = restEntity.restDef?.rest ?? {};
                      return (
                        <ListItem key={restEntity.id}>
                          <div className="rest-dsl-page-rest-group">
                            <div className="rest-dsl-page-rest-header">
                              <button
                                className={getListItemClass(selection, { kind: 'rest', restId: restEntity.id })}
                                onClick={() => setSelection({ kind: 'rest', restId: restEntity.id })}
                                type="button"
                              >
                                {restDefinition.path || restEntity.id || 'rest'}
                              </button>
                              <div className="rest-dsl-page-rest-actions">
                                <Button
                                  variant="link"
                                  icon={<PlusIcon />}
                                  size="sm"
                                  onClick={() => openAddOperationModal(restEntity.id)}
                                >
                                  Add Operation
                                </Button>
                                <Button
                                  variant="plain"
                                  size="sm"
                                  icon={<TrashIcon />}
                                  aria-label="Delete Rest Element"
                                  onClick={() => handleDeleteRest(restEntity)}
                                  isDisabled={!canDeleteRestEntities}
                                />
                              </div>
                            </div>
                            <List className="rest-dsl-page-list rest-dsl-page-list-nested">
                              {REST_METHODS.flatMap((verb) => {
                                const operations = (restDefinition as Record<string, unknown>)[verb] as
                                  | Array<{ path?: string; id?: string }>
                                  | undefined;
                                if (!operations || operations.length === 0) return [];

                                return operations.map((operation, index) => (
                                  <ListItem key={`${restEntity.id}-${verb}-${index}`}>
                                    <div className="rest-dsl-page-operation-row">
                                      <button
                                        className={getListItemClass(selection, {
                                          kind: 'operation',
                                          restId: restEntity.id,
                                          verb,
                                          index,
                                        })}
                                        onClick={() =>
                                          setSelection({ kind: 'operation', restId: restEntity.id, verb, index })
                                        }
                                        type="button"
                                      >
                                        <span className={`rest-dsl-page-verb rest-dsl-page-verb-${verb}`}>
                                          {verb.toUpperCase()}
                                        </span>
                                        <span className="rest-dsl-page-operation-path">
                                          {operation?.path || operation?.id || '/'}
                                        </span>
                                      </button>
                                      <Button
                                        variant="plain"
                                        size="sm"
                                        icon={<TrashIcon />}
                                        aria-label="Delete Operation"
                                        onClick={() => handleDeleteOperation(restEntity, verb, index)}
                                      />
                                    </div>
                                  </ListItem>
                                ));
                              })}
                            </List>
                          </div>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </CardBody>
            </Card>
          </SplitItem>
          <div className="rest-dsl-page-resize-handle" onMouseDown={handleResizeStart} role="separator" />

          <SplitItem className="rest-dsl-page-pane rest-dsl-page-pane-form" isFilled>
            <Card className="rest-dsl-page-panel">
              <CardHeader>
                <Title headingLevel="h2" size="md">
                  {selectedFormState?.title ?? 'Details'}
                </Title>
              </CardHeader>
              <CardBody className="rest-dsl-page-panel-body">
                {selectedFormState ? (
                  <CanvasFormTabsContext.Provider value={formTabsValue}>
                    <SuggestionRegistrar>
                      {selection?.kind === 'operation' && (
                        <FieldWrapper
                          propName="to.uri"
                          required={toUriSchema?.required ?? false}
                          title={toUriSchema?.title ?? 'To URI'}
                          type="string"
                          description={toUriSchema?.description}
                          defaultValue={toUriSchema?.defaultValue?.toString()}
                        >
                          <div className="rest-dsl-page-to-uri-row" ref={toUriFieldRef}>
                            <Typeahead
                              aria-label={toUriSchema?.title ?? 'To URI'}
                              data-testid="rest-operation-to-uri"
                              selectedItem={selectedToUriItem}
                              items={directEndpointItems}
                              placeholder="Select or write a direct endpoint"
                              id="rest-operation-to-uri"
                              onChange={handleToUriChange}
                              onCleanInput={handleToUriClear}
                              allowCustomInput
                            />
                            <Popover
                              bodyContent={
                                directRouteExists
                                  ? 'A route with this direct endpoint already exists.'
                                  : 'Create a new route that uses this direct endpoint as its input.'
                              }
                              triggerAction="hover"
                              withFocusTrap={false}
                            >
                              <span>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={handleCreateDirectRoute}
                                  isDisabled={!toUriValue || directRouteExists}
                                >
                                  Create Route
                                </Button>
                              </span>
                            </Popover>
                          </div>
                        </FieldWrapper>
                      )}
                      <KaotoForm
                        key={formKey}
                        schema={selectedFormState.entity.getNodeSchema(selectedFormState.path) ?? {}}
                        model={selectedFormState.entity.getNodeDefinition(selectedFormState.path) ?? {}}
                        onChangeProp={handleOnChangeProp}
                        omitFields={selectedFormState.omitFields}
                        customFieldsFactory={customFieldsFactoryfactory}
                      />
                    </SuggestionRegistrar>
                  </CanvasFormTabsContext.Provider>
                ) : (
                  <Bullseye>
                    <EmptyState headingLevel="h3" icon={CodeIcon} titleText="Nothing selected">
                      <EmptyStateBody>Select a Rest element to start editing.</EmptyStateBody>
                    </EmptyState>
                  </Bullseye>
                )}
              </CardBody>
            </Card>
          </SplitItem>
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
                  labelHelp={
                    <Popover
                      bodyContent="Select the HTTP method to create for this REST operation."
                      triggerAction="hover"
                      withFocusTrap={false}
                    >
                      <Button variant="plain" aria-label="More info about Operation Type" icon={<HelpIcon />} />
                    </Popover>
                  }
                >
                  <Select
                    isOpen={isVerbSelectOpen}
                    selected={operationVerb}
                    onSelect={(_event, value) => {
                      setOperationVerb(value as RestVerb);
                      setIsVerbSelectOpen(false);
                    }}
                    onOpenChange={setIsVerbSelectOpen}
                    toggle={(toggleRef) => (
                      <MenuToggle ref={toggleRef} onClick={() => setIsVerbSelectOpen((prev) => !prev)}>
                        {operationVerb.toUpperCase()}
                      </MenuToggle>
                    )}
                  >
                    <SelectList>
                      {REST_METHODS.map((verb) => (
                        <SelectOption key={verb} itemId={verb}>
                          {verb.toUpperCase()}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
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
        {isImportOpenApiOpen && (
          <Modal
            isOpen
            variant={ModalVariant.large}
            aria-label="Import OpenAPI"
            onClose={closeImportOpenApi}
            className="rest-dsl-page-import-modal"
          >
            <ModalHeader title="Import OpenAPI" />
            <ModalBody>
              <Wizard
                onClose={closeImportOpenApi}
                footer={(activeStep, goToNextStep, goToPrevStep, close) => {
                  const isSourceStep = activeStep.id === 'source';
                  const isOperationsStep = activeStep.id === 'operations';
                  const handleNextClick = async () => {
                    if (isOperationsStep) {
                      handleImportOpenApi();
                      return;
                    }
                    const ok = await handleWizardNext();
                    if (ok) {
                      goToNextStep();
                    }
                  };

                  return (
                    <WizardFooterWrapper className="rest-dsl-page-import-footer">
                      <Button variant="secondary" onClick={goToPrevStep} isDisabled={isSourceStep || isImportBusy}>
                        Back
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleNextClick}
                        isDisabled={
                          isImportBusy ||
                          (isOperationsStep && (!isOpenApiParsed || (!importCreateRest && !importCreateRoutes)))
                        }
                      >
                        {isOperationsStep ? 'Finish' : 'Next'}
                      </Button>
                      <Button variant="link" onClick={close}>
                        Cancel
                      </Button>
                    </WizardFooterWrapper>
                  );
                }}
              >
                <WizardStep name="Import source" id="source">
                  <Form>
                    <FormGroup label="Choose import source" fieldId="rest-openapi-import-source">
                      <Radio
                        id="rest-openapi-import-uri"
                        name="rest-openapi-import-source"
                        label="Import from URI"
                        isChecked={importSource === 'uri'}
                        onChange={() => handleImportSourceChange('uri')}
                      />
                      {importSource === 'uri' && (
                        <div className="rest-dsl-page-import-source">
                          <div className="rest-dsl-page-import-uri-row">
                            <TextInput
                              id="rest-openapi-spec-uri"
                              value={openApiSpecUri}
                              onChange={(_event, value) => setOpenApiSpecUri(value)}
                            />
                            <Button
                              variant="secondary"
                              onClick={handleFetchOpenApiSpec}
                              isDisabled={!openApiSpecUri.trim() || isImportBusy}
                            >
                              Fetch
                            </Button>
                          </div>
                          {isOpenApiParsed && openApiLoadSource === 'uri' && (
                            <span className="rest-dsl-page-import-success rest-dsl-page-import-success-block">
                              <CheckCircleIcon /> Loaded
                            </span>
                          )}
                        </div>
                      )}
                      <Radio
                        id="rest-openapi-import-file"
                        name="rest-openapi-import-source"
                        label="Upload file"
                        isChecked={importSource === 'file'}
                        onChange={() => handleImportSourceChange('file')}
                      />
                      {importSource === 'file' && (
                        <div className="rest-dsl-page-import-source">
                          <Button variant="secondary" onClick={handleUploadOpenApiClick}>
                            Upload
                          </Button>
                          {isOpenApiParsed && openApiLoadSource === 'file' && (
                            <span className="rest-dsl-page-import-success">
                              <CheckCircleIcon /> Loaded
                            </span>
                          )}
                          <input
                            ref={openApiFileInputRef}
                            type="file"
                            accept=".json,.yaml,.yml,application/json,application/yaml,application/x-yaml,text/yaml,text/x-yaml"
                            onChange={handleUploadOpenApiFile}
                            className="rest-dsl-page-import-file-input"
                          />
                        </div>
                      )}
                      <Radio
                        id="rest-openapi-import-apicurio"
                        name="rest-openapi-import-source"
                        label="Import from Apicurio"
                        isChecked={importSource === 'apicurio'}
                        onChange={() => handleImportSourceChange('apicurio')}
                      />
                      {importSource === 'apicurio' && (
                        <div className="rest-dsl-page-import-source rest-dsl-page-import-apicurio">
                          {settingsAdapter.getSettings().apicurioRegistryUrl ? (
                            <>
                              <div className="rest-dsl-page-import-apicurio-toolbar">
                                <SearchInput
                                  aria-label="Search Apicurio artifacts"
                                  placeholder="Search OpenAPI artifacts"
                                  value={apicurioSearch}
                                  onChange={(_event, value) => setApicurioSearch(value)}
                                />
                                <Button variant="secondary" size="sm" onClick={fetchApicurioArtifacts}>
                                  Refresh
                                </Button>
                              </div>
                              {apicurioError && <span className="rest-dsl-page-import-error">{apicurioError}</span>}
                              <div className="rest-dsl-page-import-list-scroll rest-dsl-page-import-apicurio-list">
                                <List className="rest-dsl-page-list rest-dsl-page-list-nested">
                                  {filteredApicurioArtifacts.map((artifact) => (
                                    <ListItem key={artifact.id}>
                                      <Radio
                                        id={`rest-openapi-apicurio-${artifact.id}`}
                                        name="rest-openapi-apicurio-artifact"
                                        label={
                                          <span>
                                            {artifact.name || artifact.id}{' '}
                                            <span className="rest-dsl-page-import-note">(id: {artifact.id})</span>
                                          </span>
                                        }
                                        isChecked={selectedApicurioId === artifact.id}
                                        onChange={() => setSelectedApicurioId(artifact.id)}
                                      />
                                    </ListItem>
                                  ))}
                                  {filteredApicurioArtifacts.length === 0 && !isApicurioLoading && (
                                    <ListItem>No OpenAPI artifacts found.</ListItem>
                                  )}
                                </List>
                              </div>
                              {isOpenApiParsed && openApiLoadSource === 'apicurio' && (
                                <span className="rest-dsl-page-import-success">
                                  <CheckCircleIcon /> Loaded
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="rest-dsl-page-import-note">
                              Configure the Apicurio Registry URL in Settings to enable this option.
                            </span>
                          )}
                        </div>
                      )}
                    </FormGroup>
                    {(openApiError || apicurioError) && (
                      <span className="rest-dsl-page-import-error">{openApiError || apicurioError}</span>
                    )}
                  </Form>
                </WizardStep>
                <WizardStep name="Operations" id="operations">
                  <Form>
                    <FormGroup label="OpenAPI Specification" fieldId="rest-openapi-spec">
                      <TextArea
                        id="rest-openapi-spec"
                        value={openApiSpecText}
                        onChange={(_event, value) => setOpenApiSpecText(value)}
                        resizeOrientation="vertical"
                        rows={6}
                      />
                    </FormGroup>
                    <div className="rest-dsl-page-import-actions">
                      <Button variant="secondary" onClick={handleParseOpenApiSpec}>
                        Parse Specification
                      </Button>
                      {openApiError && <span className="rest-dsl-page-import-error">{openApiError}</span>}
                    </div>
                    <div className="rest-dsl-page-import-options">
                      <Checkbox
                        id="rest-openapi-create-rest"
                        label="Create Rest DSL operations"
                        isChecked={importCreateRest}
                        onChange={(_event, checked) => setImportCreateRest(checked)}
                      />
                      <Checkbox
                        id="rest-openapi-create-routes"
                        label="Create routes with direct endpoints"
                        isChecked={importCreateRoutes}
                        onChange={(_event, checked) => setImportCreateRoutes(checked)}
                      />
                    </div>
                    {importOperations.length > 0 && (
                      <div className="rest-dsl-page-import-list">
                        <Checkbox
                          id="rest-openapi-select-all"
                          label="Select all operations"
                          isChecked={importSelectAll}
                          onChange={(_event, checked) => handleToggleSelectAllOperations(checked)}
                        />
                        <div className="rest-dsl-page-import-list-scroll">
                          <List className="rest-dsl-page-list rest-dsl-page-list-nested">
                            {importOperations.map((operation) => (
                              <ListItem key={`${operation.operationId}-${operation.method}-${operation.path}`}>
                                <div className="rest-dsl-page-import-row">
                                  <Checkbox
                                    id={`rest-openapi-${operation.operationId}-${operation.method}`}
                                    label={`${operation.method.toUpperCase()} ${operation.path}`}
                                    isChecked={operation.selected}
                                    onChange={(_event, checked) =>
                                      handleToggleOperation(
                                        operation.operationId,
                                        operation.method,
                                        operation.path,
                                        checked,
                                      )
                                    }
                                  />
                                  {operation.routeExists && (
                                    <span className="rest-dsl-page-import-note">Route exists</span>
                                  )}
                                </div>
                              </ListItem>
                            ))}
                          </List>
                        </div>
                      </div>
                    )}
                  </Form>
                </WizardStep>
              </Wizard>
            </ModalBody>
          </Modal>
        )}
      </div>
    </ActionConfirmationModalContextProvider>
  );
};

const getListItemClass = (selection: RestEditorSelection | undefined, target: RestEditorSelection): string => {
  const isSelected =
    selection?.kind === target.kind &&
    (target.kind === 'restConfiguration' ||
      (selection?.kind !== 'restConfiguration' &&
        selection?.restId === (target as Exclude<RestEditorSelection, { kind: 'restConfiguration' }>).restId &&
        (target.kind !== 'operation' ||
          (selection?.kind === 'operation' && selection.verb === target.verb && selection.index === target.index))));

  return `rest-dsl-page-item${isSelected ? ' rest-dsl-page-item-selected' : ''}`;
};
