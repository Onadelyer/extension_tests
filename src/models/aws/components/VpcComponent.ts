import { AreaComponent } from "../base/AreaComponent";

export class VpcComponent extends AreaComponent {
  cidrBlock: string;
  allowedChildTypes: string[] = ['SubnetComponent', 'SecurityGroupComponent', 'RouteTableComponent'];
  
  constructor(props: Partial<VpcComponent> = {}) {
    super(props);
    this.cidrBlock = props.cidrBlock || '10.0.0.0/16';
  }
  
  toJSON(): object {
    return {
      ...super.toJSON(),
      cidrBlock: this.cidrBlock
    };
  }
  
  static fromJSON(json: any): VpcComponent {
    const vpc = new VpcComponent({
      id: json.id,
      name: json.name,
      position: json.position,
      size: json.size,
      properties: json.properties,
      cidrBlock: json.cidrBlock
    });
    
    // Restore children if they exist
    if (json.children && Array.isArray(json.children)) {
      // This would need a component registry to properly restore children
      // For now, we'll leave this as a placeholder
    }
    
    return vpc;
  }
}