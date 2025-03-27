import React, { useState, useEffect } from 'react';
import useDiagramStore from '../../store/diagramStore';

interface PropertyField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'boolean' | 'cidr' | 'array';
  options?: string[];
  placeholder?: string;
  validation?: RegExp;
  helpText?: string;
}

interface PropertyGroup {
  title: string;
  fields: PropertyField[];
}

const PropertyPanel: React.FC = () => {
  const { selectedNodes, nodes, updateNode } = useDiagramStore();
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Find the selected node
  const selectedNode = selectedNodes.length > 0 
    ? nodes.find(node => node.id === selectedNodes[0]) 
    : null;

  // Reset active tab when selection changes
  useEffect(() => {
    setActiveTab('basic');
    setValidationErrors({});
  }, [selectedNodes]);

  if (!selectedNode) {
    return (
      <div className="property-panel" style={{ 
        padding: '15px', 
        backgroundColor: 'var(--vscode-sideBar-background)',
        color: 'var(--vscode-foreground)',
        height: '100%',
        borderLeft: '1px solid var(--vscode-panel-border)' 
      }}>
        <div style={{ textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
          <p>No component selected</p>
          <p style={{ fontSize: '13px', marginTop: '10px' }}>
            Select a component from the canvas or drag a new component from the palette.
          </p>
        </div>
      </div>
    );
  }

  // Generate property fields based on node type
  const getPropertyGroups = (): PropertyGroup[] => {
    // Basic properties for all components
    const basicGroup: PropertyGroup = {
      title: 'Basic',
      fields: [
        { key: 'name', label: 'Name', type: 'text', placeholder: 'Component name' },
        { key: 'description', label: 'Description', type: 'text', placeholder: 'Optional description' }
      ]
    };

    // Component-specific properties
    switch (selectedNode.type) {
      case 'RegionComponent':
        return [
          basicGroup,
          {
            title: 'Region Settings',
            fields: [
              {
                key: 'regionName',
                label: 'Region',
                type: 'select',
                options: [
                  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
                  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
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
          basicGroup,
          {
            title: 'VPC Settings',
            fields: [
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
                type: 'boolean'
              },
              {
                key: 'enableDnsHostnames',
                label: 'Enable DNS Hostnames',
                type: 'boolean'
              }
            ]
          }
        ];

      case 'SubnetComponent':
        return [
          basicGroup,
          {
            title: 'Subnet Settings',
            fields: [
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
                options: ['us-east-1a', 'us-east-1b', 'us-east-1c', 'us-east-1d', 'us-east-1e', 'us-east-1f']
              },
              {
                key: 'isPublic',
                label: 'Public Subnet',
                type: 'boolean'
              }
            ]
          }
        ];

      case 'EC2InstanceComponent':
        return [
          basicGroup,
          {
            title: 'Instance Settings',
            fields: [
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
          }
        ];

      default:
        return [basicGroup];
    }
  };

  // Update property value
  const handlePropertyChange = (key: string, value: any, validation?: RegExp) => {
    // Validate if needed
    if (validation && typeof value === 'string') {
      const isValid = validation.test(value);
      if (!isValid && value !== '') {
        setValidationErrors(prev => ({ ...prev, [key]: 'Invalid format' }));
        return;
      } else {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[key];
          return newErrors;
        });
      }
    }

    // Update the node data
    updateNode(selectedNode.id, {
      data: {
        ...selectedNode.data,
        [key]: value
      }
    });
  };

  // Render a field based on its type
  const renderField = (field: PropertyField) => {
    const value = selectedNode.data[field.key];
    const error = validationErrors[field.key];

    switch (field.type) {
      case 'boolean':
        return (
          <div className="form-group" key={field.key} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => handlePropertyChange(field.key, e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              {field.label}
            </label>
            {field.helpText && (
              <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginTop: '3px' }}>
                {field.helpText}
              </div>
            )}
          </div>
        );

      case 'select':
        return (
          <div className="form-group" key={field.key} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>{field.label}:</label>
            <select
              value={value || ''}
              onChange={(e) => handlePropertyChange(field.key, e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '4px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            >
              <option value="">Select...</option>
              {field.options?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {field.helpText && (
              <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginTop: '3px' }}>
                {field.helpText}
              </div>
            )}
          </div>
        );

      case 'array':
        return (
          <div className="form-group" key={field.key} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>{field.label}:</label>
            <input
              type="text"
              value={Array.isArray(value) ? value.join(',') : value || ''}
              onChange={(e) => handlePropertyChange(
                field.key, 
                e.target.value.split(',').map(item => item.trim())
              )}
              placeholder={field.placeholder}
              style={{
                width: '100%',
                padding: '8px',
                border: error ? '1px solid var(--vscode-errorForeground)' : '1px solid var(--vscode-input-border)',
                borderRadius: '4px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
            {error && (
              <div style={{ color: 'var(--vscode-errorForeground)', fontSize: '12px', marginTop: '3px' }}>
                {error}
              </div>
            )}
            {field.helpText && !error && (
              <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginTop: '3px' }}>
                {field.helpText}
              </div>
            )}
          </div>
        );

      case 'number':
        return (
          <div className="form-group" key={field.key} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>{field.label}:</label>
            <input
              type="number"
              value={value !== undefined ? value : ''}
              onChange={(e) => handlePropertyChange(field.key, parseFloat(e.target.value))}
              placeholder={field.placeholder}
              style={{
                width: '100%',
                padding: '8px',
                border: error ? '1px solid var(--vscode-errorForeground)' : '1px solid var(--vscode-input-border)',
                borderRadius: '4px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
            {error && (
              <div style={{ color: 'var(--vscode-errorForeground)', fontSize: '12px', marginTop: '3px' }}>
                {error}
              </div>
            )}
            {field.helpText && !error && (
              <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginTop: '3px' }}>
                {field.helpText}
              </div>
            )}
          </div>
        );

      case 'cidr':
      case 'text':
      default:
        return (
          <div className="form-group" key={field.key} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>{field.label}:</label>
            <input
              type="text"
              value={value !== undefined ? value : ''}
              onChange={(e) => handlePropertyChange(field.key, e.target.value, field.validation)}
              placeholder={field.placeholder}
              style={{
                width: '100%',
                padding: '8px',
                border: error ? '1px solid var(--vscode-errorForeground)' : '1px solid var(--vscode-input-border)',
                borderRadius: '4px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
            {error && (
              <div style={{ color: 'var(--vscode-errorForeground)', fontSize: '12px', marginTop: '3px' }}>
                {error}
              </div>
            )}
            {field.helpText && !error && (
              <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginTop: '3px' }}>
                {field.helpText}
              </div>
            )}
          </div>
        );
    }
  };

  const propertyGroups = getPropertyGroups();

  return (
    <div className="property-panel" style={{ 
      padding: '15px', 
      backgroundColor: 'var(--vscode-sideBar-background)',
      color: 'var(--vscode-foreground)',
      height: '100%',
      borderLeft: '1px solid var(--vscode-panel-border)',
      overflowY: 'auto' 
    }}>
      <div style={{ 
        marginBottom: '15px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '16px' }}>
        {selectedNode.type ? selectedNode.type.replace('Component', '') : 'Component'}
        </h3>
        <span style={{ 
          fontSize: '12px', 
          color: 'var(--vscode-descriptionForeground)',
          padding: '2px 6px',
          backgroundColor: 'var(--vscode-badge-background)',
          borderRadius: '4px'
        }}>
          {selectedNode.id.substring(0, 8)}...
        </span>
      </div>

      <div className="property-tabs" style={{ 
        marginBottom: '15px', 
        borderBottom: '1px solid var(--vscode-panel-border)' 
      }}>
        {propertyGroups.map((group) => (
          <button
            key={group.title}
            onClick={() => setActiveTab(group.title.toLowerCase())}
            style={{
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === group.title.toLowerCase() 
                ? '2px solid var(--vscode-focusBorder)' 
                : '2px solid transparent',
              color: activeTab === group.title.toLowerCase() 
                ? 'var(--vscode-foreground)' 
                : 'var(--vscode-descriptionForeground)',
              cursor: 'pointer',
              marginRight: '5px',
              fontSize: '13px',
              fontWeight: activeTab === group.title.toLowerCase() ? 'bold' : 'normal'
            }}
          >
            {group.title}
          </button>
        ))}
      </div>

      <div className="property-form">
        {propertyGroups.map(group => (
          <div
            key={group.title}
            style={{
              display: activeTab === group.title.toLowerCase() ? 'block' : 'none',
            }}
          >
            {group.fields.map(field => renderField(field))}
          </div>
        ))}
      </div>

      {/* Position and Size Information */}
      <div style={{ 
        marginTop: '20px', 
        paddingTop: '15px',
        borderTop: '1px solid var(--vscode-panel-border)'
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'normal' }}>Position & Size</h4>
        
        {/* Position controls */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>X:</label>
            <input
              type="number"
              value={selectedNode.position.x}
              onChange={(e) => {
                updateNode(selectedNode.id, {
                  position: { 
                    ...selectedNode.position, 
                    x: parseInt(e.target.value) 
                  }
                });
              }}
              style={{
                width: '100%',
                padding: '6px',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '3px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Y:</label>
            <input
              type="number"
              value={selectedNode.position.y}
              onChange={(e) => {
                updateNode(selectedNode.id, {
                  position: { 
                    ...selectedNode.position, 
                    y: parseInt(e.target.value) 
                  }
                });
              }}
              style={{
                width: '100%',
                padding: '6px',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '3px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
          </div>
        </div>
        
        {/* Size controls */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Width:</label>
            <input
              type="number"
              value={selectedNode.style?.width || 120}
              onChange={(e) => {
                updateNode(selectedNode.id, {
                  style: { 
                    ...selectedNode.style, 
                    width: parseInt(e.target.value) 
                  }
                });
              }}
              style={{
                width: '100%',
                padding: '6px',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '3px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)'
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Height:</label>
            <input
              type="number"
              value={selectedNode.style?.height || 80}
              onChange={(e) => {
                updateNode(selectedNode.id, {
                  style: { 
                    ...selectedNode.style, 
                    height: parseInt(e.target.value) 
                  }
                });
              }}
              style={{
                width: '100%',
                padding: '6px',
                border: '1px solid var(--vscode-input-border)',
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