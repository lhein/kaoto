import {
  applyRouteExistsToOperations,
  buildOperationsFromSpec,
  buildRestDefinitionFromOperations,
  toggleSelectAllOperations,
} from './useRestDslImportWizard';

describe('buildOperationsFromSpec', () => {
  it('maps consumes/produces from request and response content types', () => {
    const spec = {
      paths: {
        '/pet': {
          post: {
            operationId: 'addPet',
            requestBody: {
              content: {
                'application/json': {},
                'application/xml': {},
                'application/x-www-form-urlencoded': {},
              },
            },
            responses: {
              '200': {
                content: {
                  'application/json': {},
                  'application/xml': {},
                },
              },
            },
          },
        },
      },
    };

    const operations = buildOperationsFromSpec(spec);
    expect(operations).toHaveLength(1);
    expect(operations[0].consumes).toBe('application/json,application/xml,application/x-www-form-urlencoded');
    expect(operations[0].produces).toBe('application/json,application/xml');
  });

  it('maps responseMessage from OpenAPI responses', () => {
    const spec = {
      paths: {
        '/pet': {
          post: {
            operationId: 'addPet',
            responses: {
              '200': { description: 'Successful operation' },
              '400': { description: 'Invalid input' },
              default: { description: 'Unexpected error' },
            },
          },
        },
      },
    };

    const operations = buildOperationsFromSpec(spec);
    expect(operations).toHaveLength(1);
    expect(operations[0].responseMessage).toEqual([
      { code: '200', message: 'Successful operation' },
      { code: '400', message: 'Invalid input' },
      { code: 'default', message: 'Unexpected error' },
    ]);
  });

  it('maps security requirements and scopes from OpenAPI operation security', () => {
    const spec = {
      paths: {
        '/pet': {
          post: {
            operationId: 'addPet',
            security: [{ petstore_auth: ['write:pets', 'read:pets'] }, { api_key: [] }],
          },
        },
      },
    };

    const operations = buildOperationsFromSpec(spec);
    expect(operations).toHaveLength(1);
    expect(operations[0].security).toEqual([
      { key: 'petstore_auth', scopes: 'write:pets,read:pets' },
      { key: 'api_key' },
    ]);
  });

  it('maps params from OpenAPI operation/path parameters', () => {
    const spec = {
      paths: {
        '/pet/{id}': {
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Pet id',
              schema: { type: 'string' },
            },
          ],
          get: {
            operationId: 'getPet',
            parameters: [
              {
                name: 'status',
                in: 'query',
                required: false,
                schema: { type: 'string', default: 'available', enum: ['available', 'sold'] },
              },
            ],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };

    const operations = buildOperationsFromSpec(spec);
    expect(operations).toHaveLength(1);
    expect(operations[0].param).toEqual([
      {
        name: 'id',
        type: 'path',
        required: true,
        description: 'Pet id',
        dataType: 'string',
      },
      {
        name: 'status',
        type: 'query',
        required: false,
        dataType: 'string',
        defaultValue: 'available',
        allowableValues: [{ value: 'available' }, { value: 'sold' }],
      },
    ]);
  });
});

describe('buildRestDefinitionFromOperations', () => {
  it('builds rest operation entries with mapped import fields', () => {
    const definition = buildRestDefinitionFromOperations(
      [
        {
          operationId: 'updatePet',
          method: 'put',
          path: '/pet',
          description: 'Update an existing pet',
          consumes: 'application/json,application/xml',
          produces: 'application/json',
          param: [{ name: 'id', type: 'path' }],
          responseMessage: [{ code: '200', message: 'ok' }],
          security: [{ key: 'petstore_auth', scopes: 'write:pets,read:pets' }],
          deprecated: true,
          selected: true,
          routeExists: false,
        },
      ],
      'rest-1',
      'petstore.json',
    );

    expect(definition).toEqual({
      id: 'rest-1',
      openApi: { specification: 'petstore.json' },
      put: [
        {
          id: 'updatePet',
          path: '/pet',
          routeId: 'route-updatePet',
          to: 'direct:updatePet',
          description: 'Update an existing pet',
          consumes: 'application/json,application/xml',
          produces: 'application/json',
          param: [{ name: 'id', type: 'path' }],
          responseMessage: [{ code: '200', message: 'ok' }],
          security: [{ key: 'petstore_auth', scopes: 'write:pets,read:pets' }],
          deprecated: true,
        },
      ],
    });
  });
});

describe('route exists selection behavior', () => {
  it('keeps route-existing operations unselected when selecting all', () => {
    const withRouteExists = applyRouteExistsToOperations(
      [
        {
          operationId: 'addPet',
          method: 'post',
          path: '/pet',
          selected: true,
          routeExists: false,
        },
        {
          operationId: 'updatePet',
          method: 'put',
          path: '/pet',
          selected: true,
          routeExists: false,
        },
      ],
      new Set(['addPet']),
    );

    const toggled = toggleSelectAllOperations(withRouteExists, true);
    expect(toggled).toEqual([
      {
        operationId: 'addPet',
        method: 'post',
        path: '/pet',
        selected: false,
        routeExists: true,
      },
      {
        operationId: 'updatePet',
        method: 'put',
        path: '/pet',
        selected: true,
        routeExists: false,
      },
    ]);
  });
});
