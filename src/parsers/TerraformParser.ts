import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parse, TerraformConfig, ModuleConfig } from '@evops/hcl-terraform-parser';

export interface ModuleInfo {
    name: string;
    source: string;
    path: string;
    dependencies: ModuleInfo[];
}

export class TerraformParser {
    async parseFile(filePath: string): Promise<ModuleInfo[]> {
        try {
            // Read the file content
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Parse the HCL content
            const parsedContent: TerraformConfig = parse(content);
            
            // Extract modules
            const modules: ModuleInfo[] = [];
            
            if (parsedContent.module) {
                for (const [moduleName, moduleConfig] of Object.entries(parsedContent.module)) {
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
                    } else if (moduleConfig && typeof moduleConfig === 'object') {
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
            
            return modules;
        } catch (error) {
            console.error(`Error parsing Terraform file ${filePath}:`, error);
            return [];
        }
    }
    
    async buildDependencyTree(rootFilePath: string): Promise<ModuleInfo> {
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
    
    private async processModuleFile(
        parentModule: ModuleInfo,
        filePath: string,
        basePath: string,
        visitedPaths: Set<string>
    ): Promise<void> {
        // Avoid circular dependencies
        if (visitedPaths.has(filePath)) {
            console.log(`Circular dependency detected: ${filePath}`);
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
    
    private resolveModulePath(source: string, basePath: string): string | null {
        // Handle local file paths
        if (source.startsWith('./') || source.startsWith('../') || path.isAbsolute(source) || !source.includes('://')) {
            try {
                // First, try to resolve as a direct file path
                let resolvedPath = path.resolve(basePath, source);
                
                // If it's a directory, look for main.tf
                if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
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
                }
                
                // If it's not a directory, or no .tf files were found, try adding .tf extension
                if (!resolvedPath.endsWith('.tf')) {
                    resolvedPath = `${resolvedPath}.tf`;
                }
                
                if (fs.existsSync(resolvedPath)) {
                    return resolvedPath;
                }
            } catch (error) {
                console.error(`Error resolving module path ${source}:`, error);
            }
        }
        
        // For remote sources (GitHub, Terraform Registry, etc.), return null
        // We can't resolve these locally
        console.log(`Unable to resolve module path for source: ${source}`);
        return null;
    }
    
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