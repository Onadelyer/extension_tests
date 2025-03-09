import { generateUUID } from "../utils/IdGenerator";

export enum RelationshipType {
  CONTAINS = 'contains',
  CONNECTS_TO = 'connects_to',
  DEPENDS_ON = 'depends_on',
  REFERENCES = 'references'
}

export class ComponentRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  label?: string;
  
  constructor(source: string, target: string, type: RelationshipType, label?: string) {
    this.id = generateUUID();
    this.sourceId = source;
    this.targetId = target;
    this.type = type;
    this.label = label;
  }
  
  toJSON(): object {
    return {
      id: this.id,
      sourceId: this.sourceId,
      targetId: this.targetId,
      type: this.type,
      label: this.label
    };
  }
  
  static fromJSON(json: any): ComponentRelationship {
    return new ComponentRelationship(
      json.sourceId,
      json.targetId,
      json.type as RelationshipType,
      json.label
    );
  }
}