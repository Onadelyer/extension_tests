import EC2Node from './EC2Node';
import VPCNode from './VPCNode';
import SubnetNode from './SubnetNode';
// import SecurityGroupNode from './SecurityGroupNode';
// import S3BucketNode from './S3BucketNode';
// import RDSNode from './RDSNode';
// import LambdaNode from './LambdaNode';
import RegionNode from './RegionNode';
// import InternetGatewayNode from './InternetGatewayNode';
// import RouteTableNode from './RouteTableNode';

export const nodeTypes = {
  EC2InstanceComponent: EC2Node,
  VpcComponent: VPCNode,
  SubnetComponent: SubnetNode,
  // SecurityGroupComponent: SecurityGroupNode,
  // S3BucketComponent: S3BucketNode,
  // RDSInstanceComponent: RDSNode,
  // LambdaFunctionComponent: LambdaNode,
  RegionComponent: RegionNode,
  // InternetGatewayComponent: InternetGatewayNode,
  // RouteTableComponent: RouteTableNode
};