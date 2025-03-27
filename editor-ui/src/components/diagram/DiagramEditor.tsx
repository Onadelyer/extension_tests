import React, { useState, useEffect } from 'react';
import DiagramCanvas from './DiagramCanvas';
import ComponentToolbar, { AwsComponentCategory } from './ComponentToolbar';
import PropertyPanel from './PropertyPanel';
import { DiagramData, AwsComponentData } from '../../types/aws';

// AWS component definitions
const AWS_COMPONENTS = [
  {
    type: 'RegionComponent',
    category: AwsComponentCategory.GLOBAL,
    displayName: 'AWS Region',
    description: 'Geographic area containing AWS resources'
  },
  {
    type: 'VpcComponent',
    category: AwsComponentCategory.NETWORKING,
    displayName: 'VPC',
    description: 'Virtual Private Cloud - isolated network environment'
  },
  {
    type: 'SubnetComponent',
    category: AwsComponentCategory.NETWORKING,
    displayName: 'Subnet',
    description: 'Subdivision of VPC with specific routing rules'
  },
  {
    type: 'EC2InstanceComponent',
    category: AwsComponentCategory.COMPUTE,
    displayName: 'EC2 Instance',
    description: 'Virtual server in the AWS cloud'
  },
  {
    type: 'SecurityGroupComponent',
    category: AwsComponentCategory.SECURITY,
    displayName: 'Security Group',
    description: 'Virtual firewall for resources in VPC'
  },
  {
    type: 'InternetGatewayComponent',
    category: AwsComponentCategory.NETWORKING,
    displayName: 'Internet Gateway',
    description: 'Allows communication between VPC and internet'
  },
  {
    type: 'RouteTableComponent',
    category: AwsComponentCategory.NETWORKING,
    displayName: 'Route Table',
    description: 'Rules determining network traffic direction'
  },
  {
    type: 'S3BucketComponent',
    category: AwsComponentCategory.STORAGE,
    displayName: 'S3 Bucket',
    description: 'Object storage for files and data'
  },
  {
    type: 'RDSInstanceComponent',
    category: AwsComponentCategory.DATABASE,
    displayName: 'RDS Instance',
    description: 'Managed relational database service'
  },
  {
    type: 'LambdaFunctionComponent',
    category: AwsComponentCategory.COMPUTE,
    displayName: 'Lambda Function',
    description: 'Serverless compute service'
  }
];

interface DiagramEditorProps {
  initialDiagram?: DiagramData;
  onSave?: (diagram: DiagramData) => void;
}

const DiagramEditor: React.FC<DiagramEditorProps> = ({ initialDiagram, onSave }) => {
  const [diagram, setDiagram] = useState<DiagramData | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<AwsComponentData | null>(null);
  const [activeTool, setActiveTool] = useState<string>('select');
  const [currentCategory, setCurrentCategory] = useState<AwsComponentCategory | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState<boolean>(false);
  
  // Initialize or load diagram
  useEffect(() => {
    if (initialDiagram) {
      setDiagram(initialDiagram);
    } else {
      // Create a default diagram
      const defaultDiagram: DiagramData = {
        id: 'new-diagram',
        name: 'New Diagram',
        region: {
          id: 'default-region',
          name: 'Region',
          type: 'RegionComponent',
          position: { x: 50, y: 50 },
          size: { width: 800, height: 600 },
          properties: {},
          regionName: 'us-east-1',
          availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
          children: []
        },
        relationships: []
      };
      
      setDiagram(defaultDiagram);
    }
  }, [initialDiagram]);
  
  // Handle component selection
  const handleComponentSelect = (component: AwsComponentData | null) => {
    setSelectedComponent(component);
  };
  
  // Handle diagram changes
  const handleDiagramChange = (updatedDiagram: DiagramData) => {
    setDiagram(updatedDiagram);
    setUnsavedChanges(true);
  };
  
  // Handle component changes
  const handleComponentChange = (updatedComponent: AwsComponentData) => {
    if (!diagram) return;
    
    // Create a copy of the diagram
    const updatedDiagram = { ...diagram };
    
    // Update the component in the diagram
    if (updatedComponent.id === updatedDiagram.region.id) {
      // Update region
      updatedDiagram.region = {
        ...updatedDiagram.region,
        ...updatedComponent
      };
    } else {
      // Update child component
      const updatedChildren = updatedDiagram.region.children.map(child => 
        child.id === updatedComponent.id ? { ...child, ...updatedComponent } : child
      );
      
      updatedDiagram.region.children = updatedChildren;
    }
    
    setDiagram(updatedDiagram);
    setSelectedComponent(updatedComponent);
    setUnsavedChanges(true);
  };
  
  // Handle save
  const handleSave = () => {
    if (diagram && onSave) {
      onSave(diagram);
      setUnsavedChanges(false);
    }
  };
  
  // Handle tool selection
  const handleToolSelect = (componentType: string) => {
    setActiveTool(componentType);
    // If not select tool, deselect any selected component
    if (componentType !== 'select') {
      setSelectedComponent(null);
    }
  };
  
  if (!diagram) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ 
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #0078d4',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            animation: 'spin 2s linear infinite',
            margin: '0 auto 15px'
          }} />
          <p>Loading diagram...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="diagram-editor" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="editor-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '10px',
        borderBottom: '1px solid #ddd',
        backgroundColor: 'var(--vscode-editor-background)',
      }}>
        <div className="diagram-title" style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            value={diagram.name}
            onChange={(e) => {
              const updatedDiagram = { ...diagram, name: e.target.value };
              setDiagram(updatedDiagram);
              setUnsavedChanges(true);
            }}
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
              e.target.style.borderColor = '#ccc';
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
              backgroundColor: '#0078d4',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16L21 8V19C21 20.1046 20.1046 21 19 21Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 21V13H7V21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 3V8H15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Save
          </button>
        </div>
      </div>
      
      <ComponentToolbar
        categories={Object.values(AwsComponentCategory)}
        components={AWS_COMPONENTS}
        selectedCategory={currentCategory}
        onSelectCategory={setCurrentCategory}
        onSelectComponent={(compType: string) => handleToolSelect(compType)}
      />
      
      <div className="editor-main" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className="canvas-container" style={{ flex: 1, overflow: 'auto' }}>
          <DiagramCanvas
            diagram={diagram}
            activeTool={activeTool}
            onComponentSelect={handleComponentSelect}
            onToolFinished={() => setActiveTool('select')}
            onDiagramChange={handleDiagramChange}
          />
        </div>
        
        <div className="property-container" style={{ 
          width: '300px', 
          borderLeft: '1px solid #ddd', 
          overflow: 'auto',
          backgroundColor: 'var(--vscode-sideBar-background)'
        }}>
          <PropertyPanel
            component={selectedComponent}
            onChange={handleComponentChange}
          />
        </div>
      </div>
      
      <div className="editor-footer" style={{ 
        padding: '8px 15px', 
        borderTop: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        backgroundColor: 'var(--vscode-statusBar-background)',
        color: 'var(--vscode-statusBar-foreground)',
        fontSize: '12px'
      }}>
        <div>
          {selectedComponent ? (
            <span>Selected: {selectedComponent.name} ({selectedComponent.type.replace('Component', '')})</span>
          ) : (
            <span>No selection</span>
          )}
        </div>
        <div>
          <span>Tool: {activeTool === 'select' ? 'Select' : activeTool.replace('Component', '')}</span>
        </div>
      </div>
    </div>
  );
};

export default DiagramEditor;