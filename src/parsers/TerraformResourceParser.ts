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
        
        try {
          // Try parsing with HCL parser first
          const parsedContent = parse(content);
          
          // Extract resources
          const fileResources = this.extractResourcesFromHCL(parsedContent, filePath, resourceTypes);
          resources.push(...fileResources);
          
          // If HCL parser found resources, skip the regex fallback
          if (fileResources.length > 0) {
            continue;
          }
          
        } catch (hclError) {
          console.warn(`HCL parser error for ${filePath}, trying regex fallback:`, hclError);
        }
        
        // Fallback to regex-based parsing if HCL parser fails or finds no resources
        const regexResources = this.extractResourcesWithRegex(content, filePath, resourceTypes);
        resources.push(...regexResources);
        
      } catch (error) {
        console.warn(`Error processing file ${filePath}:`, error);
        // Continue with other files even if one fails
      }
    }

    
    // Apply configuration filters
    const filteredResources = this.filterResources(resources, config);
    
    return filteredResources;
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
    
    // Handle managed resources (newer parser format)
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
    
    // Handle "resource" block format (common in Terraform files)
    if (parsedHCL.resource) {
      const resourceBlocks = parsedHCL.resource;
      
      if (resourceBlocks && typeof resourceBlocks === 'object') {
        for (const [resourceType, instances] of Object.entries(resourceBlocks)) {
          
          // Skip if not in our resource types list
          if (!resourceTypes.includes(resourceType)) {
            continue;
          }
          
          // Handle both array and object formats
          if (Array.isArray(instances)) {
            instances.forEach((instance, index) => {
              for (const [resourceName, resourceData] of Object.entries(instance)) {
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
            });
          } else if (typeof instances === 'object') {
            for (const [resourceName, resourceData] of Object.entries(instances)) {
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
    }
    
    // Handle direct resource types at the root level (old format)
    for (const [key, value] of Object.entries(parsedHCL)) {
      if (key !== 'managed_resources' && 
          key !== 'resource' && 
          resourceTypes.includes(key) && 
          value && typeof value === 'object') {
            
        
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
   * Extract resources using regex as a fallback when HCL parser fails
   * @param content The file content
   * @param filePath Source file path
   * @param resourceTypes Resource types to include
   * @returns Array of resources
   */
  private extractResourcesWithRegex(
    content: string,
    filePath: string,
    resourceTypes: string[]
  ): TerraformResource[] {
    const resources: TerraformResource[] = [];
    
    // Match "resource" blocks: resource "type" "name" { ... }
    // This handles the most common Terraform resource syntax
    const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s+{([^}]*)}/gs;
    let match;
    
    
    while ((match = resourceRegex.exec(content)) !== null) {
      const resourceType = match[1];
      const resourceName = match[2];
      const resourceBody = match[3];
      
      // Check if this resource type is in our config
      if (!resourceTypes.includes(resourceType)) {
        continue;
      }
      
      
      // Extract attributes using regex
      const attributes = this.extractAttributesWithRegex(resourceBody);
      
      // Create resource
      const resource: TerraformResource = {
        type: resourceType,
        name: resourceName,
        attributes: attributes,
        dependencies: this.extractDependenciesWithRegex(resourceBody),
        sourceFile: filePath,
        id: `${resourceType}.${resourceName}`
      };
      
      resources.push(resource);
    }
    
    return resources;
  }
  
  /**
   * Extract attributes from resource body using regex
   * @param resourceBody The resource body content
   * @returns Attribute map
   */
  private extractAttributesWithRegex(resourceBody: string): { [key: string]: any } {
    const attributes: { [key: string]: any } = {};
    
    // Match attributes in the form: key = value
    // This handles simple attribute assignments
    const attrRegex = /([a-zA-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([a-zA-Z0-9_\.]+))/g;
    let match;
    
    while ((match = attrRegex.exec(resourceBody)) !== null) {
      const key = match[1];
      // Get value from any of the capture groups
      const value = match[2] || match[3] || match[4];
      
      if (key && value !== undefined) {
        attributes[key] = value;
      }
    }
    
    // Also look for tags
    const tagsRegex = /tags\s*=\s*{([^}]*)}/g;
    let tagsMatch;
    
    while ((tagsMatch = tagsRegex.exec(resourceBody)) !== null) {
      const tagsBody = tagsMatch[1];
      const tagAttrRegex = /([a-zA-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([a-zA-Z0-9_\.]+))/g;
      let tagMatch;
      
      while ((tagMatch = tagAttrRegex.exec(tagsBody)) !== null) {
        const tagKey = tagMatch[1];
        const tagValue = tagMatch[2] || tagMatch[3] || tagMatch[4];
        
        if (tagKey && tagValue !== undefined) {
          attributes[`tags.${tagKey}`] = tagValue;
        }
      }
    }
    
    return attributes;
  }
  
  /**
   * Extract dependencies from resource body using regex
   * @param resourceBody The resource body content
   * @returns Array of dependency IDs
   */
  private extractDependenciesWithRegex(resourceBody: string): string[] {
    const dependencies: Set<string> = new Set();
    
    // Match references like aws_vpc.main.id
    const refRegex = /\${?\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)(?:\.[a-zA-Z0-9_]+)?\s*}?/g;
    let match;
    
    while ((match = refRegex.exec(resourceBody)) !== null) {
      const resourceType = match[1];
      const resourceName = match[2];
      
      if (resourceType && resourceName && !resourceType.startsWith('var.')) {
        dependencies.add(`${resourceType}.${resourceName}`);
      }
    }
    
    return Array.from(dependencies);
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
    
    // Track resources by type for diagnostics
    const resourcesByType: { [type: string]: number } = {};
    const filteredOutByType: { [type: string]: number } = {};
    
    resources.forEach(r => {
      resourcesByType[r.type] = (resourcesByType[r.type] || 0) + 1;
    });
    
    
    const filtered = resources.filter(resource => {
      // Find the matching resource mapping
      const mapping = config.resourceMappings.find(m => m.terraformType === resource.type);
      
      if (!mapping) {
        // No mapping for this resource type
        filteredOutByType[resource.type] = (filteredOutByType[resource.type] || 0) + 1;
        return false;
      }
      
      // Apply include pattern if specified
      if (mapping.includePattern) {
        const includeRegex = new RegExp(mapping.includePattern);
        if (!includeRegex.test(resource.name)) {
          filteredOutByType[resource.type] = (filteredOutByType[resource.type] || 0) + 1;
          return false;
        }
      }
      
      // Apply exclude pattern if specified
      if (mapping.excludePattern) {
        const excludeRegex = new RegExp(mapping.excludePattern);
        if (excludeRegex.test(resource.name)) {
          filteredOutByType[resource.type] = (filteredOutByType[resource.type] || 0) + 1;
          return false;
        }
      }
      
      // Resource passed all filters
      return true;
    });
    
    if (filtered.length === 0 && resources.length > 0) {
    }
    
    return filtered;
  }
}