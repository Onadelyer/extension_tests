// src/parsers/TerraformResourceParser.ts
import * as fs from 'fs';
import * as path from 'path';
import { parse, TerraformConfig } from '@evops/hcl-terraform-parser';
import { ResourceMappingConfig, ResourceMapping } from '../config/ResourceMappingConfig';
import { TerraformParser } from './TerraformParser';

/**
 * Represents a Terraform resource with its attributes
 */
export interface TerraformResource {
  type: string;              // Resource type (aws_instance, aws_vpc, etc.)
  name: string;              // Resource name
  attributes: {              // Resource attributes
    [key: string]: any;
  };
  dependencies: string[];    // IDs of resources this depends on
  sourceFile: string;        // File this resource is defined in
  id: string;                // Unique identifier (type.name)
}

/**
 * Parser for extracting Terraform resources
 */
export class TerraformResourceParser {
  private parser: TerraformParser;
  
  constructor() {
    this.parser = new TerraformParser();
  }
  
  /**
   * Extract resources from a file and its dependencies based on the configuration
   * @param filePath The main file to parse
   * @param config Resource mapping configuration
   * @returns Array of parsed resources
   */
  async parseResourcesFromFile(
    filePath: string, 
    config: ResourceMappingConfig
  ): Promise<TerraformResource[]> {
    try {
      // Get all dependent files
      const allFiles = await this.parser.getAllDependentFileUris(filePath);
      
      // Parse resources from all files
      return this.parseResourcesFromFiles(allFiles, config);
    } catch (error) {
      console.error(`Error parsing resources from ${filePath}:`, error);
      throw error;
    }
  }
  
  /**
   * Extract resources from multiple files
   * @param filePaths Array of file paths to parse
   * @param config Resource mapping configuration
   * @returns Array of parsed resources
   */
  async parseResourcesFromFiles(
    filePaths: string[], 
    config: ResourceMappingConfig
  ): Promise<TerraformResource[]> {
    const resources: TerraformResource[] = [];
    const resourceTypes = config.resourceMappings.map(m => m.terraformType);
    
    for (const filePath of filePaths) {
      try {
        // Read file content
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Parse HCL content
        const parsedContent = parse(content);
        
        // Extract resources
        const fileResources = this.extractResourcesFromHCL(parsedContent, filePath, resourceTypes);
        resources.push(...fileResources);
      } catch (error) {
        console.warn(`Error parsing file ${filePath}:`, error);
        // Continue with other files even if one fails
      }
    }
    
    // Apply configuration filters
    return this.filterResources(resources, config);
  }
  
  /**
   * Extract resources from parsed HCL
   * @param parsedHCL Parsed HCL content
   * @param filePath Source file path
   * @param resourceTypes Resource types to include
   * @returns Array of resources
   */
  private extractResourcesFromHCL(
    parsedHCL: TerraformConfig, 
    filePath: string,
    resourceTypes: string[]
  ): TerraformResource[] {
    const resources: TerraformResource[] = [];
    
    // Handle managed resources (standard format)
    if (parsedHCL.managed_resources) {
      for (const [resourceType, resourcesOfType] of Object.entries(parsedHCL.managed_resources)) {
        // Skip if not in our resource types list
        if (!resourceTypes.includes(resourceType)) {
          continue;
        }
        
        // Process all resources of this type
        if (resourcesOfType && typeof resourcesOfType === 'object') {
          for (const [resourceName, resourceData] of Object.entries(resourcesOfType)) {
            if (resourceData && typeof resourceData === 'object') {
              const resource: TerraformResource = {
                type: resourceType,
                name: resourceName,
                attributes: this.flattenAttributes(resourceData),
                dependencies: this.extractDependencies(resourceData),
                sourceFile: filePath,
                id: `${resourceType}.${resourceName}`
              };
              
              resources.push(resource);
            }
          }
        }
      }
    }
    
    // Handle resources in old format
    // This code handles the non-managed_resources format which is also common
    for (const [key, value] of Object.entries(parsedHCL)) {
      if (key !== 'managed_resources' && resourceTypes.includes(key) && value && typeof value === 'object') {
        for (const [resourceName, resourceData] of Object.entries(value)) {
          if (resourceData && typeof resourceData === 'object') {
            const resource: TerraformResource = {
              type: key,
              name: resourceName,
              attributes: this.flattenAttributes(resourceData),
              dependencies: this.extractDependencies(resourceData),
              sourceFile: filePath,
              id: `${key}.${resourceName}`
            };
            
            resources.push(resource);
          }
        }
      }
    }
    
    return resources;
  }
  
  /**
   * Flatten nested attributes into dot notation
   * @param obj The object to flatten
   * @param prefix Current prefix for nested attributes
   * @returns Flattened attributes object
   */
  private flattenAttributes(
    obj: any, 
    prefix: string = ''
  ): { [key: string]: any } {
    const result: { [key: string]: any } = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(result, this.flattenAttributes(value, newKey));
      } else {
        // Add leaf value
        result[newKey] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Extract dependencies from resource attributes
   * @param resourceData Resource data
   * @returns Array of dependency IDs
   */
  private extractDependencies(resourceData: any): string[] {
    const dependencies: string[] = [];
    
    // Helper function to find references in strings
    const findReferences = (value: any) => {
      if (typeof value === 'string') {
        // Look for Terraform references like ${aws_vpc.main.id}
        const matches = value.match(/\$\{([^}]+)\}/g) || [];
        matches.forEach(match => {
          const ref = match.substring(2, match.length - 1);
          // Check if it's a resource reference
          if (ref.includes('.') && !ref.startsWith('var.')) {
            const parts = ref.split('.');
            if (parts.length >= 2) {
              const depType = parts[0];
              const depName = parts[1];
              dependencies.push(`${depType}.${depName}`);
            }
          }
        });
      }
    };
    
    // Recursively search for references
    const searchObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') {
        return;
      }
      
      if (Array.isArray(obj)) {
        obj.forEach(item => {
          if (typeof item === 'string') {
            findReferences(item);
          } else if (typeof item === 'object') {
            searchObject(item);
          }
        });
      } else {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string') {
            findReferences(value);
          } else if (Array.isArray(value)) {
            searchObject(value);
          } else if (typeof value === 'object' && value !== null) {
            searchObject(value);
          }
        }
      }
    };
    
    searchObject(resourceData);
    return [...new Set(dependencies)]; // Remove duplicates
  }
  
  /**
   * Filter resources based on configuration
   * @param resources Array of resources
   * @param config Resource mapping configuration
   * @returns Filtered array of resources
   */
  private filterResources(
    resources: TerraformResource[], 
    config: ResourceMappingConfig
  ): TerraformResource[] {
    return resources.filter(resource => {
      // Find the matching resource mapping
      const mapping = config.resourceMappings.find(m => m.terraformType === resource.type);
      
      if (!mapping) {
        // No mapping for this resource type
        return false;
      }
      
      // Apply include pattern if specified
      if (mapping.includePattern) {
        const includeRegex = new RegExp(mapping.includePattern);
        if (!includeRegex.test(resource.name)) {
          return false;
        }
      }
      
      // Apply exclude pattern if specified
      if (mapping.excludePattern) {
        const excludeRegex = new RegExp(mapping.excludePattern);
        if (excludeRegex.test(resource.name)) {
          return false;
        }
      }
      
      return true;
    });
  }
}