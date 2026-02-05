import { CanvasFormTabsContext, CanvasFormTabsContextResult, KaotoForm } from '@kaoto/forms';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardTitle,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Label,
  LabelGroup,
  TextInput,
} from '@patternfly/react-core';
import { FunctionComponent, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import settingsSchema from '../../assets/settingsSchema.json';
import { useLocalStorage } from '../../hooks/local-storage.hook';
import { useReloadContext } from '../../hooks/useReloadContext/useReloadContext';
import { KaotoSchemaDefinition } from '../../models';
import { LocalStorageKeys } from '../../models/local-storage-keys';
import { SettingsModel } from '../../models/settings';
import { SettingsContext } from '../../providers/settings.provider';
import { Links } from '../../router/links.models';

export const SettingsForm: FunctionComponent = () => {
  const settingsAdapter = useContext(SettingsContext);
  const formTabsValue: CanvasFormTabsContextResult = useMemo(
    () => ({ selectedTab: 'All', setSelectedTab: () => {} }),
    [],
  );
  const navigate = useNavigate();
  const { lastRender, reloadPage } = useReloadContext();
  const [settings, setSettings] = useState(settingsAdapter.getSettings());
  const [customMediaTypes, setCustomMediaTypes] = useLocalStorage<string[]>(LocalStorageKeys.MediaTypes, []);
  const [mediaTypeInput, setMediaTypeInput] = useState('');

  const onChangeModel = (value: unknown) => {
    setSettings(value as SettingsModel);
  };

  const onSave = () => {
    settingsAdapter.saveSettings(settings);
    reloadPage();
    navigate(Links.Home);
  };

  const sortedMediaTypes = useMemo(() => [...customMediaTypes].sort(), [customMediaTypes]);

  const addMediaType = useCallback(() => {
    const trimmed = mediaTypeInput.trim();
    if (!trimmed) {
      return;
    }
    if (!customMediaTypes.includes(trimmed)) {
      setCustomMediaTypes([...customMediaTypes, trimmed]);
    }
    setMediaTypeInput('');
  }, [customMediaTypes, mediaTypeInput, setCustomMediaTypes]);

  const removeMediaType = useCallback(
    (value: string) => {
      setCustomMediaTypes(customMediaTypes.filter((item) => item !== value));
    },
    [customMediaTypes, setCustomMediaTypes],
  );

  const clearMediaTypes = useCallback(() => {
    setCustomMediaTypes([]);
  }, [setCustomMediaTypes]);

  return (
    <Card data-last-render={lastRender}>
      <CardTitle>Settings</CardTitle>

      <CardBody>
        <CanvasFormTabsContext.Provider value={formTabsValue}>
          <KaotoForm
            data-testid="settings-form"
            schema={settingsSchema as KaotoSchemaDefinition['schema']}
            model={settings}
            onChange={onChangeModel}
          />
        </CanvasFormTabsContext.Provider>

        <Form>
          <div style={{ marginTop: '24px' }}>
            <FormGroup label="Custom media types" fieldId="settings-custom-media-types">
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>These values are available in Rest DSL Consumes/Produces fields.</HelperTextItem>
                </HelperText>
              </FormHelperText>
              <Flex gap={{ default: 'gapMd' }} direction={{ default: 'column' }}>
                <FlexItem>
                  <Flex gap={{ default: 'gapSm' }}>
                    <FlexItem grow={{ default: 'grow' }}>
                      <TextInput
                        id="settings-custom-media-types-input"
                        value={mediaTypeInput}
                        onChange={(_event, value) => setMediaTypeInput(value)}
                        placeholder="Add media type (e.g., application/vnd.api+json)"
                      />
                    </FlexItem>
                    <FlexItem>
                      <Button
                        variant="secondary"
                        onClick={addMediaType}
                        isDisabled={mediaTypeInput.trim().length === 0}
                      >
                        Add
                      </Button>
                    </FlexItem>
                  </Flex>
                </FlexItem>

                <FlexItem>
                  {sortedMediaTypes.length === 0 ? (
                    <span>No custom media types saved.</span>
                  ) : (
                    <div style={{ maxHeight: '160px', overflowY: 'auto', paddingRight: '8px' }}>
                      <LabelGroup>
                        {sortedMediaTypes.map((type) => (
                          <Label key={type} onClose={() => removeMediaType(type)} color="blue">
                            {type}
                          </Label>
                        ))}
                      </LabelGroup>
                    </div>
                  )}
                </FlexItem>

                <FlexItem>
                  <Button variant="link" isInline onClick={clearMediaTypes} isDisabled={sortedMediaTypes.length === 0}>
                    Clear all
                  </Button>
                </FlexItem>
              </Flex>
            </FormGroup>
          </div>
        </Form>
      </CardBody>

      <CardFooter>
        <Flex justifyContent={{ default: 'justifyContentFlexEnd' }} style={{ width: '100%' }}>
          <FlexItem>
            <Button data-testid="settings-form-save-btn" variant="primary" onClick={onSave}>
              Apply
            </Button>
          </FlexItem>
        </Flex>
      </CardFooter>
    </Card>
  );
};
