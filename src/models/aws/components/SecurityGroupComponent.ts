import { AreaComponent } from "../base/AreaComponent";

export class SecurityGroupComponent extends AreaComponent {
  description?: string;
  allowedChildTypes: string[] = ['EC2InstanceComponent', 'RDSInstanceComponent', 'LambdaFunctionComponent'];
  
  constructor(props: Partial<SecurityGroupComponent> = {}) {
    super(props);
    this.description = props.description;
  }
  
  toJSON(): object {
    return {
      ...super.toJSON(),
      description: this.description
    };
  }
  
  static fromJSON(json: any): SecurityGroupComponent {
    return new SecurityGroupComponent({
      id: json.id,
      name: json.name,
      position: json.position,
      size: json.size,
      properties: json.properties,
      description: json.description
    });
  }
} 