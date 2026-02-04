import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Dropdown,
  DropdownItem,
  DropdownList,
  List,
  ListItem,
  SplitItem,
  Title,
} from '@patternfly/react-core';
import { PlusIcon, TrashIcon } from '@patternfly/react-icons';
import { FunctionComponent, ReactNode, Ref } from 'react';

import { CamelRestConfigurationVisualEntity } from '../../models/visualization/flows/camel-rest-configuration-visual-entity';
import { CamelRestVisualEntity } from '../../models/visualization/flows/camel-rest-visual-entity';
import { RestEditorSelection, RestVerb } from './restDslTypes';

type RestOperationListProps = {
  restEntity: CamelRestVisualEntity;
  restDefinition: Record<string, unknown>;
  restMethods: RestVerb[];
  selection: RestEditorSelection | undefined;
  onSelectOperation: (restId: string, verb: RestVerb, index: number) => void;
  onDeleteOperation: (restEntity: CamelRestVisualEntity, verb: RestVerb, index: number) => void;
  getListItemClass: (selection: RestEditorSelection | undefined, target: RestEditorSelection) => string;
};

const RestOperationList: FunctionComponent<RestOperationListProps> = ({
  restEntity,
  restDefinition,
  restMethods,
  selection,
  onSelectOperation,
  onDeleteOperation,
  getListItemClass,
}) => {
  const items = restMethods.flatMap((verb) => {
    const operations = restDefinition[verb] as Array<{ path?: string; id?: string }> | undefined;
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
            onClick={() => onSelectOperation(restEntity.id, verb, index)}
            type="button"
          >
            <span className={`rest-dsl-page-verb rest-dsl-page-verb-${verb}`}>{verb.toUpperCase()}</span>
            <span className="rest-dsl-page-operation-path">{operation?.path || operation?.id || '/'}</span>
          </button>
          <Button
            variant="plain"
            size="sm"
            icon={<TrashIcon />}
            aria-label="Delete Operation"
            onClick={() => onDeleteOperation(restEntity, verb, index)}
          />
        </div>
      </ListItem>
    ));
  });

  return <List className="rest-dsl-page-list rest-dsl-page-list-nested">{items}</List>;
};

type RestDslNavProps = {
  navWidth: number | string;
  isImportMenuOpen: boolean;
  importMenuToggleRenderer: (toggleRef: Ref<HTMLButtonElement>) => ReactNode;
  onImportMenuSelect: () => void;
  onImportOpenApi: () => void;
  restConfiguration?: CamelRestConfigurationVisualEntity;
  restEntities: CamelRestVisualEntity[];
  restMethods: RestVerb[];
  selection: RestEditorSelection | undefined;
  canAddRestEntities: boolean;
  canDeleteRestEntities: boolean;
  onCreateRestConfiguration: () => void;
  onDeleteRestConfiguration: () => void;
  onSelectRestConfiguration: () => void;
  onCreateRest: () => void;
  onDeleteRest: (restEntity: CamelRestVisualEntity) => void;
  onSelectRest: (restId: string) => void;
  onAddOperation: (restId: string) => void;
  onSelectOperation: (restId: string, verb: RestVerb, index: number) => void;
  onDeleteOperation: (restEntity: CamelRestVisualEntity, verb: RestVerb, index: number) => void;
  getListItemClass: (selection: RestEditorSelection | undefined, target: RestEditorSelection) => string;
};

export const RestDslNav: FunctionComponent<RestDslNavProps> = ({
  navWidth,
  isImportMenuOpen,
  importMenuToggleRenderer,
  onImportMenuSelect,
  onImportOpenApi,
  restConfiguration,
  restEntities,
  restMethods,
  selection,
  canAddRestEntities,
  canDeleteRestEntities,
  onCreateRestConfiguration,
  onDeleteRestConfiguration,
  onSelectRestConfiguration,
  onCreateRest,
  onDeleteRest,
  onSelectRest,
  onAddOperation,
  onSelectOperation,
  onDeleteOperation,
  getListItemClass,
}) => {
  return (
    <SplitItem className="rest-dsl-page-pane rest-dsl-page-pane-nav" style={{ flexBasis: navWidth }}>
      <Card className="rest-dsl-page-panel">
        <CardHeader className="rest-dsl-page-panel-header">
          <div className="rest-dsl-page-header">
            <Title headingLevel="h2" size="md" className="rest-dsl-page-panel-title">
              Rest DSL
            </Title>
            <Dropdown isOpen={isImportMenuOpen} onSelect={onImportMenuSelect} toggle={importMenuToggleRenderer}>
              <DropdownList>
                <DropdownItem onClick={onImportOpenApi}>Import OpenAPI</DropdownItem>
              </DropdownList>
            </Dropdown>
          </div>
        </CardHeader>
        <CardBody className="rest-dsl-page-panel-body">
          <div className="rest-dsl-page-section-header">
            <Title headingLevel="h3" className="rest-dsl-page-section-title">
              <span className="rest-dsl-page-section-title-text">Rest Configuration</span>
            </Title>
            <div className="rest-dsl-page-section-actions">
              <Button
                variant="secondary"
                icon={<PlusIcon />}
                onClick={onCreateRestConfiguration}
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
                    onClick={onSelectRestConfiguration}
                    type="button"
                  >
                    Rest Configuration
                  </button>
                  <div className="rest-dsl-page-rest-actions">
                    <Button
                      variant="plain"
                      icon={<TrashIcon />}
                      aria-label="Delete Rest Configuration"
                      onClick={onDeleteRestConfiguration}
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
            <Title headingLevel="h3" className="rest-dsl-page-section-title">
              <span className="rest-dsl-page-section-title-text">Rest Services</span>
            </Title>
            <div className="rest-dsl-page-section-actions">
              <Button variant="secondary" icon={<PlusIcon />} onClick={onCreateRest} isDisabled={!canAddRestEntities}>
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
                          onClick={() => onSelectRest(restEntity.id)}
                          type="button"
                        >
                          {restDefinition.path || restEntity.id || 'rest'}
                        </button>
                        <div className="rest-dsl-page-rest-actions">
                          <Button variant="link" icon={<PlusIcon />} onClick={() => onAddOperation(restEntity.id)}>
                            Add Operation
                          </Button>
                          <Button
                            variant="plain"
                            icon={<TrashIcon />}
                            aria-label="Delete Rest Element"
                            onClick={() => onDeleteRest(restEntity)}
                            isDisabled={!canDeleteRestEntities}
                          />
                        </div>
                      </div>
                      <RestOperationList
                        restEntity={restEntity}
                        restDefinition={restDefinition as Record<string, unknown>}
                        restMethods={restMethods}
                        selection={selection}
                        onSelectOperation={onSelectOperation}
                        onDeleteOperation={onDeleteOperation}
                        getListItemClass={getListItemClass}
                      />
                    </div>
                  </ListItem>
                );
              })}
            </List>
          )}
        </CardBody>
      </Card>
    </SplitItem>
  );
};
