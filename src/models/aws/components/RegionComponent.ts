import { AreaComponent } from "../base/AreaComponent";

export class RegionComponent extends AreaComponent {
  regionName: string;
  availabilityZones: string[];
  allowedChildTypes: string[] = ['VpcComponent', 'S3BucketComponent', 'RDSInstanceComponent', 'LambdaFunctionComponent'];
  
  constructor(props: Partial<RegionComponent> = {}) {
    super(props);
    this.regionName = props.regionName || 'us-east-1';
    this.availabilityZones = props.availabilityZones || ['us-east-1a', 'us-east-1b', 'us-east-1c'];
    this.size = props.size || { width: 800, height: 600 };
  }
  
  toJSON(): object {
    return {
      ...super.toJSON(),
      regionName: this.regionName,
      availabilityZones: this.availabilityZones
    };
  }
  
  static fromJSON(json: any): RegionComponent {
    const region = new RegionComponent({
      id: json.id,
      name: json.name,
      position: json.position,
      size: json.size,
      properties: json.properties,
      regionName: json.regionName,
      availabilityZones: json.availabilityZones
    });
    
    // Restore children if they exist
    if (json.children && Array.isArray(json.children)) {
      // This would need a component registry to properly restore children
      // For now, we'll leave this as a placeholder
    }
    
    return region;
  }
}
