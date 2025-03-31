// src/parsers/TerraformParser.ts
// This parser analyzes Terraform files to extract module dependencies and build a dependency tree.
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parse, TerraformConfig, ModuleConfig } from '@evops/hcl-terraform-parser';

/**
 * Represents a Terraform module with its dependencies
 */
export interface ModuleInfo {
    name: string;
    source: string;
    path: string;
    dependencies: ModuleInfo[];
}

/**
 * Parser for Terraform files to extract module dependencies
 */
export class TerraformParser {
    /**
     * Parse a Terraform file and extract module information
     * @param filePath Path to the Terraform file
     * @returns Information about modules in the file
     */
    async parseFile(filePath: string): Promise<ModuleInfo[]> {
        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                return [];
            }
            
            // Read the file content
            const content = fs.readFileSync(filePath, 'utf8');
            
            // First try the HCL parser
            let modules: ModuleInfo[] = [];
            let parserSuccess = false;
            
            try {
                // Parse the HCL content with the library
                const parsedContent: TerraformConfig = parse(content);
                
                // Try to extract modules from the parsed content
                modules = this.extractModulesFromParsedContent(parsedContent, filePath);
                
                if (modules.length > 0) {
                    parserSuccess = true;
                }
            } catch (parseError) {
                // HCL parser failed, will try regex fallback
            }
            
            // If the HCL parser didn't find any modules, try the regex fallback
            if (!parserSuccess) {
                modules = this.parseWithRegex(content, filePath);
            }
            
            return modules;
        } catch (error) {
            console.error(`Error parsing Terraform file ${filePath}:`, error);
            return [];
        }
    }
    
    /**
     * Extract modules from parsed HCL content
     * @param parsedContent Parsed HCL content
     * @param filePath Path to the Terraform file
     * @returns Information about modules in the file
     */
    private extractModulesFromParsedContent(parsedContent: TerraformConfig, filePath: string): ModuleInfo[] {
        const modules: ModuleInfo[] = [];
        
        // Handle both old and new parser formats
        if (parsedContent.module_calls) {
            // New parser format - using module_calls property
            for (const [moduleName, moduleConfig] of Object.entries(parsedContent.module_calls)) {
                // Check if source is available
                if (moduleConfig && typeof moduleConfig === 'object') {
                    const typedConfig = moduleConfig as Record<string, unknown>;
                    if (typedConfig.source && typeof typedConfig.source === 'string') {
                        modules.push({
                            name: moduleName,
                            source: typedConfig.source,
                            path: filePath,
                            dependencies: []
                        });
                    }
                }
            }
        } else if (parsedContent.module) {
            // Old parser format - using module property
            for (const [moduleName, moduleConfig] of Object.entries(parsedContent.module)) {
                // If moduleConfig is available, process it
                if (moduleConfig) {
                    if (Array.isArray(moduleConfig)) {
                        // Handle array of module definitions
                        moduleConfig.forEach((config, index) => {
                            // Type assertion to access properties safely
                            const typedConfig = config as Record<string, unknown>;
                            if (typedConfig.source && typeof typedConfig.source === 'string') {
                                modules.push({
                                    name: `${moduleName}[${index}]`,
                                    source: typedConfig.source,
                                    path: filePath,
                                    dependencies: []
                                });
                            }
                        });
                    } else if (typeof moduleConfig === 'object') {
                        // Handle single module definition
                        // Type assertion to access properties safely
                        const typedConfig = moduleConfig as Record<string, unknown>;
                        if (typedConfig.source && typeof typedConfig.source === 'string') {
                            modules.push({
                                name: moduleName,
                                source: typedConfig.source,
                                path: filePath,
                                dependencies: []
                            });
                        }
                    }
                }
            }
        }
        
        return modules;
    }
    
    /**
     * Parse a Terraform file using a fallback regex approach when the HCL parser fails
     * @param content Terraform file content
     * @returns List of module information
     */
    private parseWithRegex(content: string, filePath: string): ModuleInfo[] {
        const modules: ModuleInfo[] = [];
        
        // Regex to match module blocks: module "name" { ... }
        // This is a simplified approach and might not handle all Terraform syntax correctly
        const moduleRegex = /module\s+"([^"]+)"\s+{([^}]*)}/gs;
        let match;
        
        while ((match = moduleRegex.exec(content)) !== null) {
            const moduleName = match[1];
            const moduleBody = match[2];
            
            // Extract source from module body
            const sourceRegex = /source\s*=\s*"([^"]+)"/;
            const sourceMatch = moduleBody.match(sourceRegex);
            
            if (sourceMatch && sourceMatch[1]) {
                const source = sourceMatch[1];
                
                modules.push({
                    name: moduleName,
                    source: source,
                    path: filePath,
                    dependencies: []
                });
            }
        }
        
        return modules;
    }
    
    /**
     * Build a dependency tree for a Terraform file
     * @param rootFilePath Path to the root Terraform file
     * @returns Root module with dependencies
     */
    async buildDependencyTree(rootFilePath: string): Promise<ModuleInfo> {
        // Verify the file exists
        if (!fs.existsSync(rootFilePath)) {
            throw new Error(`File not found: ${rootFilePath}`);
        }
        
        const rootDir = path.dirname(rootFilePath);
        const rootFileName = path.basename(rootFilePath);
        
        // Create the root module representation
        const rootModule: ModuleInfo = {
            name: rootFileName,
            source: 'root',
            path: rootFilePath,
            dependencies: []
        };
        
        // Track visited modules to avoid circular dependencies
        const visitedPaths = new Set<string>();
        
        // Process the root file
        await this.processModuleFile(rootModule, rootFilePath, rootDir, visitedPaths);
        
        return rootModule;
    }
    
    /**
     * Process a module file to find its dependencies
     * @param parentModule Parent module to add dependencies to
     * @param filePath Path to the module file
     * @param basePath Base path for resolving relative paths
     * @param visitedPaths Set of already visited paths to avoid circular dependencies
     */
    private async processModuleFile(
        parentModule: ModuleInfo,
        filePath: string,
        basePath: string,
        visitedPaths: Set<string>
    ): Promise<void> {
        // Avoid circular dependencies
        if (visitedPaths.has(filePath)) {
            return;
        }
        
        visitedPaths.add(filePath);
        
        try {
            // Parse the file to find modules
            const modules = await this.parseFile(filePath);
            
            // Process each module
            for (const module of modules) {
                // Create module info
                const moduleInfo: ModuleInfo = {
                    name: module.name,
                    source: module.source,
                    path: module.path,
                    dependencies: []
                };
                
                // Add to parent's dependencies
                parentModule.dependencies.push(moduleInfo);
                
                // Resolve the module source to a file path
                const modulePath = this.resolveModulePath(module.source, basePath);
                
                if (modulePath) {
                    // Process the module file to find its dependencies
                    await this.processModuleFile(
                        moduleInfo,
                        modulePath,
                        path.dirname(modulePath),
                        visitedPaths
                    );
                }
            }
        } catch (error) {
            console.error(`Error processing module file ${filePath}:`, error);
        }
    }
    
    /**
     * Resolve a module source to a file system path
     * @param source Module source string
     * @param basePath Base path for relative paths
     * @returns Resolved path or null if not resolvable
     */
    private resolveModulePath(source: string, basePath: string): string | null {
        // Handle local file paths
        if (source.startsWith('./') || source.startsWith('../') || path.isAbsolute(source) || !source.includes('://')) {
            try {
                // First, try to resolve as a direct file path
                let resolvedPath = path.resolve(basePath, source);
                
                // Check if resolved path exists
                if (!fs.existsSync(resolvedPath)) {
                    // Try adding .tf extension
                    if (!resolvedPath.endsWith('.tf')) {
                        const withExtension = `${resolvedPath}.tf`;
                        if (fs.existsSync(withExtension)) {
                            return withExtension;
                        }
                    }
                    
                    return null;
                }
                
                // If it's a directory, look for main.tf
                if (fs.statSync(resolvedPath).isDirectory()) {
                    const mainTfPath = path.join(resolvedPath, 'main.tf');
                    if (fs.existsSync(mainTfPath)) {
                        return mainTfPath;
                    }
                    
                    // If main.tf doesn't exist, use the first .tf file
                    const tfFiles = fs.readdirSync(resolvedPath)
                        .filter(file => file.endsWith('.tf'));
                    
                    if (tfFiles.length > 0) {
                        return path.join(resolvedPath, tfFiles[0]);
                    }
                    
                    return null;
                }
                
                // It's a file, return it directly
                return resolvedPath;
            } catch (error) {
                console.error(`Error resolving module path ${source}:`, error);
                return null;
            }
        }
        
        // For remote sources (GitHub, Terraform Registry, etc.)
        return null;
    }
    
    /**
     * Print a module dependency tree to the console
     * @param module Root module
     * @param indent Indentation string for formatting
     */
    printDependencyTree(module: ModuleInfo, indent: string = ''): void {
        const sourceSummary = module.source === 'root' 
            ? module.path 
            : module.source;
            
        console.log(`${indent}Module: ${module.name} (${sourceSummary})`);
        
        if (module.dependencies.length === 0) {
            console.log(`${indent}  No dependencies`);
        } else {
            console.log(`${indent}  Dependencies:`);
            for (const dependency of module.dependencies) {
                this.printDependencyTree(dependency, `${indent}    `);
            }
        }
    }
}