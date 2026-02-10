import { CamelYamlDsl, RouteDefinition } from '@kaoto/camel-catalog/types';
import { ModelContextProvider, SchemaProvider } from '@kaoto/forms';
import { fireEvent, render, screen } from '@testing-library/react';
import { JSONSchema4 } from 'json-schema';

import { CamelRouteResource } from '../../../../../models/camel/camel-route-resource';
import { EntityType } from '../../../../../models/camel/entities';
import { VisibleFlowsContextResult } from '../../../../../providers';
import { TestProvidersWrapper } from '../../../../../stubs';
import { DirectEndpointNameField } from './DirectEndpointNameField';

describe('DirectEndpointNameField', () => {
  const PROP_NAME = 'parameters.name';
  const schema: JSONSchema4 = {
    title: 'Name',
    type: 'string',
    description: 'Sets the endpoint name',
  };

  const renderField = (
    model: string | undefined,
    routes: RouteDefinition[],
    visibleFlowsContext?: VisibleFlowsContextResult,
  ) => {
    const camelResource = new CamelRouteResource(routes as unknown as CamelYamlDsl);
    const { Provider, updateEntitiesFromCamelResourceSpy } = TestProvidersWrapper({
      camelResource,
      visibleFlowsContext,
    });

    render(
      <Provider>
        <SchemaProvider schema={schema}>
          <ModelContextProvider model={model} onPropertyChange={jest.fn()}>
            <DirectEndpointNameField propName={PROP_NAME} />
          </ModelContextProvider>
        </SchemaProvider>
      </Provider>,
    );

    return { camelResource, updateEntitiesFromCamelResourceSpy };
  };

  it('renders known direct endpoint names as suggestions', () => {
    renderField(undefined, [
      { from: { uri: 'direct:start', steps: [] } },
      { from: { uri: 'timer:test', steps: [{ to: { uri: 'direct:orders' } }] } },
      { from: { uri: 'direct', parameters: { name: 'billing' }, steps: [] } },
    ]);

    const input = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.click(input);

    const options = screen.getAllByRole('option').map((option) => option.textContent);

    expect(options).toHaveLength(3);
    expect(options[0]).toMatch(/^billing \(route-/);
    expect(options[1]).toEqual('orders');
    expect(options[2]).toMatch(/^start \(route-/);
  });

  it('enables create button only for new names', () => {
    renderField(undefined, [{ from: { uri: 'direct:start', steps: [] } }]);

    const input = screen.getByRole('textbox', { name: 'Name' });
    const button = screen.getByRole('button', { name: 'Create Route' });

    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: 'start' } });
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: 'new-endpoint' } });
    expect(button).toBeEnabled();
  });

  it('creates a new route with direct from and typed name', () => {
    const toggleFlowVisibleSpy = jest.fn();
    const visibleFlowsContext = {
      allFlowsVisible: true,
      visibleFlows: {},
      visualFlowsApi: { toggleFlowVisible: toggleFlowVisibleSpy },
    } as unknown as VisibleFlowsContextResult;

    const { camelResource, updateEntitiesFromCamelResourceSpy } = renderField(
      undefined,
      [{ from: { uri: 'direct:start', steps: [] } }],
      visibleFlowsContext,
    );
    const addNewEntitySpy = jest.spyOn(camelResource, 'addNewEntity');

    const input = screen.getByRole('textbox', { name: 'Name' });
    const button = screen.getByRole('button', { name: 'Create Route' });

    fireEvent.change(input, { target: { value: 'new-route' } });
    fireEvent.click(button);

    expect(addNewEntitySpy).toHaveBeenCalledWith(EntityType.Route, {
      from: { uri: 'direct', parameters: { name: 'new-route' }, steps: [] },
    });
    expect(toggleFlowVisibleSpy).toHaveBeenCalled();
    expect(updateEntitiesFromCamelResourceSpy).toHaveBeenCalled();
  });
});
