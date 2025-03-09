// editor-ui/src/components/diagram/DiagramEditor.tsx
import React, { useState, useEffect } from 'react';
import DiagramCanvas from './DiagramCanvas';
import ComponentToolbar, { AwsComponentCategory } from './ComponentToolbar';
import PropertyPanel from './PropertyPanel';
import { DiagramData, AwsComponentData } from '../../types/aws';

// Sample AWS component definitions
const AWS_COMPONENTS = [
  {
    type: 'RegionComponent',
    category: AwsComponentCategory.GLOBAL,
    displayName: 'AWS Region',
    iconPath: 'media/aws-icons/region.svg',
    description: 'AWS Region'
  },
  {
    type: 'VpcComponent',
    category: AwsComponentCategory.NETWORKING,
    displayName: 'VPC',
    iconPath: 'media/aws-icons/vpc.svg',
    description: 'Virtual Private Cloud'
  },
  {
    type: 'EC2InstanceComponent',
    category: AwsComponentCategory.COMPUTE,
    displayName: 'EC2 Instance',
    iconPath: 'media/aws-icons/ec2.svg',
    description: 'Elastic Compute Cloud'
  },
  {
    type: 'SubnetComponent',
    category: AwsComponentCategory.NETWORKING,
    displayName: 'Subnet',
    iconPath: 'media/aws-icons/subnet.svg',
    description: 'VPC Subnet'
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
  
  // Handle component changes
  const handleComponentChange = (updatedComponent: AwsComponentData) => {
    if (!diagram) return;
    
    // Create a copy of the diagram
    const updatedDiagram = { ...diagram };
    
    // Update the component in the diagram
    // This is a simplified implementation; in a real app, you'd need to handle
    // nested components and complex hierarchies
    
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
  };
  
  // Handle save
  const handleSave = () => {
    if (diagram && onSave) {
      onSave(diagram);
    }
  };
  
  if (!diagram) {
    return <div>Loading diagram...</div>;
  }
  
  return (
    <div className="diagram-editor" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <ComponentToolbar
        categories={Object.values(AwsComponentCategory)}
        components={AWS_COMPONENTS}
        selectedCategory={currentCategory}
        onSelectCategory={setCurrentCategory}
        onSelectComponent={(compType: string) => setActiveTool(compType)}
      />
      
      <div className="editor-main" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className="canvas-container" style={{ flex: 1, overflow: 'auto' }}>
          <DiagramCanvas
            diagram={diagram}
            activeTool={activeTool}
            onComponentSelect={handleComponentSelect}
            onToolFinished={() => setActiveTool('select')}
          />
        </div>
        
        <div className="property-container" style={{ width: '300px', borderLeft: '1px solid #ddd', overflow: 'auto' }}>
          <PropertyPanel
            component={selectedComponent}
            onChange={handleComponentChange}
          />
        </div>
      </div>
      
      <div className="editor-footer" style={{ padding: '10px', borderTop: '1px solid #ddd' }}>
        <button 
          style={{
            padding: '8px 16px',
            backgroundColor: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
          onClick={handleSave}
        >
          Save Diagram
        </button>
      </div>
    </div>
  );
};

export default DiagramEditor;