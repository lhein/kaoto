Cypress.Commands.add('openHomePage', () => {
  const url = Cypress.config().baseUrl;
  cy.visit(url!);
  cy.waitSchemasLoading();

  cy.selectRuntimeVersion('Main');
});

Cypress.Commands.add('openHomePageWithPreExistingRoutes', () => {
  const url = Cypress.config().baseUrl;
  const multiRoute = `
  - route:
      id: route-1234
      from:
        id: from-3362
        uri: timer:template
        parameters:
          period: "1000"
        steps:
          - log:
              id: log-6809
              message: \${body}
  - route:
      id: route-4321
      from:
        id: from-3576
        uri: timer:template
        parameters:
          period: "1000"
        steps:
          - log:
              id: log-2966
              message: \${body}
  `;

  cy.visit(url!, {
    onBeforeLoad(win) {
      win.localStorage.setItem('sourceCode', multiRoute);
    },
  });
  cy.waitSchemasLoading();
});

Cypress.Commands.add('waitSchemasLoading', () => {
  // Wait for the loading schemas to disappear
  cy.get('[data-testid="loading-schemas"]').should('be.visible');
  cy.get('[data-testid="loading-schemas"]').should('not.exist');
  // Wait for the loading connectors to disappear
  cy.get('[data-testid="loading-catalogs"]').should('be.visible');
  cy.get('[data-testid="loading-catalogs"]').should('not.exist');
});

Cypress.Commands.add('expandVisualization', () => {
  cy.get('#Visualization').each(($element) => {
    const attributeValue = $element.attr('aria-expanded');
    if (attributeValue === 'false') {
      cy.wrap($element).click();
    }
  });
});

Cypress.Commands.add('openDesignPage', () => {
  cy.expandVisualization();
  cy.get('[data-testid="Design"]').click();
  cy.get('.pf-topology-container').should('be.visible');
});

Cypress.Commands.add('openSourceCode', () => {
  cy.expandVisualization();
  cy.get('[data-testid="Source Code"]').click();
  cy.get('.pf-v6-c-code-editor__code').should('be.visible');
});

Cypress.Commands.add('openBeans', () => {
  cy.get('[data-testid="Beans"]').click();
  cy.get('.metadata-editor-modal-details-view').should('be.visible');
});

Cypress.Commands.add('openMetadata', () => {
  cy.get('[data-testid="Metadata"]').click();
  cy.get('[data-testid="metadata-form"]').should('be.visible');
});

Cypress.Commands.add('openPipeErrorHandler', () => {
  cy.get('[data-testid="Pipe ErrorHandler"]').click();
});

Cypress.Commands.add('openTopbarKebabMenu', () => {
  cy.get('div.pf-v6-c-masthead__content').within(() => {
    cy.get('button.pf-v6-c-menu-toggle').click();
  });
});

Cypress.Commands.add('openSettings', () => {
  cy.openTopbarKebabMenu();
  cy.get('[data-testid="settings-link"]').click();
});

Cypress.Commands.add('openAboutModal', () => {
  cy.openTopbarKebabMenu();
  cy.get('button#about').click();
});

Cypress.Commands.add('closeAboutModal', () => {
  cy.get('.pf-v6-c-about-modal-box').within(() => {
    cy.get('button.pf-v6-c-button.pf-m-plain').click();
  });
});

Cypress.Commands.add('openDataMapper', () => {
  cy.get('[data-testid="DataMapper"]').click();
  cy.get('[data-testid="dm-debug-main-menu-button"]').should('be.visible');
});

Cypress.Commands.add('openCatalog', () => {
  cy.get('[data-testid="Catalog"]').click();
  cy.get('[data-testid="component-catalog-tab"]').should('be.visible');
});

/**
 * Select from integration type dropdown
 * Possible values are - Integration, camelYamlDsl(Camel Route), Kamelet, KameletBinding
 */
Cypress.Commands.add('switchIntegrationType', (type: string) => {
  cy.get('[data-testid="integration-type-list-dropdown"]').click({ force: true });
  cy.get('#integration-type-list-select')
    .should('exist')
    .find(`[data-testid="integration-type-${type}"]`)
    .should('exist')
    .click();
  cy.get('[data-testid="confirmation-modal-confirm"]').click({ force: true });
});

Cypress.Commands.add('addNewRoute', () => {
  cy.get('[data-testid="new-entity-list-dropdown"]').click();
  cy.get('[data-testid="new-entity-route"]').click();
});

Cypress.Commands.add('toggleRouteVisibility', (index) => {
  cy.toggleFlowsList();
  cy.get('button[data-testid^="toggle-btn-route"]').then((buttons) => {
    cy.wrap(buttons[index]).click();
  });
  cy.closeFlowsListIfVisible();
});

Cypress.Commands.add('renameRoute', (oldName: string, newName: string) => {
  cy.toggleFlowsList();
  cy.get('button[data-testid="goto-btn-' + oldName + '--edit"]').click();
  cy.get('[data-testid="goto-btn-' + oldName + '--text-input"]')
    .clear()
    .type(newName);
  cy.get('button[data-testid="goto-btn-' + oldName + '--save"]').click();
  cy.closeFlowsListIfVisible();
});

Cypress.Commands.add('toggleFlowsList', () => {
  cy.get('[data-testid="flows-list-dropdown"]').click({ force: true });
});

Cypress.Commands.add('closeFlowsListIfVisible', () => {
  cy.get('body').then((body) => {
    if (body.find('[data-testid="flows-list-table"]').length > 0) {
      cy.get('[data-testid="flows-list-table"]').then(($element) => {
        if ($element.length > 0) {
          cy.toggleFlowsList();
        }
      });
    }
  });
});

Cypress.Commands.add('openFlowsListIfClosed', () => {
  cy.get('body').then((body) => {
    if (body.find('[data-testid="flows-list-table"]').length === 0) {
      cy.toggleFlowsList();
    }
  });
});

Cypress.Commands.add('allignAllRoutesVisibility', (switchvisibility: string) => {
  cy.toggleFlowsList();
  cy.get('[data-testid="flows-list-table"]').then((body) => {
    if (body.find(`svg[data-testid$="${switchvisibility}"]`).length > 0) {
      cy.get(`svg[data-testid$="${switchvisibility}"]`).then(($element) => {
        if ($element.attr('data-testid')?.endsWith(`${switchvisibility}`)) {
          cy.wrap($element[0]).click();
          cy.closeFlowsListIfVisible();
          cy.allignAllRoutesVisibility(switchvisibility);
        }
      });
    }
  });
  cy.closeFlowsListIfVisible();
});

Cypress.Commands.add('hideAllRoutes', () => {
  cy.allignAllRoutesVisibility('visible');
});

Cypress.Commands.add('showAllRoutes', () => {
  cy.allignAllRoutesVisibility('hidden');
});

Cypress.Commands.add('deleteRoute', (index: number) => {
  cy.openFlowsListIfClosed();
  cy.get('button[data-testid^="delete-btn-route"]').then((buttons) => {
    cy.wrap(buttons[index]).click({ force: true });
  });
  cy.get('body').then(($body) => {
    if ($body.find('.pf-m-danger').length) {
      // Delete Confirmation Modal appeared, click on the confirm button
      cy.get('.pf-m-danger').click({ force: true });
    }
  });
  cy.closeFlowsListIfVisible();
});

Cypress.Commands.add('deleteRouteInCanvas', (routeName: string) => {
  cy.openGroupConfigurationTab(routeName);
  cy.get('button[data-testid="step-toolbar-button-delete-group"]').click();
  cy.get('body').then(($body) => {
    if ($body.find('.pf-m-danger').length) {
      // Delete Confirmation Modal appeared, click on the confirm button
      cy.get('.pf-m-danger').click({ force: true });
    }
  });
});

Cypress.Commands.add('cancelDeleteRoute', (index: number) => {
  cy.openFlowsListIfClosed();
  cy.get('button[data-testid^="delete-btn-route"]').then((buttons) => {
    cy.wrap(buttons[index]).click({ force: true });
  });
  cy.get('body').then(($body) => {
    if ($body.find('.pf-m-danger').length) {
      cy.get('[data-testid="action-confirmation-modal-btn-cancel"]').click({ force: true });
    }
  });
  cy.closeFlowsListIfVisible();
});
