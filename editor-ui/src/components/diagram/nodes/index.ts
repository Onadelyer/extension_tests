import EC2Node from './EC2Node';
import AreaNode from './AreaNode';
import InternetGatewayNode from './InternetGatewayNode';
import RouteTableNode from './RouteTableNode';

// Log the available node types for debugging
console.log('[DEBUG] nodes/index.ts - Registering node types for ReactFlow');

export const nodeTypes = {
  EC2InstanceComponent: EC2Node,
  VpcComponent: AreaNode,
  SubnetComponent: AreaNode,
  SecurityGroupComponent: AreaNode,
  RegionComponent: AreaNode,
  InternetGatewayComponent: InternetGatewayNode,
  RouteTableComponent: RouteTableNode
};

// Log the registered node types
console.log('[DEBUG] nodes/index.ts - Registered node types:', Object.keys(nodeTypes));