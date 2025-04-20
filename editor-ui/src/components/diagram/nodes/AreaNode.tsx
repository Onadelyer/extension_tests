import React, { memo, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import { 
  VpcIcon, 
  SubnetIcon,
  SecurityGroupIcon,
  RegionIcon
} from '../../../assets/aws-icons';
import useDiagramStore from '../../../store/diagramStore';

// Base area style (dashed container)
const areaStyle = {
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(240, 240, 240, 0.5)',
  border: '1px dashed #ccc',
  borderRadius: '8px',
  position: 'relative' as const,
  padding: '10px',
  cursor: 'pointer'
};

const selectedAreaStyle = {
  ...areaStyle,
  border: '1px dashed #0078d4',
  backgroundColor: 'rgba(0, 120, 212, 0.05)'
};

const droppableStyle = {
  ...areaStyle,
  border: '2px dashed #0078d4',
  backgroundColor: 'rgba(0, 120, 212, 0.05)',
  boxShadow: '0 0 10px rgba(0, 120, 212, 0.3)'
};

const headerStyle = {
  position: 'absolute' as const,
  top: '10px',
  left: '10px',
  display: 'flex',
  alignItems: 'center',
  padding: '4px 8px',
  backgroundColor: 'white',
  borderRadius: '4px',
  border: '1px solid #ddd',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  zIndex: 10
};

const footerStyle = {
  position: 'absolute' as const,
  bottom: '10px',
  right: '10px',
  fontSize: '10px',
  padding: '4px 6px',
  backgroundColor: 'rgba(255, 255, 255, 0.5)',
  borderRadius: '4px',
  color: '#666'
};

const resourcesListStyle = {
  position: 'absolute' as const,
  bottom: '10px',
  left: '10px',
  maxWidth: '60%',
  fontSize: '10px',
  padding: '6px 8px',
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  borderRadius: '4px',
  color: '#333',
  border: '1px solid #eee',
  maxHeight: '80px',
  overflowY: 'auto' as const
};

const dropIndicatorStyle = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  color: '#0078d4',
  fontSize: '14px',
  fontWeight: 'bold',
  padding: '8px 16px',
  borderRadius: '4px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  zIndex: 100,
  pointerEvents: 'none' as const
};

// Map component types to appropriate icons
const getIconForType = (type: string, color: string = '#FF9900', size: number = 16) => {
  switch (type) {
    case 'VpcComponent':
      return <VpcIcon color={color} size={size} />;
    case 'SubnetComponent':
      return <SubnetIcon color={color} size={size} />;
    case 'SecurityGroupComponent':
      return <SecurityGroupIcon color={color} size={size} />;
    case 'RegionComponent':
      return <RegionIcon color={color} size={size} />;
    default:
      return <RegionIcon color={color} size={size} />;
  }
};

// Map component types to appropriate footer info
const getFooterInfo = (data: any, type: string): React.ReactNode => {
  switch (type) {
    case 'VpcComponent':
      return `CIDR: ${data.cidrBlock || '10.0.0.0/16'}`;
    case 'SubnetComponent':
      return `${data.isPublic ? 'Public' : 'Private'} - ${data.availabilityZone || 'us-east-1a'}`;
    case 'SecurityGroupComponent':
      return 'Security Rules';
    case 'RegionComponent':
      const azCount = data.availabilityZones?.length || 3;
      return `${azCount} Availability Zones`;
    default:
      return 'Area Container';
  }
};

// Component to render list of contained resources
const ContainedResourcesList = ({ resources }: { resources: Array<{ id: string, name: string, type: string }> }) => {
  if (!resources || resources.length === 0) {
    return null;
  }
  
  return (
    <div style={resourcesListStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '11px' }}>
        Resources: {resources.length}
      </div>
      <ul style={{ margin: '0', padding: '0 0 0 12px' }}>
        {resources.map(resource => (
          <li key={resource.id} style={{ marginBottom: '2px' }}>
            {resource.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

const AreaNode: React.FC<NodeProps> = ({ id, data, selected, type, isConnectable, dragging, ...props }) => {
  const { selectNode } = useDiagramStore();
  
  // Force selection when node is clicked directly
  const handleNodeClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    selectNode(id);
  }, [id, selectNode]);

  const nodeType = type || data.type || 'Unknown';
  
  // Check if this node is marked as a drop target from Canvas dragging
  console.log(`AreaNode ${id} - Data:`, data);
  const isDropTarget = !!data.isDropTarget;
  
  // Choose the appropriate style based on state
  let currentStyle = areaStyle;
  if (selected) {
    currentStyle = selectedAreaStyle;
  }
  if (isDropTarget) {
    currentStyle = droppableStyle;
    console.log(`AreaNode ${id} is a drop target`);
  }
  
  return (
    <div 
      style={currentStyle}
      onClick={handleNodeClick}
    >
      <div style={headerStyle}>
        {getIconForType(nodeType)}
        <span style={{ marginLeft: '6px', fontWeight: 'bold', fontSize: '12px' }}>
          {data.name || nodeType.replace('Component', '')}
        </span>
      </div>
      
      {/* Display contained resources if any */}
      <ContainedResourcesList resources={data.containedResources} />
      
      {/* Drop indicator for when a node is being dragged over this area */}
      {isDropTarget && (
        <div style={dropIndicatorStyle}>
          Drop to Add Resource
        </div>
      )}
      
      <div style={footerStyle}>
        {getFooterInfo(data, nodeType)}
      </div>
    </div>
  );
};

export default memo(AreaNode); 