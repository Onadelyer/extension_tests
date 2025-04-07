import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TerraformTreeProvider } from "./providers/TerraformTreeProvider";
import { TerraformDependencyDecorationProvider } from './providers/TerraformDependencyDecorationProvider';
import { openDiagramPanel } from './panels/DiagramPanel';
import { TerraformParser, FileInfo } from './parsers/TerraformParser';

// Define resource interface for clarity
interface TerraformResource {
  type: string;
  name: string;
  config: Record<string, any>;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, "extension-test" is now active!');

  // Create the decoration provider for highlighting dependencies
  const decorationProvider = new TerraformDependencyDecorationProvider();
  
  // Register the file decoration provider
  const decorationRegistration = vscode.window.registerFileDecorationProvider(decorationProvider);
  context.subscriptions.push(decorationRegistration);

  // Create TreeView provider for Terraform files
  const terraformProvider = new TerraformTreeProvider(context);
  
  // Register the TreeView
  const treeView = vscode.window.createTreeView('extension-test.terraformFiles', {
    treeDataProvider: terraformProvider,
    showCollapseAll: true,
    canSelectMany: false
  });
  context.subscriptions.push(treeView);
  
  // Handle tree view selection change
  context.subscriptions.push(
    treeView.onDidChangeSelection(async e => {
      if (e.selection.length > 0 && e.selection[0].resourceUri) {
        const selectedUri = e.selection[0].resourceUri;
        if (selectedUri.fsPath.endsWith('.tf')) {
          // Update dependency highlighting when a file is selected
          await decorationProvider.setSelectedFile(selectedUri);
        }
      }
    })
  );
  
  // Register file selection command
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.selectTerraformFile', (fileUri: vscode.Uri) => {
      // Also update dependency highlighting when a file is selected via command
      decorationProvider.setSelectedFile(fileUri);
    })
  );
  
  // Register diagram commands 
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.createDiagram', async () => {
      try {        
        // Check if there's a selected file in the tree view
        const selectedItems = treeView.selection;
        let selectedFile = selectedItems.length > 0 && selectedItems[0].resourceUri ? 
                            selectedItems[0].resourceUri : undefined;
        
        // If no file is selected, prompt the user to select one
        if (!selectedFile) {          
          // Find Terraform files in the workspace
          const tfFiles = await vscode.workspace.findFiles('**/*.tf', '**/node_modules/**');
          
          if (tfFiles.length === 0) {
            vscode.window.showInformationMessage('No Terraform files found in the workspace');
            return;
          }
          
          // Create QuickPick items with relative paths for better readability
          const items = await Promise.all(tfFiles.map(async (file) => {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
            const relativePath = workspaceFolder ? 
              path.relative(workspaceFolder.uri.fsPath, file.fsPath) : file.fsPath;
              
            return {
              label: relativePath,
              description: file.fsPath,
              uri: file
            };
          }));
          
          // Show QuickPick to let user select a file
          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a Terraform file to create diagram from'
          });
          
          if (!selected) {
            return; // User cancelled the selection
          }
          
          selectedFile = selected.uri;
        }
        
        if (selectedFile && selectedFile.fsPath.endsWith('.tf')) {
          // Pass the source file to the diagram panel
          openDiagramPanel(context, { source: selectedFile.fsPath });
        } else {
          vscode.window.showInformationMessage('Please select a Terraform file first');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error opening diagram: ${error}`);
      }
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.createDiagramFromSelected', () => {
      try {
        // Get the selected item from the TreeView directly
        const selectedItems = treeView.selection;
        const selectedFile = selectedItems.length > 0 && selectedItems[0].resourceUri ? 
                            selectedItems[0].resourceUri : undefined;
        
        if (selectedFile) {
          // Only pass the source information, don't save to file
          openDiagramPanel(context, { source: selectedFile.fsPath });
        } else {
          vscode.window.showInformationMessage('Please select a Terraform file first');
        }
      } catch (error) {
        console.error('Error creating diagram from selection:', error);
        vscode.window.showErrorMessage(`Error creating diagram: ${error}`);
      }
    })
  );

  // Register the diagnostics command
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.runTerraformDiagnostics', async () => {
      try {
        // Create or get output channel
        const outputChannel = vscode.window.createOutputChannel('Terraform Diagnostics');
        outputChannel.clear();
        outputChannel.show();
        
        // Get the file or directory to analyze
        const activeEditor = vscode.window.activeTextEditor;
        let targetUri: vscode.Uri | undefined;
        
        if (activeEditor && activeEditor.document.languageId === 'terraform') {
          // Use active editor if it's a Terraform file
          targetUri = activeEditor.document.uri;
        } else if (treeView.selection.length > 0 && treeView.selection[0].resourceUri) {
          // Use selected tree item
          targetUri = treeView.selection[0].resourceUri;
        }
        
        if (!targetUri) {
          vscode.window.showWarningMessage('Please select a Terraform file or directory to analyze');
          return;
        }
        
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Running Terraform diagnostics...",
          cancellable: false
        }, async (progress) => {
          try {
            // Get stats for the URI
            const stats = await vscode.workspace.fs.stat(targetUri);
            
            // Array to hold files to analyze
            const filesToAnalyze: vscode.Uri[] = [];
            
            if (stats.type === vscode.FileType.Directory) {
              // If it's a directory, find all .tf files in it
              outputChannel.appendLine(`Analyzing directory: ${targetUri.fsPath}`);
              outputChannel.appendLine('---------------------------------------------------');
              
              // Get all .tf files in the directory
              const dirEntries = await vscode.workspace.fs.readDirectory(targetUri);
              for (const [name, type] of dirEntries) {
                if (type === vscode.FileType.File && name.endsWith('.tf')) {
                  filesToAnalyze.push(vscode.Uri.joinPath(targetUri, name));
                }
              }
              
              if (filesToAnalyze.length === 0) {
                outputChannel.appendLine('No Terraform files found in this directory.');
                return;
              }
              
              outputChannel.appendLine(`Found ${filesToAnalyze.length} Terraform files to analyze.\n`);
            } else if (stats.type === vscode.FileType.File && targetUri.fsPath.endsWith('.tf')) {
              // If it's a Terraform file, analyze just that file
              filesToAnalyze.push(targetUri);
            } else {
              outputChannel.appendLine('Selected item is not a Terraform file or directory.');
              return;
            }
            
            // Use the TerraformParser for analysis
            const parser = new TerraformParser();
            
            // Now analyze each file
            for (let i = 0; i < filesToAnalyze.length; i++) {
              const fileUri = filesToAnalyze[i];
              const fileName = path.basename(fileUri.fsPath);
              
              outputChannel.appendLine(`Analyzing file (${i + 1}/${filesToAnalyze.length}): ${fileName}`);
              outputChannel.appendLine('-'.repeat(fileName.length + 24));
              
              try {
                // Extract resources from the file
                const resources = await extractTerraformResources(fileUri.fsPath);
                
                if (resources.length === 0) {
                  outputChannel.appendLine('  No resources found in this file.\n');
                } else {
                  outputChannel.appendLine(`  Found ${resources.length} resources:\n`);
                  
                  // Display each resource
                  resources.forEach((resource, index) => {
                    outputChannel.appendLine(`  [Resource ${index + 1}] ${resource.type}.${resource.name}`);
                    
                    if (resource.config && Object.keys(resource.config).length > 0) {
                      outputChannel.appendLine('    Configuration:');
                      
                      // Format the configuration properties
                      for (const [key, value] of Object.entries(resource.config)) {
                        if (key !== 'id' && key !== 'path') { // Skip non-user properties
                          const valueStr = typeof value === 'object' 
                            ? JSON.stringify(value, null, 2).replace(/\n/g, '\n      ') 
                            : value;
                          outputChannel.appendLine(`      ${key}: ${valueStr}`);
                        }
                      }
                    }
                    
                    //outputChannel.appendLine(''); // Empty line between resources
                  });
                }
                
                // Try to build file dependency tree
                try {
                  const fileInfo = await parser.buildFileDependencyTree(fileUri.fsPath);
                  
                  if (fileInfo && fileInfo.dependencies && fileInfo.dependencies.length > 0) {
                    outputChannel.appendLine('  Dependencies:');
                    displayDependencies(fileInfo.dependencies, outputChannel, '    ');
                    outputChannel.appendLine('');
                  }
                } catch (error) {
                  console.error('Error building file dependency tree:', error);
                }
              } catch (error) {
                outputChannel.appendLine(`  Error analyzing file: ${error}\n`);
              }
              
              // Update progress
              progress.report({ 
                increment: (100 / filesToAnalyze.length), 
                message: `Analyzed ${i + 1}/${filesToAnalyze.length} files` 
              });
            }
            
            outputChannel.appendLine('===================================================');
            outputChannel.appendLine(`Terraform diagnostics completed for ${filesToAnalyze.length} files.`);
            outputChannel.show(true); // Show and focus
          } catch (error) {
            outputChannel.appendLine(`Error: ${error}`);
            throw error;
          }
        });
      } catch (error) {
        console.error('Error running Terraform diagnostics:', error);
        vscode.window.showErrorMessage(`Error running diagnostics: ${error}`);
      }
    })
  );
}

export function deactivate() {}

/**
 * Extract Terraform resources from a file
 */
async function extractTerraformResources(filePath: string): Promise<TerraformResource[]> {
  // Read the file content
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Try using the HCL parser if available
  try {
    // Attempt to use @evops/hcl-terraform-parser
    const { parse } = require('@evops/hcl-terraform-parser');
    const parsed = parse(content);
    
    const resources: TerraformResource[] = [];
    
    // Check if we have managed_resources in the parsed output (newer parser format)
    if (parsed.managed_resources) {
      // Process managed resources (newer format)
      for (const [resourceType, resourceInstances] of Object.entries(parsed.managed_resources)) {
        for (const [resourceName, resourceConfig] of Object.entries(resourceInstances as Record<string, any>)) {
          resources.push({
            type: resourceType,
            name: resourceName,
            config: resourceConfig || {}
          });
        }
      }
    } else {
      // Process resource blocks directly
      for (const [key, value] of Object.entries(parsed)) {
        if (key === 'resource' && typeof value === 'object') {
          for (const [resourceType, resourceInstances] of Object.entries(value as Record<string, any>)) {
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
 * Display dependencies recursively in the output channel
 */
function displayDependencies(dependencies: FileInfo[], output: vscode.OutputChannel, indent: string): void {
  dependencies.forEach((dep, index) => {
    const prefix = `${indent}[${index + 1}] `;
    output.appendLine(`${prefix}${dep.name}${dep.isModule ? ` (Module: ${dep.moduleName})` : ''}`);
    
    if (dep.dependencies && dep.dependencies.length > 0) {
      displayDependencies(dep.dependencies, output, indent + '  ');
    }
  });
}