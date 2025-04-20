import React, { useEffect, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';

import useDiagramStore from '../../store/diagramStore';
import { createDefaultDiagram } from '../../utils/diagramConverters';
import DiagramCanvas from './Canvas';
import ComponentToolbar from './Toolbar';
import PropertyPanel from '../panels/PropertyPanel';
import { DiagramData } from '../../types/aws';

interface DiagramEditorProps {
  initialDiagram?: any;
  onUpdate?: (diagram: DiagramData) => void;
}

export const DiagramEditor: React.FC<DiagramEditorProps> = ({ 
  initialDiagram, 
  onUpdate
}) => {
  const { setDiagram, convertToVSCodeData, diagram } = useDiagramStore();
  const [diagramName, setDiagramName] = useState<string>('New Diagram');

  // Initialize with initial diagram data or create a default one
  useEffect(() => {
    console.log('[DEBUG] DiagramEditor - useEffect initializing diagram');
    if (initialDiagram) {
      console.log('[DEBUG] DiagramEditor - Received initial diagram:', initialDiagram);
      console.log('[DEBUG] DiagramEditor - Initial diagram children count:', 
        initialDiagram.region?.children?.length || 'N/A');
      setDiagram(initialDiagram);
      setDiagramName(initialDiagram.name || 'New Diagram');
    } else {
      console.log('[DEBUG] DiagramEditor - Creating default diagram');
      const defaultDiagram = createDefaultDiagram();
      setDiagram(defaultDiagram);
      setDiagramName(defaultDiagram.name);
    }
  }, [initialDiagram, setDiagram]);

  // Update the diagram state only, not saving to file
  const handleUpdate = () => {
    if (onUpdate && diagram) {
      try {
        console.log('[DEBUG] DiagramEditor - handleUpdate - Converting to VS Code data');
        const diagramData = convertToVSCodeData();
        // Update the name
        diagramData.name = diagramName;
        console.log('[DEBUG] DiagramEditor - handleUpdate - Diagram after conversion:', diagramData);
        console.log('[DEBUG] DiagramEditor - handleUpdate - Children count:', 
          diagramData.region?.children?.length || 'N/A');
        onUpdate(diagramData);
      } catch (error) {
        console.error('[DEBUG] DiagramEditor - Error updating diagram:', error);
      }
    }
  };

  // Handle name change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDiagramName(e.target.value);
  };

  // Update state when name changes or after delay
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleUpdate();
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [diagramName]);

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
                handleUpdate(); // Update state when focus is lost
              }}
            />
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