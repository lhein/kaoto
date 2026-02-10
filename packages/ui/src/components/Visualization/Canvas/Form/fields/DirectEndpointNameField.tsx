import { FieldProps, FieldWrapper, SchemaContext, Typeahead, useFieldValue } from '@kaoto/forms';
import { Button, InputGroup, InputGroupItem } from '@patternfly/react-core';
import { FunctionComponent, useContext, useEffect, useRef, useState } from 'react';

import { EntitiesContext } from '../../../../../providers/entities.provider';
import { VisibleFlowsContext } from '../../../../../providers/visible-flows.provider';
import { useCreateDirectRoute, useDirectEndpointNameOptions } from './DirectEndpointNameField.hooks';

export const DirectEndpointNameField: FunctionComponent<FieldProps> = ({ propName, required }) => {
  const { schema } = useContext(SchemaContext);
  const { value = '', onChange, disabled } = useFieldValue<string | undefined>(propName);
  const entitiesContext = useContext(EntitiesContext);
  const visibleFlowsContext = useContext(VisibleFlowsContext);
  const [typedInputValue, setTypedInputValue] = useState(value);
  const typeaheadWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTypedInputValue(value);
  }, [value]);

  useEffect(() => {
    const inputElement = typeaheadWrapperRef.current?.querySelector('input');
    if (!inputElement) {
      return;
    }

    const onInput = (event: Event) => {
      setTypedInputValue((event.target as HTMLInputElement).value);
    };

    inputElement.addEventListener('input', onInput);

    return () => {
      inputElement.removeEventListener('input', onInput);
    };
  }, []);

  const { existingDirectNames, items, selectedItem, typedName, onTypeaheadChange, onCleanInput, onCreateOption } =
    useDirectEndpointNameOptions({
      value,
      onChange,
      visualEntities: entitiesContext?.visualEntities,
    });
  const typedCandidateName = typedInputValue.trim() || typedName;
  const { canCreateRoute, onCreateRoute } = useCreateDirectRoute({
    disabled: !!disabled,
    typedName: typedCandidateName,
    existingDirectNames,
    onChange,
    entitiesContext,
    visibleFlowsContext,
  });

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
          <div ref={typeaheadWrapperRef}>
            <Typeahead
              aria-label={schema.title ?? propName}
              data-testid={propName}
              selectedItem={selectedItem}
              items={items}
              placeholder={schema.default?.toString()}
              id={propName}
              onChange={(item) => {
                onTypeaheadChange(item);
                setTypedInputValue(item?.name ?? '');
              }}
              onCleanInput={() => {
                onCleanInput();
                setTypedInputValue('');
              }}
              onCreate={(createItemValue, filterValue) => {
                onCreateOption(createItemValue, filterValue);
                setTypedInputValue(filterValue ?? '');
              }}
              onCreatePrefix="direct endpoint"
              disabled={disabled}
              allowCustomInput
            />
          </div>
        </InputGroupItem>
        <InputGroupItem>
          <Button variant="secondary" onClick={onCreateRoute} isDisabled={!canCreateRoute}>
            Create Route
          </Button>
        </InputGroupItem>
      </InputGroup>
    </FieldWrapper>
  );
};
