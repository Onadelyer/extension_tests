import React, { useState, useEffect } from 'react';
import { AwsComponentData } from '../../types/aws';

interface PropertyPanelProps {
  component: AwsComponentData | null;
  onChange?: (updatedComponent: AwsComponentData) => void;
}

interface PropertyGroup {
  label: string;
  properties: PropertyDefinition[];
}

interface PropertyDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'array' | 'cidr';
  options?: string[];
  placeholder?: string;
  helpText?: string;
  validation?: RegExp;
  defaultValue?: any;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({ component, onChange }) => {
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('basic');
  
  // Define property groups for different component types
  const getPropertyDefinitionsByType = (componentType: string): PropertyGroup[] => {
    const commonProperties: PropertyGroup = {
      label: 'Basic',
      properties: [
        { key: 'name', label: 'Name', type: 'text', placeholder: 'Component name' },
        { key: 'description', label: 'Description', type: 'text', placeholder: 'Optional description' }
      ]
    };
    
    switch (componentType) {
      case 'RegionComponent':
        return [
          commonProperties,
          {
            label: 'Region Settings',
            properties: [
              { 
                key: 'regionName', 
                label: 'Region', 
                type: 'select',
                options: [
                  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
                  'eu-west-1', 'eu-west-2', 'eu-west-3',
                  'eu-central-1',
                  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1'
                ]
              },
              { 
                key: 'availabilityZones', 
                label: 'Availability Zones', 
                type: 'array',
                helpText: 'Comma-separated list of AZs'
              }
            ]
          }
        ];
      
      case 'VpcComponent':
        return [
          commonProperties,
          {
            label: 'VPC Settings',
            properties: [
              { 
                key: 'cidrBlock', 
                label: 'CIDR Block', 
                type: 'cidr',
                placeholder: '10.0.0.0/16',
                validation: /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/,
                helpText: 'IPv4 CIDR block (e.g., 10.0.0.0/16)'
              },
              { 
                key: 'enableDnsSupport', 
                label: 'Enable DNS Support', 
                type: 'boolean',
                defaultValue: true
              },
              { 
                key: 'enableDnsHostnames', 
                label: 'Enable DNS Hostnames', 
                type: 'boolean',
                defaultValue: true
              }
            ]
          }
        ];
        
      case 'SubnetComponent':
        return [
          commonProperties,
          {
            label: 'Subnet Settings',
            properties: [
              { 
                key: 'cidrBlock', 
                label: 'CIDR Block', 
                type: 'cidr',
                placeholder: '10.0.1.0/24',
                validation: /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/
              },
              { 
                key: 'availabilityZone', 
                label: 'Availability Zone', 
                type: 'select',
                options: component?.type === 'RegionComponent' 
                  ? component.availabilityZones || [] 
                  : ['a', 'b', 'c'].map(az => `${component?.regionName || 'us-east-1'}-${az}`)
              },
              { 
                key: 'isPublic', 
                label: 'Public Subnet', 
                type: 'boolean',
                defaultValue: false
              }
            ]
          }
        ];
        
      case 'EC2InstanceComponent':
        return [
          commonProperties,
          {
            label: 'Instance Settings',
            properties: [
              { 
                key: 'instanceType', 
                label: 'Instance Type', 
                type: 'select',
                options: [
                  't2.micro', 't2.small', 't2.medium', 't2.large',
                  'm5.large', 'm5.xlarge', 'm5.2xlarge',
                  'c5.large', 'c5.xlarge', 'c5.2xlarge',
                  'r5.large', 'r5.xlarge', 'r5.2xlarge'
                ]
              },
              { 
                key: 'ami', 
                label: 'AMI ID', 
                type: 'text',
                placeholder: 'ami-12345...',
                validation: /^ami-[a-f0-9]+$/
              }
            ]
          },
          {
            label: 'Advanced',
            properties: [
              { key: 'subnetId', label: 'Subnet ID', type: 'text' },
              { key: 'securityGroups', label: 'Security Groups', type: 'array' },
              { key: 'keyName', label: 'SSH Key Name', type: 'text' }
            ]
          }
        ];
        
      // Add more component types as needed
      
      default:
        return [commonProperties];
    }
  };
  
  useEffect(() => {
    if (component) {
      // Initialize form with component properties
      const formData: Record<string, any> = {
        name: component.name,
        description: component.properties?.description || '',
        ...component.properties,
      };
      
      // Add component-specific properties
      Object.entries(component)
        .filter(([key]) => !['id', 'type', 'position', 'size', 'properties', 'children'].includes(key))
        .forEach(([key, value]) => {
          formData[key] = value;
        });
      
      setFormValues(formData);
      setValidationErrors({});
    } else {
      setFormValues({});
      setValidationErrors({});
    }
  }, [component]);
  
  if (!component) {
    return (
      <div className="property-panel" style={{ padding: '15px' }}>
        <p style={{ color: '#666', textAlign: 'center' }}>No component selected</p>
        <p style={{ fontSize: '13px', color: '#666', textAlign: 'center' }}>
          Select a component from the canvas or drag a new component from the palette.
        </p>
      </div>
    );
  }
  
  const propertyGroups = getPropertyDefinitionsByType(component.type);
  
  const validateField = (key: string, value: any, validation?: RegExp): boolean => {
    if (!validation) return true;
    if (typeof value !== 'string') return true;
    if (value.trim() === '') return true; // Allow empty values
    
    const isValid = validation.test(value);
    
    if (!isValid) {
      setValidationErrors(prev => ({
        ...prev,
        [key]: 'Invalid format'
      }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
    
    return isValid;
  };
  
  const handleChange = (key: string, value: any, validation?: RegExp) => {
    // Validate the field if it has a validation pattern
    validateField(key, value, validation);
    
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
  
  const renderField = (property: PropertyDefinition) => {
    const { key, label, type, options, placeholder, helpText, validation } = property;
    const value = formValues[key];
    const error = validationErrors[key];
    
    switch (type) {
      case 'boolean':
        return (
          <div className="form-group" key={key}>
            <label>
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => handleChange(key, e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              {label}
            </label>
            {helpText && (
              <div className="help-text" style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
                {helpText}
              </div>
            )}
          </div>
        );
        
      case 'select':
        return (
          <div className="form-group" key={key}>
            <label>{label}:</label>
            <select
              value={value || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            >
              <option value="">Select...</option>
              {options?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {helpText && (
              <div className="help-text" style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
                {helpText}
              </div>
            )}
          </div>
        );
        
      case 'array':
        return (
          <div className="form-group" key={key}>
            <label>{label}:</label>
            <input
              type="text"
              value={Array.isArray(value) ? value.join(',') : value || ''}
              onChange={(e) => handleChange(key, e.target.value.split(',').map(item => item.trim()))}
              placeholder={placeholder}
              style={{
                width: '100%',
                padding: '8px',
                border: error ? '1px solid #d9534f' : '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
            {helpText && (
              <div className="help-text" style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
                {helpText}
              </div>
            )}
          </div>
        );
        
      case 'number':
        return (
          <div className="form-group" key={key}>
            <label>{label}:</label>
            <input
              type="number"
              value={value !== undefined ? value : ''}
              onChange={(e) => handleChange(key, parseFloat(e.target.value))}
              placeholder={placeholder}
              style={{
                width: '100%',
                padding: '8px',
                border: error ? '1px solid #d9534f' : '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
            {error && <div style={{ color: '#d9534f', fontSize: '12px', marginTop: '3px' }}>{error}</div>}
            {helpText && !error && (
              <div className="help-text" style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
                {helpText}
              </div>
            )}
          </div>
        );
        
      case 'cidr':
        return (
          <div className="form-group" key={key}>
            <label>{label}:</label>
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleChange(key, e.target.value, validation)}
              placeholder={placeholder}
              style={{
                width: '100%',
                padding: '8px',
                border: error ? '1px solid #d9534f' : '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
            {error && <div style={{ color: '#d9534f', fontSize: '12px', marginTop: '3px' }}>{error}</div>}
            {helpText && !error && (
              <div className="help-text" style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
                {helpText}
              </div>
            )}
          </div>
        );
        
      case 'text':
      default:
        return (
          <div className="form-group" key={key}>
            <label>{label}:</label>
            <input
              type="text"
              value={value !== undefined ? value : ''}
              onChange={(e) => handleChange(key, e.target.value, validation)}
              placeholder={placeholder}
              style={{
                width: '100%',
                padding: '8px',
                border: error ? '1px solid #d9534f' : '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
            {error && <div style={{ color: '#d9534f', fontSize: '12px', marginTop: '3px' }}>{error}</div>}
            {helpText && !error && (
              <div className="help-text" style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
                {helpText}
              </div>
            )}
          </div>
        );
    }
  };
  
  return (
    <div className="property-panel" style={{ padding: '15px' }}>
      <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '16px' }}>{component.type.replace('Component', '')}</h3>
        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>ID: {component.id.substring(0, 8)}...</span>
      </div>
      
      <div className="property-tabs" style={{ marginBottom: '15px', borderBottom: '1px solid #ddd' }}>
        {propertyGroups.map((group, index) => (
          <button
            key={group.label}
            onClick={() => setActiveTab(group.label.toLowerCase())}
            style={{
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === group.label.toLowerCase() ? '2px solid #0078d4' : '2px solid transparent',
              color: activeTab === group.label.toLowerCase() ? '#0078d4' : 'inherit',
              cursor: 'pointer',
              marginRight: '5px',
              fontSize: '13px',
              fontWeight: activeTab === group.label.toLowerCase() ? 'bold' : 'normal'
            }}
          >
            {group.label}
          </button>
        ))}
      </div>
      
      <div className="property-form" style={{ marginBottom: '15px' }}>
        {propertyGroups.map(group => (
          <div 
            key={group.label}
            style={{ 
              display: activeTab === group.label.toLowerCase() ? 'block' : 'none',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {group.properties.map(property => renderField(property))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="position-info" style={{ marginTop: '20px', fontSize: '13px', color: '#666' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'normal' }}>Position</h4>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>X:</label>
            <input
              type="number"
              value={component.position.x}
              onChange={(e) => {
                const x = parseInt(e.target.value);
                const updatedComponent = { ...component };
                updatedComponent.position = { ...updatedComponent.position, x };
                onChange?.(updatedComponent);
              }}
              style={{
                width: '100%',
                padding: '4px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Y:</label>
            <input
              type="number"
              value={component.position.y}
              onChange={(e) => {
                const y = parseInt(e.target.value);
                const updatedComponent = { ...component };
                updatedComponent.position = { ...updatedComponent.position, y };
                onChange?.(updatedComponent);
              }}
              style={{
                width: '100%',
                padding: '4px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
          </div>
        </div>
      </div>
      
      <div className="size-info" style={{ marginTop: '10px', fontSize: '13px', color: '#666' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'normal' }}>Size</h4>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Width:</label>
            <input
              type="number"
              value={component.size.width}
              onChange={(e) => {
                const width = parseInt(e.target.value);
                const updatedComponent = { ...component };
                updatedComponent.size = { ...updatedComponent.size, width };
                onChange?.(updatedComponent);
              }}
              style={{
                width: '100%',
                padding: '4px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Height:</label>
            <input
              type="number"
              value={component.size.height}
              onChange={(e) => {
                const height = parseInt(e.target.value);
                const updatedComponent = { ...component };
                updatedComponent.size = { ...updatedComponent.size, height };
                onChange?.(updatedComponent);
              }}
              style={{
                width: '100%',
                padding: '4px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyPanel;