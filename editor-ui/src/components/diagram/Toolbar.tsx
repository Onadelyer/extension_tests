import React, { useState } from 'react';
import { getAwsIconByType } from '../../assets/aws-icons';
import { AwsComponentCategory } from '../../types/aws';
import useDiagramStore from '../../store/diagramStore';

// Component definition interface
export interface ComponentDefinition {
  type: string;
  category: AwsComponentCategory;
  displayName: string;
  description: string;
}

// AWS component definitions
const AWS_COMPONENTS: ComponentDefinition[] = [
  {
    type: 'RegionComponent',
    category: AwsComponentCategory.AREA,
    displayName: 'AWS Region',
    description: 'Geographic area containing AWS resources'
  },
  {
    type: 'VpcComponent',
    category: AwsComponentCategory.AREA,
    displayName: 'VPC',
    description: 'Virtual Private Cloud - isolated network environment'
  },
  {
    type: 'SubnetComponent',
    category: AwsComponentCategory.AREA,
    displayName: 'Subnet',
    description: 'Subdivision of VPC with specific routing rules'
  },
  {
    type: 'SecurityGroupComponent',
    category: AwsComponentCategory.AREA,
    displayName: 'Security Group',
    description: 'Virtual firewall for resources in VPC'
  },
  {
    type: 'EC2InstanceComponent',
    category: AwsComponentCategory.COMPUTE,
    displayName: 'EC2 Instance',
    description: 'Virtual server in the AWS cloud'
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

const ComponentToolbar: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<AwsComponentCategory | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Filter components by category
  const filteredComponents = activeCategory
    ? AWS_COMPONENTS.filter(comp => comp.category === activeCategory)
    : AWS_COMPONENTS;

  // Handle drag start
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Render collapsed toolbar
  if (isCollapsed) {
    return (
      <div
        className="component-toolbar-collapsed"
        style={{
          padding: '10px',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--vscode-editor-background)',
          color: 'var(--vscode-foreground)'
        }}
      >
        <span>Component Palette</span>
        <button
          onClick={() => setIsCollapsed(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--vscode-button-foreground)'
          }}
        >
          <span style={{ fontSize: '20px' }}>▼</span>
        </button>
      </div>
    );
  }

  return (
    <div className="component-toolbar" style={{ 
      borderBottom: '1px solid #ddd', 
      padding: '10px',
      backgroundColor: 'var(--vscode-editor-background)',
      color: 'var(--vscode-foreground)' 
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <h3 style={{ margin: 0 }}>Component Palette</h3>
        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--vscode-button-foreground)'
          }}
        >
          <span style={{ fontSize: '20px' }}>▲</span>
        </button>
      </div>

      <div className="category-tabs" style={{ display: 'flex', marginBottom: '10px', flexWrap: 'wrap' }}>
        <button
          style={{
            marginRight: '5px',
            marginBottom: '5px',
            padding: '5px 10px',
            backgroundColor: !activeCategory ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
            color: !activeCategory ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
            border: '1px solid #ccc',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>

        {Object.values(AwsComponentCategory).map(category => (
          <button
            key={category}
            style={{
              marginRight: '5px',
              marginBottom: '5px',
              padding: '5px 10px',
              backgroundColor: activeCategory === category ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
              color: activeCategory === category ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
              border: '1px solid #ccc',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div
        className="component-palette"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}
      >
        {filteredComponents.map(comp => (
          <div
            key={comp.type}
            className="palette-item"
            style={{
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'grab',
              width: '80px',
              height: '90px',
              justifyContent: 'space-between',
              backgroundColor: 'var(--vscode-editor-background)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              userSelect: 'none'
            }}
            draggable={true}
            onDragStart={(e) => onDragStart(e, comp.type)}
            title={comp.description}
          >
            <div className="component-icon" style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
              {getAwsIconByType(comp.type, { size: 36 })}
            </div>
            <span style={{
              fontSize: '12px',
              textAlign: 'center',
              lineHeight: '1.2',
              marginTop: '8px',
              color: 'var(--vscode-foreground)'
            }}>
              {comp.displayName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComponentToolbar;