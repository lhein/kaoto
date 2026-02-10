import { CustomFieldsFactory, EnumField } from '@kaoto/forms';

import { IVisualizationNode } from '../../../../../models';
import { DataSourceBeanField, PrefixedBeanField, UnprefixedBeanField } from './BeanField/BeanField';
import { DirectEndpointNameField } from './DirectEndpointNameField';
import { ExpressionField } from './ExpressionField/ExpressionField';

export const customFieldsFactoryfactory = (vizNode: IVisualizationNode): CustomFieldsFactory => {
  return (schema) => {
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      /* Workaround for https://github.com/KaotoIO/kaoto/issues/2565 since the SNMP component has the wrong type */
      return EnumField;
    } else if (
      vizNode.data.componentName === 'direct' &&
      schema.type === 'string' &&
      schema.title === 'Name' &&
      schema.description?.toLowerCase().includes('endpoint')
    ) {
      return DirectEndpointNameField;
    } else if (schema.type === 'string' && schema.format?.startsWith('bean:')) {
      return PrefixedBeanField;
    } else if (schema.type === 'string' && schema.title === 'Ref') {
      return UnprefixedBeanField;
    } else if (schema.type === 'string' && schema.title?.includes('Data Source')) {
      return DataSourceBeanField;
    } else if (schema.format === 'expression' || schema.format === 'expressionProperty') {
      return ExpressionField;
    }

    return undefined;
  };
};
