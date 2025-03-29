import React, { useEffect, useState } from 'react';
import { ReactFlowProvider, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';

import useDiagramStore from '../../store/diagramStore';
import { createDefaultDiagram } from '../../../src/utils/diagramConverters';
import DiagramCanvas from './Canvas';
import ComponentToolbar from './Toolbar';
import PropertyPanel from '../panels/PropertyPanel';

interface DiagramEditorProps {
  initialDiagram?: any;
  onSave?: (diagram: any) => void;
}

export const DiagramEditor: React.FC<DiagramEditorProps> = ({ initialDiagram, onSave }) => {
  const { setDiagram, convertToVSCodeData, diagram } = useDiagramStore();
  const [diagramName, setDiagramName] = useState<string>('New Diagram');
  const [unsavedChanges, setUnsavedChanges] = useState<boolean>(false);

  // Initialize with initial diagram data or create a default one
  useEffect(() => {
    if (initialDiagram) {
      setDiagram(initialDiagram);
      setDiagramName(initialDiagram.name || 'New Diagram');
    } else {
      const defaultDiagram = createDefaultDiagram();
      setDiagram(defaultDiagram);
      setDiagramName(defaultDiagram.name);
    }
    setUnsavedChanges(false);
  }, [initialDiagram, setDiagram]);

  // Mark changes as unsaved when diagram changes
  useEffect(() => {
    if (diagram) {
      setUnsavedChanges(true);
    }
  }, [diagram]);

  // Handle save
  const handleSave = () => {
    if (onSave) {
      try {
        const diagramData = convertToVSCodeData();
        // Update the name
        diagramData.name = diagramName;
        onSave(diagramData);
        setUnsavedChanges(false);
      } catch (error) {
        console.error('Error saving diagram:', error);
      }
    }
  };

  // Handle name change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDiagramName(e.target.value);
    setUnsavedChanges(true);
  };

  return (
    <ReactFlowProvider>
      <div className="diagram-editor" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        backgroundColor: 'var(--vscode-editor-background)',
        color: 'var(--vscode-foreground)'
      }}>
        <div className="editor-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px',
          borderBottom: '1px solid var(--vscode-panel-border)',
        }}>
          <div className="diagram-title" style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              value={diagramName}
              onChange={handleNameChange}
              style={{
                fontSize: '16px',
                fontWeight: 'bold',
                padding: '5px 10px',
                border: '1px solid transparent',
                borderRadius: '3px',
                backgroundColor: 'transparent',
                color: 'var(--vscode-foreground)',
                width: '250px'
              }}
              onFocus={(e) => {
                e.target.style.backgroundColor = 'var(--vscode-input-background)';
                e.target.style.borderColor = 'var(--vscode-focusBorder)';
              }}
              onBlur={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.borderColor = 'transparent';
              }}
            />
            {unsavedChanges && (
              <span style={{
                marginLeft: '10px',
                fontSize: '12px',
                color: 'var(--vscode-editorCodeLens-foreground)'
              }}>
                (unsaved changes)
              </span>
            )}
          </div>

          <div className="editor-tools">
            <button
              onClick={handleSave}
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              disabled={!unsavedChanges}
            >
              {/* Simple save icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16L21 8V19C21 20.1046 20.1046 21 19 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17 21V13H7V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 3V8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Save
            </button>
          </div>
        </div>

        <ComponentToolbar />

        <div className="editor-main" style={{ 
          display: 'flex', 
          flex: 1, 
          overflow: 'hidden' 
        }}>
          <div className="canvas-container" style={{ 
            flex: 1, 
            overflow: 'hidden',
            position: 'relative'
          }}>
            <DiagramCanvas />
          </div>

          <div className="property-container" style={{
            width: '300px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <PropertyPanel />
          </div>
        </div>

        <div className="editor-footer" style={{
          padding: '8px 15px',
          borderTop: '1px solid var(--vscode-panel-border)',
          display: 'flex',
          justifyContent: 'space-between',
          backgroundColor: 'var(--vscode-statusBar-background)',
          color: 'var(--vscode-statusBar-foreground)',
          fontSize: '12px'
        }}>
          <div>
            <span>AWS Diagram Editor</span>
          </div>
          <div>
            <span>Drag and drop components to create your diagram</span>
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default DiagramEditor;