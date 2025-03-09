// editor-ui/src/components/diagram/ComponentToolbar.tsx
import React, { useState } from 'react';

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
  iconPath: string;
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
  return (
    <div className="component-toolbar" style={{ borderBottom: '1px solid #ddd', padding: '10px' }}>
      <div className="category-tabs" style={{ display: 'flex', marginBottom: '10px' }}>
        <button
          style={{
            marginRight: '5px',
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
                padding: '5px',
                border: '1px solid #ddd',
                borderRadius: '3px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                width: '80px',
                height: '80px',
                justifyContent: 'center',
                backgroundColor: 'white'
              }}
              onClick={() => onSelectComponent(comp.type)}
              title={comp.description}
            >
              <div style={{ width: '32px', height: '32px', marginBottom: '5px' }}>
                {/* Placeholder for icon */}
                <svg width="32" height="32" viewBox="0 0 32 32">
                  <rect width="32" height="32" fill="#ccc" />
                  <text x="16" y="20" fontSize="10" textAnchor="middle" fill="#333">
                    {comp.type.substring(0, 2)}
                  </text>
                </svg>
              </div>
              <span style={{ fontSize: '12px', textAlign: 'center' }}>{comp.displayName}</span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default ComponentToolbar;