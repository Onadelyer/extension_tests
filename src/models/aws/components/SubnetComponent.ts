import { AreaComponent } from "../base/AreaComponent";

export class SubnetComponent extends AreaComponent {
  cidrBlock: string;
  availabilityZone: string;
  isPublic: boolean;
  allowedChildTypes: string[] = ['EC2InstanceComponent', 'RDSInstanceComponent', 'LambdaFunctionComponent'];
  
  constructor(props: Partial<SubnetComponent> = {}) {
    super(props);
    this.cidrBlock = props.cidrBlock || '10.0.1.0/24';
    this.availabilityZone = props.availabilityZone || 'us-east-1a';
    this.isPublic = props.isPublic ?? false;
  }
  
  toJSON(): object {
    return {
      ...super.toJSON(),
      cidrBlock: this.cidrBlock,
      availabilityZone: this.availabilityZone,
      isPublic: this.isPublic
    };
  }
  
  static fromJSON(json: any): SubnetComponent {
    return new SubnetComponent({
      id: json.id,
      name: json.name,
      position: json.position,
      size: json.size,
      properties: json.properties,
      cidrBlock: json.cidrBlock,
      availabilityZone: json.availabilityZone,
      isPublic: json.isPublic
    });
  }
}