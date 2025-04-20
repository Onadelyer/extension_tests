import { AwsComponent } from "../base/AwsComponent";

export class RouteTableComponent extends AwsComponent {
  constructor(props: Partial<RouteTableComponent> = {}) {
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
  
  static fromJSON(json: any): RouteTableComponent {
    return new RouteTableComponent({
      id: json.id,
      name: json.name,
      position: json.position,
      size: json.size,
      properties: json.properties
    });
  }
} 