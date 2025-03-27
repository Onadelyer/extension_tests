import React, { useState } from 'react';
import { getAwsIconByType } from '../../assets/aws-icons';

export enum AwsComponentCategory {
  GLOBAL = 'Global',
  COMPUTE = 'Compute',
  NETWORKING = 'Networking',
  STORAGE = 'Storage',
  DATABASE = 'Database',
  SECURITY = 'Security',
  INTEGRATION = 'Integration',
  CONTAINER = 'Container'
}

export interface ComponentDefinition {
  type: string;
  category: AwsComponentCategory;
  displayName: string;
  description: string;
}

interface ComponentToolbarProps {
  categories: AwsComponentCategory[];
  components: ComponentDefinition[];
  selectedCategory: AwsComponentCategory | null;
  onSelectCategory: (category: AwsComponentCategory | null) => void;
  onSelectComponent: (componentType: string) => void;
}

const ComponentToolbar: React.FC<ComponentToolbarProps> = ({
  categories,
  components,
  selectedCategory,
  onSelectCategory,
  onSelectComponent
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  if (isCollapsed) {
    return (
      <div 
        className="component-toolbar-collapsed"
        style={{ 
          padding: '10px', 
          borderBottom: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
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
            color: '#0078d4'
          }}
        >
          <span style={{ fontSize: '20px' }}>▼</span>
        </button>
      </div>
    );
  }

  return (
    <div className="component-toolbar" style={{ borderBottom: '1px solid #ddd', padding: '10px' }}>
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
            color: '#0078d4'
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
            backgroundColor: !selectedCategory ? '#0078d4' : '#f0f0f0',
            color: !selectedCategory ? 'white' : 'black',
            border: '1px solid #ccc',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
          onClick={() => onSelectCategory(null)}
        >
          All
        </button>
        
        {categories.map(category => (
          <button
            key={category}
            style={{
              marginRight: '5px',
              marginBottom: '5px',
              padding: '5px 10px',
              backgroundColor: selectedCategory === category ? '#0078d4' : '#f0f0f0',
              color: selectedCategory === category ? 'white' : 'black',
              border: '1px solid #ccc',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
            onClick={() => onSelectCategory(category)}
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
          gap: '10px'
        }}
      >
        {components
          .filter(comp => !selectedCategory || comp.category === selectedCategory)
          .map(comp => (
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
                cursor: 'pointer',
                width: '80px',
                height: '90px',
                justifyContent: 'space-between',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                userSelect: 'none'
              }}
              onClick={() => onSelectComponent(comp.type)}
              onDragStart={(e) => {
                e.dataTransfer.setData('componentType', comp.type);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              draggable
              title={comp.description}
            >
              <div className="component-icon" style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
                {getAwsIconByType(comp.type, { size: 36 })}
              </div>
              <span style={{ 
                fontSize: '12px', 
                textAlign: 'center', 
                lineHeight: '1.2',
                marginTop: '8px'
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