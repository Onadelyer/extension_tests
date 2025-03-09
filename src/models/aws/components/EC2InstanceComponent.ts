import { AwsComponent } from "../base/AwsComponent";

export class EC2InstanceComponent extends AwsComponent {
  instanceType: string;
  ami: string;
  
  constructor(props: Partial<EC2InstanceComponent> = {}) {
    super(props);
    this.instanceType = props.instanceType || 't2.micro';
    this.ami = props.ami || 'ami-12345';
  }
  
  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      position: this.position,
      size: this.size,
      properties: this.properties,
      instanceType: this.instanceType,
      ami: this.ami
    };
  }
  
  static fromJSON(json: any): EC2InstanceComponent {
    return new EC2InstanceComponent({
      id: json.id,
      name: json.name,
      position: json.position,
      size: json.size,
      properties: json.properties,
      instanceType: json.instanceType,
      ami: json.ami
    });
  }
}