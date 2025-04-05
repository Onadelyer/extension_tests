import React, { useEffect, useState } from 'react';
import { ReactFlowProvider, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';

import useDiagramStore from '../../store/diagramStore';
import { createDefaultDiagram } from '../../../src/utils/diagramConverters';
import { diagramToYaml } from '../../../src/utils/yamlConverter';
import DiagramCanvas from './Canvas';
import ComponentToolbar from './Toolbar';
import PropertyPanel from '../panels/PropertyPanel';

interface DiagramEditorProps {
  initialDiagram?: any;
  onExportYaml?: (yamlContent: string, diagramName: string) => void;
}

export const DiagramEditor: React.FC<DiagramEditorProps> = ({ 
  initialDiagram, 
  onExportYaml 
}) => {
  const { setDiagram, convertToVSCodeData, diagram } = useDiagramStore();
  const [diagramName, setDiagramName] = useState<string>('New Diagram');

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
  }, [initialDiagram, setDiagram]);

  // Handle YAML export
  const handleExportYaml = () => {
    if (onExportYaml) {
      try {
        const diagramData = convertToVSCodeData();
        // Update the name
        diagramData.name = diagramName;
        
        // Ensure source files data is included
        // This is a hacky way to ensure source files are included if they're missing
        // In a production environment, you'd want to access this data more directly
        if (!diagramData.sourceFiles && window.diagramSourceFiles) {
          diagramData.sourceFiles = window.diagramSourceFiles;
        }
        
        // Convert to YAML
        const yamlContent = diagramToYaml(diagramData);
        
        // Send to extension to handle file save
        onExportYaml(yamlContent, diagramName);
      } catch (error) {
        console.error('Error exporting diagram as YAML:', error);
      }
    }
  };

  // Handle name change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDiagramName(e.target.value);
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
          </div>

          <div className="editor-tools">
            {/* Export to YAML button */}
            <button
              onClick={handleExportYaml}
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
            >
              {/* Export icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export YAML
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