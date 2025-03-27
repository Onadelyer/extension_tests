import React from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge
} from 'reactflow';

const ConnectionEdge: React.FC<EdgeProps> = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd
}) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  // Determine the edge style based on the relationship type
  const edgeType = data?.type || 'connects_to';
  let edgeStyle = { ...style };
  let edgeLabel = data?.label || 'connects to';

  switch (edgeType) {
    case 'depends_on':
      edgeStyle = {
        ...edgeStyle,
        strokeWidth: 2,
        stroke: '#6c757d',
        strokeDasharray: '5,5'
      };
      break;
    case 'references':
      edgeStyle = {
        ...edgeStyle,
        strokeWidth: 1.5,
        stroke: '#17a2b8',
        strokeDasharray: '3,3'
      };
      break;
    case 'contains':
      edgeStyle = {
        ...edgeStyle,
        strokeWidth: 2,
        stroke: '#007bff'
      };
      break;
    default: // connects_to
      edgeStyle = {
        ...edgeStyle,
        strokeWidth: 1.5,
        stroke: '#495057'
      };
  }

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 10,
            pointerEvents: 'all',
            backgroundColor: 'white',
            padding: '2px 4px',
            borderRadius: 4,
            border: '1px solid #ccc',
            color: '#555'
          }}
        >
          {edgeLabel}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default ConnectionEdge;