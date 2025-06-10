import React, { memo, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import { RegionIcon } from '../../../assets/aws-icons';
import useDiagramStore from '../../../store/diagramStore';

const regionStyle = {
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(240, 240, 240, 0.5)',
  border: '1px dashed #ccc',
  borderRadius: '8px',
  position: 'relative' as const,
  padding: '10px',
  cursor: 'pointer'
};

const selectedRegionStyle = {
  ...regionStyle,
  border: '1px dashed #0078d4',
  backgroundColor: 'rgba(0, 120, 212, 0.05)'
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

const RegionNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { selectNode } = useDiagramStore();
  
  // Force selection when node is clicked directly
  const handleNodeClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    selectNode(id);
  }, [id, selectNode]);

  // Get actual region name and availability zones
  const regionName = data.regionName || 'us-east-1';
  const availabilityZones = data.availabilityZones || ['us-east-1a', 'us-east-1b', 'us-east-1c'];
  
  return (
    <div 
      style={selected ? selectedRegionStyle : regionStyle}
      onClick={handleNodeClick}
    >
      <div style={headerStyle}>
        <RegionIcon color="#FF9900" size={16} />
        <span style={{ marginLeft: '6px', fontWeight: 'bold', fontSize: '12px' }}>
          {data.name || 'Region'}: {regionName}
        </span>
      </div>
      
      <div style={{ 
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        fontSize: '10px',
        padding: '4px 6px',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderRadius: '4px',
        color: '#666'
      }}>
        {availabilityZones.length} Availability Zones
      </div>
    </div>
  );
};

export default memo(RegionNode);