/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useEffect, useRef, useState } from 'react';

import { Alert, Button } from '@digdir/design-system-react';
import { Close } from '@navikt/ds-icons';

import classes from 'src/features/devtools/components/LayoutInspector/LayoutInspector.module.css';
import { LayoutInspectorItem } from 'src/features/devtools/components/LayoutInspector/LayoutInspectorItem';
import { SplitView } from 'src/features/devtools/components/SplitView/SplitView';
import { useDevToolsStore } from 'src/features/devtools/data/DevToolsStore';
import { DevToolsTab } from 'src/features/devtools/data/types';
import { useLayoutValidationForPage } from 'src/features/devtools/layoutValidation/useLayoutValidation';
import { useLayouts } from 'src/features/form/layout/LayoutsContext';
import { useCurrentView } from 'src/hooks/useNavigatePage';
import { getParsedLanguageFromText } from 'src/language/sharedLanguage';
import { useNodes } from 'src/utils/layout/NodesContext';

export const LayoutInspector = () => {
  const selectedComponent = useDevToolsStore((state) => state.layoutInspector.selectedComponentId);
  const setSelectedComponent = useDevToolsStore((state) => state.actions.layoutInspectorSet);
  const setNodeInspectorSelectedNodeId = useDevToolsStore((state) => state.actions.nodeInspectorSet);
  const setActiveTab = useDevToolsStore((state) => state.actions.setActiveTab);
  const currentView = useCurrentView();
  const layouts = useLayouts();
  const [componentProperties, setComponentProperties] = useState<string | null>(null);
  const [propertiesHaveChanged, setPropertiesHaveChanged] = useState(false);
  const [error, setError] = useState<boolean>(false);
  const nodes = useNodes();

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [componentProperties]);

  const currentLayout = currentView ? layouts?.[currentView] : undefined;
  const matchingNodes = selectedComponent ? nodes?.findAllById(selectedComponent) || [] : [];
  const validationErrorsForPage = useLayoutValidationForPage() || {};

  useEffect(() => {
    setSelectedComponent(undefined);
  }, [setSelectedComponent, currentView]);

  useEffect(() => {
    if (selectedComponent) {
      const component = currentLayout?.find((component) => component.id === selectedComponent);
      setComponentProperties(JSON.stringify(component, null, 2));
    }
    setPropertiesHaveChanged(false);
  }, [selectedComponent, currentLayout]);

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setComponentProperties(event.target.value);
    !propertiesHaveChanged && setPropertiesHaveChanged(true);
  }

  function handleSave() {
    if (selectedComponent) {
      try {
        const updatedComponent = JSON.parse(componentProperties ?? '');
        const _updatedLayout = currentLayout?.map((component) => {
          if (component.id === selectedComponent) {
            return updatedComponent;
          } else {
            return component;
          }
        });

        if (currentView) {
          // TODO: Fix this
          alert('TODO: Update layout in tanstack query store');
          // dispatch(FormLayoutActions.updateLayouts({ [currentView]: updatedLayout }));
        }

        setPropertiesHaveChanged(false);
        return;
      } catch (error) {
        console.error(error);
      }
    }
    setError(true);
    setTimeout(() => {
      setError(false);
    }, 2000);
  }

  const NodeLink = ({ nodeId }: { nodeId: string }) => (
    <div>
      <a
        href='#'
        onClick={(e) => {
          e.preventDefault();
          setNodeInspectorSelectedNodeId(nodeId);
          setActiveTab(DevToolsTab.Components);
        }}
      >
        Utforsk {nodeId} i komponenter-fanen
      </a>
    </div>
  );

  return (
    <SplitView
      direction='row'
      sizes={[300]}
    >
      <div className={classes.container}>
        <ul className={classes.list}>
          {currentLayout?.map((component) => (
            <LayoutInspectorItem
              key={component.id}
              component={component}
              selected={selectedComponent === component.id}
              hasErrors={
                validationErrorsForPage[component.id] !== undefined && validationErrorsForPage[component.id].length > 0
              }
              onClick={() => setSelectedComponent(component.id)}
            />
          ))}
        </ul>
      </div>
      {selectedComponent && (
        <div className={classes.properties}>
          <div className={classes.header}>
            <h3>Egenskaper</h3>
            {validationErrorsForPage[selectedComponent] && validationErrorsForPage[selectedComponent].length > 0 && (
              <Alert
                className={classes.errorAlert}
                severity={'warning'}
              >
                <div className={classes.errorList}>
                  <ul>
                    {validationErrorsForPage[selectedComponent].map((error) => (
                      <li key={error}>{getParsedLanguageFromText(error)}</li>
                    ))}
                  </ul>
                </div>
              </Alert>
            )}
            <div className={classes.headerLink}>
              {matchingNodes.length === 0 && 'Ingen aktive komponenter funnet'}
              {matchingNodes.map((node) => (
                <NodeLink
                  key={node.item.id}
                  nodeId={node.item.id}
                />
              ))}
            </div>
            <Button
              onClick={() => setSelectedComponent(undefined)}
              variant='tertiary'
              color='second'
              size='small'
              aria-label={'close'}
              icon={<Close aria-hidden />}
            />
          </div>
          <textarea
            ref={textAreaRef}
            value={componentProperties ?? ''}
            onChange={handleChange}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                // Save when pressing ctrl + s
                !error && handleSave();
                event.preventDefault();
                event.stopPropagation();
              }
            }}
          />
          {error && <span className={classes.error}>Ugyldig JSON</span>}
          {propertiesHaveChanged && (
            <Button
              fullWidth
              size='small'
              onClick={handleSave}
            >
              Lagre
            </Button>
          )}
        </div>
      )}
    </SplitView>
  );
};
