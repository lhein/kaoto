import { CamelComponentFilterService } from '../../models/visualization/flows/support/camel-component-filter.service';

export type RestVerb = (typeof CamelComponentFilterService.REST_DSL_METHODS)[number];

export type ImportLoadSource = 'uri' | 'file' | 'apicurio' | 'manual' | undefined;

export type RestEditorSelection =
  | { kind: 'restConfiguration' }
  | { kind: 'rest'; restId: string }
  | { kind: 'operation'; restId: string; verb: RestVerb; index: number };

export type ImportSourceOption = 'uri' | 'file' | 'apicurio';

export type ImportOperation = {
  operationId: string;
  method: RestVerb;
  path: string;
  selected: boolean;
  routeExists: boolean;
};

export type ApicurioArtifact = {
  id: string;
  name: string;
  type: string;
};

export type ApicurioArtifactSearchResult = {
  artifacts: ApicurioArtifact[];
};

export type FormEntity = {
  getNodeSchema: (path: string) => unknown;
  getNodeDefinition: (path: string) => unknown;
  getRootPath: () => string;
};

export type SelectedFormState = {
  title?: string;
  entity: FormEntity;
  path: string;
  omitFields?: string[];
};

export type ToUriSchema = {
  required: boolean;
  title?: string;
  description?: string;
  defaultValue?: unknown;
};
