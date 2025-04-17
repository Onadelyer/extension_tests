export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface AwsComponentData {
  id: string;
  name: string;
  type: string;
  position: Position;
  size: Size;
  properties: Record<string, any>;
  [key: string]: any; // For component-specific properties
}

export interface ContainerComponentData extends AwsComponentData {
  children: AwsComponentData[];
}

export interface RegionComponentData extends ContainerComponentData {
  regionName: string;
  availabilityZones: string[];
}

export enum RelationshipType {
  CONTAINS = 'contains',
  CONNECTS_TO = 'connects_to',
  DEPENDS_ON = 'depends_on',
  REFERENCES = 'references'
}

export interface RelationshipData {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  label?: string;
}

export interface SourceFileInfo {
  rootFolder: string;
  files: string[];
}

export interface DiagramData {
  id: string;
  name: string;
  region: RegionComponentData;
  relationships: RelationshipData[];
  terraformSource?: string;
  sourceFiles?: SourceFileInfo;
}

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