// editor-ui/src/components/diagram/PropertyPanel.tsx
import React, { useState, useEffect } from 'react';
import { AwsComponentData } from '../../types/aws';

interface PropertyPanelProps {
  component: AwsComponentData | null;
  onChange?: (updatedComponent: AwsComponentData) => void;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({ component, onChange }) => {
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  
  useEffect(() => {
    if (component) {
      // Initialize form with component properties
      setFormValues({
        name: component.name,
        ...component.properties,
        // Add component-specific properties
        ...Object.entries(component)
          .filter(([key]) => !['id', 'type', 'position', 'size', 'properties', 'children'].includes(key))
          .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
      });
    } else {
      setFormValues({});
    }
  }, [component]);
  
  if (!component) {
    return (
      <div className="property-panel" style={{ padding: '10px' }}>
        <p>No component selected</p>
      </div>
    );
  }
  
  const handleChange = (key: string, value: any) => {
    setFormValues({
      ...formValues,
      [key]: value
    });
    
    if (onChange && component) {
      // Update the component
      const updatedComponent = { ...component };
      
      // Update name directly if it's the name field
      if (key === 'name') {
        updatedComponent.name = value;
      } 
      // Handle component-specific fields
      else if (Object.prototype.hasOwnProperty.call(component, key)) {
        updatedComponent[key] = value;
      } 
      // Otherwise update properties
      else {
        updatedComponent.properties = {
          ...updatedComponent.properties,
          [key]: value
        };
      }
      
      onChange(updatedComponent);
    }
  };
  
  return (
    <div className="property-panel" style={{ padding: '10px' }}>
      <h3 style={{ marginTop: 0 }}>Properties: {component.type}</h3>
      
      <div className="property-form">
        <div className="property-group">
          <label>Name:</label>
          <input
            type="text"
            value={formValues.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
          />
        </div>
        
        {/* Render component-specific properties */}
        {Object.entries(formValues)
          .filter(([key]) => key !== 'name')
          .map(([key, value]) => (
            <div className="property-group" key={key}>
              <label>{key}:</label>
              {typeof value === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => handleChange(key, e.target.checked)}
                />
              ) : typeof value === 'number' ? (
                <input
                  type="number"
                  value={value}
                  onChange={(e) => handleChange(key, parseFloat(e.target.value))}
                />
              ) : Array.isArray(value) ? (
                <input
                  type="text"
                  value={value.join(',')}
                  onChange={(e) => handleChange(key, e.target.value.split(','))}
                />
              ) : (
                <input
                  type="text"
                  value={value || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                />
              )}
            </div>
          ))}
      </div>
    </div>
  );
};

export default PropertyPanel;