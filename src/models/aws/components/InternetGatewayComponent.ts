import { AwsComponent } from "../base/AwsComponent";

export class InternetGatewayComponent extends AwsComponent {
  constructor(props: Partial<InternetGatewayComponent> = {}) {
    super(props);
  }
  
  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      position: this.position,
      size: this.size,
      properties: this.properties
    };
  }
  
  static fromJSON(json: any): InternetGatewayComponent {
    return new InternetGatewayComponent({
      id: json.id,
      name: json.name,
      position: json.position,
      size: json.size,
      properties: json.properties
    });
  }
} 