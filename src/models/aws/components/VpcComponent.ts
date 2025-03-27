import { ContainerComponent } from "../base/ContainerComponent";

export class VpcComponent extends ContainerComponent {
  cidrBlock: string;
  
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
    // Placeholder as with RegionComponent
    
    return vpc;
  }
}