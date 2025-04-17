// src/utils/TerraformDiagnosticsUtils.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TerraformParser, FileInfo } from '../parsers/TerraformParser';
import { TerraformResourceParser } from '../parsers/TerraformResourceParser';
import { ResourceMappingConfig, ResourceMappingConfigManager, ResourceMapping } from '../config/ResourceMappingConfig';

/**
 * Represents a Terraform resource
 */
export interface TerraformResource {
    type: string;
    name: string;
    config: Record<string, any>;
}

/**
 * Generate a tree representation of the directory structure and terraform files
 * @param dirUri The directory URI to analyze
 * @param output The output channel to write to
 * @param parser The TerraformParser instance
 * @param shouldFilter Whether to filter resources based on config
 */
export async function generateDependencyTree(
    dirUri: vscode.Uri, 
    output: vscode.OutputChannel,
    parser: TerraformParser,
    shouldFilter: boolean = true
): Promise<void> {
    // Get all entries in the directory
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    
    // Sort entries: directories first, then files
    const sortedEntries = entries.sort((a, b) => {
        // First sort by type (directories first)
        if (a[1] !== b[1]) {
            return a[1] === vscode.FileType.Directory ? -1 : 1;
        }
        // Then sort alphabetically
        return a[0].localeCompare(b[0]);
    });
    
    // Display the root directory name
    const dirName = path.basename(dirUri.fsPath);
    output.appendLine(dirName);
    
    // Process each entry
    for (let i = 0; i < sortedEntries.length; i++) {
        const [name, type] = sortedEntries[i];
        const isLast = i === sortedEntries.length - 1;
        const itemPrefix = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';
        
        const itemUri = vscode.Uri.joinPath(dirUri, name);
        
        if (type === vscode.FileType.Directory) {
            // Handle directories
            output.appendLine(`${itemPrefix}${name}`);
            
            // Recursively process subdirectory
            await generateDirectoryTree(itemUri, output, childPrefix, parser, shouldFilter);
        } else if (type === vscode.FileType.File && name.endsWith('.tf')) {
            // Handle Terraform files
            output.appendLine(`${itemPrefix}${name}`);
            
            try {
                const fileInfo = await parser.buildFileDependencyTree(itemUri.fsPath);
                
                // Display file resources
                await displayFileResources(itemUri.fsPath, output, childPrefix, shouldFilter);
                
                // Display file dependencies
                if (fileInfo.dependencies && fileInfo.dependencies.length > 0) {
                    for (let j = 0; j < fileInfo.dependencies.length; j++) {
                        const dep = fileInfo.dependencies[j];
                        const depIsLast = j === fileInfo.dependencies.length - 1;
                        const depPrefix = depIsLast ? `${childPrefix}└── ` : `${childPrefix}├── `;
                        
                        if (dep.isModule && dep.moduleName) {
                            // Display module folder name
                            output.appendLine(`${depPrefix}${dep.moduleName}`);
                            
                            // Path to module directory
                            const moduleDirPath = path.dirname(dep.path);
                            const modulePrefix = childPrefix + (depIsLast ? '    ' : '│   ');
                            
                            // List common terraform files in the module directory
                            const commonFiles = ['variables.tf', 'main.tf', 'outputs.tf'];
                            const foundCommonFiles = [];
                            
                            // Check if these files exist
                            for (const fileName of commonFiles) {
                                const filePath = path.join(moduleDirPath, fileName);
                                if (fs.existsSync(filePath)) {
                                    foundCommonFiles.push(fileName);
                                }
                            }
                            
                            // Display common files
                            for (let k = 0; k < foundCommonFiles.length; k++) {
                                const commonFileName = foundCommonFiles[k];
                                const fileIsLast = k === foundCommonFiles.length - 1 && 
                                                (!dep.dependencies || dep.dependencies.length === 0);
                                const filePrefix = `${modulePrefix}${fileIsLast ? '└── ' : '├── '}`;
                                output.appendLine(`${filePrefix}${commonFileName}`);
                                
                                // Display resources for this file
                                const filePath = path.join(moduleDirPath, commonFileName);
                                if (fs.existsSync(filePath)) {
                                    const fileResourcePrefix = modulePrefix + (fileIsLast ? '    ' : '│   ');
                                    await displayFileResources(filePath, output, fileResourcePrefix, shouldFilter);
                                }
                            }
                            
                            // List any sub-modules if they exist
                            if (dep.dependencies && dep.dependencies.length > 0) {
                                const submoduleDirName = 'modules';
                                const submoduleIsLast = true;
                                const submodulePrefix = `${modulePrefix}${submoduleIsLast ? '└── ' : '├── '}`;
                                output.appendLine(`${submodulePrefix}${submoduleDirName}`);
                                
                                const submoduleNestedPrefix = modulePrefix + (submoduleIsLast ? '    ' : '│   ');
                                
                                // Display each sub-module
                                for (let k = 0; k < dep.dependencies.length; k++) {
                                    const submodule = dep.dependencies[k];
                                    const subIsLast = k === dep.dependencies.length - 1;
                                    const subPrefix = `${submoduleNestedPrefix}${subIsLast ? '└── ' : '├── '}`;
                                    
                                    if (submodule.isModule) {
                                        output.appendLine(`${subPrefix}${submodule.name}`);
                                        
                                        // For sub-modules, display their common files too
                                        const subModuleDirPath = path.dirname(submodule.path);
                                        const subModuleNestedPrefix = submoduleNestedPrefix + (subIsLast ? '    ' : '│   ');
                                        
                                        // Check for common files in the sub-module
                                        const subFoundCommonFiles = [];
                                        for (const fileName of commonFiles) {
                                            const filePath = path.join(subModuleDirPath, fileName);
                                            if (fs.existsSync(filePath)) {
                                                subFoundCommonFiles.push(fileName);
                                            }
                                        }
                                        
                                        // Display common files for sub-module
                                        for (let l = 0; l < subFoundCommonFiles.length; l++) {
                                            const commonFileName = subFoundCommonFiles[l];
                                            const fileIsLast = l === subFoundCommonFiles.length - 1;
                                            const filePrefix = `${subModuleNestedPrefix}${fileIsLast ? '└── ' : '├── '}`;
                                            output.appendLine(`${filePrefix}${commonFileName}`);
                                            
                                            // Display resources for this sub-module file
                                            const filePath = path.join(subModuleDirPath, commonFileName);
                                            if (fs.existsSync(filePath)) {
                                                const fileResourcePrefix = subModuleNestedPrefix + (fileIsLast ? '    ' : '│   ');
                                                await displayFileResources(filePath, output, fileResourcePrefix, shouldFilter);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing file ${itemUri.fsPath}:`, error);
            }
        }
    }
}

/**
 * Recursively generate a tree representation of a directory
 * @param dirUri The directory URI to analyze
 * @param output The output channel to write to
 * @param prefix The prefix for indentation and tree structure
 * @param parser The TerraformParser instance
 * @param shouldFilter Whether to filter resources based on config
 */
export async function generateDirectoryTree(
    dirUri: vscode.Uri, 
    output: vscode.OutputChannel,
    prefix: string,
    parser: TerraformParser,
    shouldFilter: boolean = true
): Promise<void> {
    // Get all entries in the directory
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    
    // Sort entries: directories first, then files
    const sortedEntries = entries.sort((a, b) => {
        // First sort by type (directories first)
        if (a[1] !== b[1]) {
            return a[1] === vscode.FileType.Directory ? -1 : 1;
        }
        // Then sort alphabetically
        return a[0].localeCompare(b[0]);
    });
    
    // Process each entry
    for (let i = 0; i < sortedEntries.length; i++) {
        const [name, type] = sortedEntries[i];
        const isLast = i === sortedEntries.length - 1;
        const itemPrefix = isLast ? `${prefix}└── ` : `${prefix}├── `;
        const childPrefix = isLast ? `${prefix}    ` : `${prefix}│   `;
        
        const itemUri = vscode.Uri.joinPath(dirUri, name);
        
        if (type === vscode.FileType.Directory) {
            // Handle directories
            output.appendLine(`${itemPrefix}${name}`);
            
            // Recursively process subdirectory
            await generateDirectoryTree(itemUri, output, childPrefix, parser, shouldFilter);
        } else if (type === vscode.FileType.File && name.endsWith('.tf')) {
            // Handle Terraform files - just show the filename
            output.appendLine(`${itemPrefix}${name}`);
        }
    }
}

/**
 * Display a file and its dependencies as a tree
 * @param fileInfo The file information
 * @param output The output channel to write to
 * @param prefix The prefix for indentation and tree structure
 * @param isLast Whether this is the last item in its parent list
 * @param parser The TerraformParser instance
 * @param shouldFilter Whether to filter resources based on config
 */
export async function displayFileDependencyTree(
    fileInfo: FileInfo,
    output: vscode.OutputChannel,
    prefix: string,
    isLast: boolean,
    parser: TerraformParser,
    shouldFilter: boolean = true
): Promise<void> {
    // Determine prefixes
    const itemPrefix = prefix + (isLast ? '└── ' : '├── ');
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    
    // Display the file
    output.appendLine(`${itemPrefix}${fileInfo.name}`);
    
    try {
        // Parse resources in this file and display them
        await displayFileResources(fileInfo.path, output, childPrefix, shouldFilter);
        
        // Process and display dependencies
        if (fileInfo.dependencies && fileInfo.dependencies.length > 0) {
            for (let i = 0; i < fileInfo.dependencies.length; i++) {
                const dependency = fileInfo.dependencies[i];
                const depIsLast = i === fileInfo.dependencies.length - 1;
                
                // Special handling for modules - display their file structure
                if (dependency.isModule && dependency.moduleName) {
                    // Create a module folder entry
                    const modulePrefix = `${childPrefix}${depIsLast ? '└── ' : '├── '}`;
                    const moduleFolderName = dependency.moduleName;
                    output.appendLine(`${modulePrefix}${moduleFolderName}`);
                    
                    // Path to module directory
                    const moduleDirPath = path.dirname(dependency.path);
                    const moduleNestedPrefix = childPrefix + (depIsLast ? '    ' : '│   ');
                    
                    // List common terraform files in the module directory
                    const commonFiles = ['variables.tf', 'main.tf', 'outputs.tf'];
                    const foundCommonFiles = [];
                    
                    // Check if these files exist
                    for (const fileName of commonFiles) {
                        const filePath = path.join(moduleDirPath, fileName);
                        if (fs.existsSync(filePath)) {
                            foundCommonFiles.push(filePath);
                        }
                    }
                    
                    // Display common files
                    for (let k = 0; k < foundCommonFiles.length; k++) {
                        const filePath = foundCommonFiles[k];
                        const fileName = path.basename(filePath);
                        const fileIsLast = k === foundCommonFiles.length - 1 && 
                                          (!dependency.dependencies || dependency.dependencies.length === 0);
                        const filePrefix = `${moduleNestedPrefix}${fileIsLast ? '└── ' : '├── '}`;
                        output.appendLine(`${filePrefix}${fileName}`);
                        
                        // Parse and display resources for this module file
                        const fileResourcePrefix = `${moduleNestedPrefix}${fileIsLast ? '    ' : '│   '}`;
                        await displayFileResources(filePath, output, fileResourcePrefix, shouldFilter);
                    }
                    
                    // List any sub-modules if they exist
                    if (dependency.dependencies && dependency.dependencies.length > 0) {
                        const submoduleDirName = 'modules';
                        const submoduleIsLast = true;
                        const submodulePrefix = `${moduleNestedPrefix}${submoduleIsLast ? '└── ' : '├── '}`;
                        output.appendLine(`${submodulePrefix}${submoduleDirName}`);
                        
                        const submoduleNestedPrefix = moduleNestedPrefix + (submoduleIsLast ? '    ' : '│   ');
                        
                        // Display each sub-module
                        for (let k = 0; k < dependency.dependencies.length; k++) {
                            const submodule = dependency.dependencies[k];
                            const subIsLast = k === dependency.dependencies.length - 1;
                            const subPrefix = `${submoduleNestedPrefix}${subIsLast ? '└── ' : '├── '}`;
                            
                            if (submodule.isModule) {
                                output.appendLine(`${subPrefix}${submodule.name}`);
                                
                                // For sub-modules, display their common files too
                                const subModuleDirPath = path.dirname(submodule.path);
                                const subModuleNestedPrefix = submoduleNestedPrefix + (subIsLast ? '    ' : '│   ');
                                
                                // Check for common files in the sub-module
                                const subFoundCommonFiles = [];
                                for (const fileName of commonFiles) {
                                    const filePath = path.join(subModuleDirPath, fileName);
                                    if (fs.existsSync(filePath)) {
                                        subFoundCommonFiles.push(filePath);
                                    }
                                }
                                
                                // Display common files for sub-module
                                for (let l = 0; l < subFoundCommonFiles.length; l++) {
                                    const filePath = subFoundCommonFiles[l];
                                    const fileName = path.basename(filePath);
                                    const fileIsLast = l === subFoundCommonFiles.length - 1;
                                    const filePrefix = `${subModuleNestedPrefix}${fileIsLast ? '└── ' : '├── '}`;
                                    output.appendLine(`${filePrefix}${fileName}`);
                                    
                                    // Parse and display resources for this sub-module file
                                    const fileResourcePrefix = `${subModuleNestedPrefix}${fileIsLast ? '    ' : '│   '}`;
                                    await displayFileResources(filePath, output, fileResourcePrefix, shouldFilter);
                                }
                            }
                        }
                    }
                } else {
                    // Regular file dependency - handle normal files that aren't modules
                    await displayFileDependencyTree(
                        dependency,
                        output,
                        childPrefix,
                        depIsLast,
                        parser,
                        shouldFilter
                    );
                }
            }
        }
    } catch (error) {
        console.error(`Error processing file dependencies for ${fileInfo.path}:`, error);
    }
}

/**
 * Parse and display Terraform resources in a file
 * @param filePath Path to the Terraform file
 * @param output Output channel to write to
 * @param prefix Prefix for indentation and tree structure
 * @param shouldFilter Whether to filter resources based on config
 */
async function displayFileResources(
    filePath: string,
    output: vscode.OutputChannel,
    prefix: string,
    shouldFilter: boolean = true
): Promise<void> {
    try {
        // Extract resources from the file
        const allResources = await extractTerraformResources(filePath);
        
        let resourcesToDisplay = allResources;
        
        // Filter resources if requested
        if (shouldFilter) {
            // Load resource mapping config
            const config = await ResourceMappingConfigManager.loadConfig();
            
            // Get allowed resource types from config
            const allowedResourceTypes = config.resourceMappings.map(mapping => mapping.terraformType);
            
            // Filter resources based on config
            resourcesToDisplay = allResources.filter(resource => {
                // Check if resource type is in the allowed list
                const isAllowedType = allowedResourceTypes.includes(resource.type);
                
                // Find the resource mapping for this type
                const resourceMapping = config.resourceMappings.find(mapping => 
                    mapping.terraformType === resource.type
                );
                
                if (!resourceMapping) {
                    return false; // Skip if resource type not in config
                }
                
                // Check include/exclude patterns if specified
                if (resourceMapping.includePattern) {
                    const includeRegex = new RegExp(resourceMapping.includePattern);
                    if (!includeRegex.test(resource.name)) {
                        return false; // Skip if doesn't match include pattern
                    }
                }
                
                if (resourceMapping.excludePattern) {
                    const excludeRegex = new RegExp(resourceMapping.excludePattern);
                    if (excludeRegex.test(resource.name)) {
                        return false; // Skip if matches exclude pattern
                    }
                }
                
                return isAllowedType;
            });
        }
        
        if (resourcesToDisplay.length > 0) {
            const resourcePrefix = `${prefix}├── Resources:`;
            output.appendLine(resourcePrefix);
            
            // Display each resource
            for (let i = 0; i < resourcesToDisplay.length; i++) {
                const resource = resourcesToDisplay[i];
                const isLastResource = i === resourcesToDisplay.length - 1;
                const resourceItemPrefix = `${prefix}${isLastResource ? '    └── ' : '    ├── '}`;
                output.appendLine(`${resourceItemPrefix}${resource.type}.${resource.name}`);
            }
        }
    } catch (error) {
        console.error(`Error displaying resources for ${filePath}:`, error);
    }
}

/**
 * Extract Terraform resources from a file
 * @param filePath Path to the file
 * @returns Array of resources
 */
export async function extractTerraformResources(filePath: string): Promise<TerraformResource[]> {
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Try using the HCL parser
    try {
        // Use @evops/hcl-terraform-parser
        const { parse } = require('@evops/hcl-terraform-parser');
        const parsed = parse(content);
        
        const resources: TerraformResource[] = [];
        
        // Check if we have managed_resources in the parsed output
        if (parsed.managed_resources) {
            // Process managed resources
            for (const [key, value] of Object.entries(parsed.managed_resources)) {
                // Key should be in format "type.name"
                const parts = key.split('.');
                if (parts.length >= 2) {
                    const type = parts[0];
                    const name = parts[1];
                    
                    resources.push({
                        type,
                        name,
                        config: value as Record<string, any>
                    });
                }
            }
        }
        
        // Also check for resource blocks directly (older format)
        if (parsed.resource && typeof parsed.resource === 'object') {
            for (const [resourceType, resourceInstances] of Object.entries(parsed.resource)) {
                if (typeof resourceInstances === 'object') {
                    for (const [resourceName, resourceConfig] of Object.entries(resourceInstances as Record<string, any>)) {
                        resources.push({
                            type: resourceType,
                            name: resourceName,
                            config: resourceConfig || {}
                        });
                    }
                }
            }
        }
        
        return resources;
    } catch (error) {
        console.error('HCL parser failed, falling back to regex-based parser:', error);
        
        // Fallback to regex-based parsing
        const resources: TerraformResource[] = [];
        const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s+{/g;
        
        let match;
        while ((match = resourceRegex.exec(content)) !== null) {
            resources.push({
                type: match[1],
                name: match[2],
                config: {} // Simple fallback doesn't parse properties
            });
        }
        
        return resources;
    }
}

/**
 * Display the list of available resource mappings from the configuration
 * @param output The output channel to write to
 */
export async function displayResourceMappings(output: vscode.OutputChannel): Promise<void> {
    try {
        // Load the resource mapping config
        const config = await ResourceMappingConfigManager.loadConfig();
        
        // Sort resource mappings by type for easier reading
        const sortedMappings = [...config.resourceMappings].sort((a, b) => 
            a.terraformType.localeCompare(b.terraformType)
        );
        
        if (sortedMappings.length === 0) {
            output.appendLine('\nNo resource mappings defined in configuration.');
            return;
        }
        
        // Calculate column widths for better alignment
        const terraformTypeWidth = Math.max(
            ...sortedMappings.map(m => m.terraformType.length),
            "Terraform Resource Type".length
        );
        const componentTypeWidth = Math.max(
            ...sortedMappings.map(m => m.componentType.length),
            "Component Type".length
        );
        
        // Display header
        output.appendLine('\nAvailable Resource Mappings:');
        
        // Table header
        const headerLine = 
            `| ${"Terraform Resource Type".padEnd(terraformTypeWidth)} | ` +
            `${"Component Type".padEnd(componentTypeWidth)} |`;
        output.appendLine(headerLine);
        
        // Table divider
        const dividerLine = 
            `| ${"-".repeat(terraformTypeWidth)} | ` +
            `${"-".repeat(componentTypeWidth)} |`;
        output.appendLine(dividerLine);
        
        // Table content
        for (const mapping of sortedMappings) {
            const line = 
                `| ${mapping.terraformType.padEnd(terraformTypeWidth)} | ` +
                `${mapping.componentType.padEnd(componentTypeWidth)} |`;
            output.appendLine(line);
        }
        
        // End of table
        output.appendLine(dividerLine);
    } catch (error) {
        console.error('Error displaying resource mappings:', error);
        output.appendLine('Error displaying resource mappings');
    }
}