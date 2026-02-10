import './DirectEndpointNameField.scss';

import { RouteDefinition } from '@kaoto/camel-catalog/types';
import { FieldProps, FieldWrapper, SchemaContext, useFieldValue } from '@kaoto/forms';
import { Button, InputGroup, InputGroupItem, TextInput } from '@patternfly/react-core';
import { FunctionComponent, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { EntityType } from '../../../../../models/camel/entities';
import { EntitiesContext } from '../../../../../providers/entities.provider';
import { VisibleFlowsContext } from '../../../../../providers/visible-flows.provider';

const DIRECT_URI = 'direct';
const DIRECT_URI_PREFIX = `${DIRECT_URI}:`;

const getDirectNameFromUri = (uri: string): string | undefined => {
  if (!uri.startsWith(DIRECT_URI_PREFIX)) {
    return undefined;
  }

  const [name] = uri.substring(DIRECT_URI_PREFIX.length).split('?');
  const normalizedName = name.trim();
  return normalizedName === '' ? undefined : normalizedName;
};

const getDirectNameFromEndpointDefinition = (endpointDefinition: unknown): string | undefined => {
  if (typeof endpointDefinition === 'string') {
    return getDirectNameFromUri(endpointDefinition);
  }

  if (!endpointDefinition || typeof endpointDefinition !== 'object' || Array.isArray(endpointDefinition)) {
    return undefined;
  }

  const endpoint = endpointDefinition as Record<string, unknown>;
  const uri = endpoint.uri;
  if (typeof uri !== 'string') {
    return undefined;
  }

  const directNameFromUri = getDirectNameFromUri(uri);
  if (directNameFromUri) {
    return directNameFromUri;
  }

  if (uri !== DIRECT_URI) {
    return undefined;
  }

  const name = (endpoint.parameters as Record<string, unknown> | undefined)?.name;
  return typeof name === 'string' && name.trim() !== '' ? name.trim() : undefined;
};

const collectDirectEndpointNames = (value: unknown, names: Set<string>) => {
  if (typeof value === 'string') {
    const directName = getDirectNameFromUri(value);
    if (directName) {
      names.add(directName);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectDirectEndpointNames(item, names));
    return;
  }

  const objectValue = value as Record<string, unknown>;
  const uri = objectValue.uri;

  if (typeof uri === 'string') {
    const directNameFromUri = getDirectNameFromUri(uri);
    if (directNameFromUri) {
      names.add(directNameFromUri);
    }

    if (uri === DIRECT_URI) {
      const name = (objectValue.parameters as Record<string, unknown> | undefined)?.name;
      if (typeof name === 'string' && name.trim() !== '') {
        names.add(name.trim());
      }
    }
  }

  Object.values(objectValue).forEach((item) => collectDirectEndpointNames(item, names));
};

export const DirectEndpointNameField: FunctionComponent<FieldProps> = ({ propName, required }) => {
  const { schema } = useContext(SchemaContext);
  const { value = '', onChange, disabled } = useFieldValue<string | undefined>(propName);
  const entitiesContext = useContext(EntitiesContext);
  const visibleFlowsContext = useContext(VisibleFlowsContext);
  const [inputValue, setInputValue] = useState(value);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const fieldContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const existingDirectNames = useMemo(() => {
    const names = new Set<string>();
    entitiesContext?.visualEntities.forEach((entity) => collectDirectEndpointNames(entity.toJSON(), names));
    return [...names].sort((first, second) => first.localeCompare(second));
  }, [entitiesContext?.visualEntities]);
  const routeIdsByDirectName = useMemo(() => {
    const routeIdsMap = new Map<string, string[]>();

    entitiesContext?.visualEntities.forEach((entity) => {
      const entityDefinition = entity.toJSON() as Record<string, unknown>;
      const routeDefinition = entityDefinition.route as Record<string, unknown> | undefined;
      if (!routeDefinition) {
        return;
      }

      const directName = getDirectNameFromEndpointDefinition(routeDefinition.from);
      if (!directName) {
        return;
      }

      const routeId = entity.getId();
      if (!routeId) {
        return;
      }

      const routeIds = routeIdsMap.get(directName) ?? [];
      if (!routeIds.includes(routeId)) {
        routeIds.push(routeId);
        routeIdsMap.set(directName, routeIds);
      }
    });

    return routeIdsMap;
  }, [entitiesContext?.visualEntities]);

  const typedName = inputValue.trim();
  const filteredDirectNames = useMemo(() => {
    if (typedName === '') {
      return existingDirectNames;
    }

    const lowerTypedName = typedName.toLowerCase();
    return existingDirectNames.filter((name) => name.toLowerCase().includes(lowerTypedName));
  }, [existingDirectNames, typedName]);

  const canCreateRoute =
    !disabled && typedName !== '' && !existingDirectNames.some((existingName) => existingName === typedName);
  const dropdownItems = useMemo(() => {
    return filteredDirectNames.map((name) => {
      const routeIds = routeIdsByDirectName.get(name) ?? [];
      const label = routeIds.length > 0 ? `${name} (${routeIds.join(', ')})` : name;

      return { name, label };
    });
  }, [filteredDirectNames, routeIdsByDirectName]);

  const onInputChange = useCallback(
    (_event: unknown, newValue: string) => {
      setInputValue(newValue);
      onChange(newValue.trim() === '' ? undefined : newValue);
    },
    [onChange],
  );

  const onCreateRoute = useCallback(() => {
    if (!entitiesContext || !canCreateRoute) {
      return;
    }

    const routeTemplate: RouteDefinition = {
      from: {
        uri: DIRECT_URI,
        parameters: { name: typedName },
        steps: [],
      },
    };

    const newRouteId = entitiesContext.camelResource.addNewEntity(EntityType.Route, routeTemplate);
    visibleFlowsContext?.visualFlowsApi.toggleFlowVisible(newRouteId);
    entitiesContext.updateEntitiesFromCamelResource();
    onChange(typedName);
  }, [canCreateRoute, entitiesContext, onChange, typedName, visibleFlowsContext]);

  const listboxId = `${propName}-direct-endpoints-listbox`;

  const onSelectExistingName = useCallback(
    (name: string) => {
      setInputValue(name);
      onChange(name);
      setIsDropdownOpen(false);
    },
    [onChange],
  );

  const updateDropdownPosition = useCallback(() => {
    const inputElement = fieldContainerRef.current?.querySelector('input');
    if (!inputElement) {
      return;
    }

    const rect = inputElement.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }

    updateDropdownPosition();
    const listener = () => updateDropdownPosition();
    window.addEventListener('resize', listener);
    window.addEventListener('scroll', listener, true);

    return () => {
      window.removeEventListener('resize', listener);
      window.removeEventListener('scroll', listener, true);
    };
  }, [isDropdownOpen, updateDropdownPosition, inputValue]);

  return (
    <FieldWrapper
      propName={propName}
      required={required}
      title={schema.title}
      type="string"
      description={schema.description}
      defaultValue={schema.default?.toString()}
    >
      <InputGroup>
        <InputGroupItem isFill>
          <div className="direct-endpoint-name-field" ref={fieldContainerRef}>
            <TextInput
              aria-label={schema.title ?? propName}
              data-testid={propName}
              id={propName}
              name="direct-endpoint-name"
              type="text"
              value={inputValue}
              placeholder={schema.default?.toString()}
              onChange={onInputChange}
              isDisabled={disabled}
              autoComplete="off"
              spellCheck={false}
              onFocus={() => setIsDropdownOpen(true)}
              onClick={() => setIsDropdownOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setIsDropdownOpen(false), 150);
              }}
            />
          </div>
        </InputGroupItem>
        <InputGroupItem>
          <Button variant="secondary" onClick={onCreateRoute} isDisabled={!canCreateRoute}>
            Create Route
          </Button>
        </InputGroupItem>
      </InputGroup>
      {isDropdownOpen &&
        dropdownItems.length > 0 &&
        createPortal(
          <ul
            className="direct-endpoint-name-field-dropdown"
            id={listboxId}
            role="listbox"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
          >
            {dropdownItems.map((item) => (
              <li
                key={item.name}
                className="direct-endpoint-name-field-option"
                role="option"
                aria-selected={item.name === typedName}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelectExistingName(item.name);
                }}
              >
                {item.label}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </FieldWrapper>
  );
};
