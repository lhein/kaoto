import { createHashRouter } from 'react-router-dom';

import { ContextToolbar } from '../components/Visualization/ContextToolbar';
import { AboutPage } from '../pages/About/AboutPage';
import { BeansPage } from '../pages/Beans/BeansPage';
import { DataMapperPage } from '../pages/DataMapper/DataMapperPage';
import { DataMapperHowToPage } from '../pages/DataMapperHowTo/DataMapperHowToPage';
import { DesignPage } from '../pages/Design/DesignPage';
import { ErrorPage } from '../pages/ErrorPage';
import { MetadataPage } from '../pages/Metadata/MetadataPage';
import { PipeErrorHandlerPage } from '../pages/PipeErrorHandler/PipeErrorHandlerPage';
import { RestDslEditorPage } from '../pages/RestDslEditor/RestDslEditorPage';
import { Links } from '../router/links.models';
import { KaotoEditorShell } from './KaotoEditorShell';

export const kaotoEditorRouter = createHashRouter([
  {
    path: Links.Home,
    element: <KaotoEditorShell />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <DesignPage contextToolbar={<ContextToolbar isSimplified />} />,
      },
      {
        path: Links.Beans,
        Component: BeansPage,
      },
      {
        path: Links.RestEditor,
        Component: RestDslEditorPage,
      },
      {
        path: Links.Metadata,
        Component: MetadataPage,
      },
      {
        path: Links.PipeErrorHandler,
        Component: PipeErrorHandlerPage,
      },
      {
        path: Links.DataMapper,
        Component: DataMapperHowToPage,
      },
      {
        path: Links.About,
        Component: AboutPage,
      },
      {
        path: `${Links.DataMapper}/:id`,
        Component: DataMapperPage,
      },
    ],
  },
]);
