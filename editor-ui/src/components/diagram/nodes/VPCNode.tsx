import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { VpcIcon } from '../../../assets/aws-icons';

// Style for all AWS nodes
const nodeStyle = {
  padding: '8px',
  borderRadius: '4px',
  width: '120px',
  height: '80px',
  fontSize: '12px',
  background: 'white',
  border: '1px solid #ddd',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
};

const selectedStyle = {
  ...nodeStyle,
  borderColor: '#0078d4',
  boxShadow: '0 0 0 2px #0078d4'
};

const VPCNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  return (
    <div style={selected ? selectedStyle : nodeStyle}>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <VpcIcon color="#FF9900" size={24} />
        <div style={{ fontWeight: 'bold', marginTop: '4px', textAlign: 'center', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.name || 'VPC'}
        </div>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
          {data.cidrBlock || '10.0.0.0/16'}
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};

export default memo(VPCNode);