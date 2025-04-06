import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TerraformTreeProvider } from "./providers/TerraformTreeProvider";
import { DiagramEditorProvider } from "./providers/DiagramEditorProvider";
import { TerraformDependencyDecorationProvider } from './providers/TerraformDependencyDecorationProvider';
import { ResourceMappingConfigManager } from './config/ResourceMappingConfig';
import { TerraformResourceParser } from './parsers/TerraformResourceParser';
import { TerraformToDiagramConverter } from './converters/TerraformToDiagramConverter';
import { TerraformParser } from './parsers/TerraformParser';

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
  
  // Register resource mapping config commands
  ResourceMappingConfigManager.registerCommands(context);
  
  // Register create diagram from selected file command
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.createDiagramFromSelected', async () => {
      // Get the selected item from the TreeView directly
      const selectedItems = treeView.selection;
      const selectedFile = selectedItems.length > 0 && selectedItems[0].resourceUri ? 
                           selectedItems[0].resourceUri : undefined;
      
      if (selectedFile) {
        try {
          // Show progress indicator
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating diagram from Terraform resources',
            cancellable: false
          }, async (progress) => {
            // Update progress
            progress.report({ increment: 0, message: 'Loading resource mapping configuration...' });
            
            // Load resource mapping config
            const config = await ResourceMappingConfigManager.loadConfig();
            
            // Update progress
            progress.report({ increment: 30, message: 'Parsing Terraform resources...' });
            
            // Parse resources from selected file and dependencies
            const resourceParser = new TerraformResourceParser();
            const resources = await resourceParser.parseResourcesFromFile(selectedFile.fsPath, config);
            
            if (resources.length === 0) {
              // Provide options to troubleshoot
              const action = await vscode.window.showErrorMessage(
                'No matching resources found. Check your resource mapping configuration.',
                'Run Diagnostics',
                'Edit Config',
                'Cancel'
              );
              
              if (action === 'Run Diagnostics') {
                if (selectedFile) {
                  await vscode.commands.executeCommand('extension-test.runTerraformDiagnostics', selectedFile);
                } else {
                  vscode.window.showErrorMessage('No file selected for diagnostics');
                }
                return;
              } else if (action === 'Edit Config') {
                await vscode.commands.executeCommand('extension-test.editResourceMappingConfig');
                return;
              }
              
              return;
            }
            
            // Update progress
            progress.report({ increment: 30, message: 'Converting to diagram components...' });
            
            // Convert resources to diagram
            const converter = new TerraformToDiagramConverter(resources, config);
            const diagram = converter.convert(path.basename(selectedFile.fsPath));
            
            // Update progress
            progress.report({ increment: 30, message: 'Creating diagram file...' });
            
            // Create a new diagram file
            const baseFileName = path.basename(selectedFile.fsPath, '.tf');
            const diagramFileName = `${baseFileName}.diagram`;
            
            // Get current workspace folder
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(selectedFile);
            if (!workspaceFolder) {
              throw new Error('No workspace folder available');
            }
            
            // Create diagram file path
            const diagramFilePath = path.join(workspaceFolder.uri.fsPath, diagramFileName);
            
            // Write diagram data to file
            fs.writeFileSync(diagramFilePath, JSON.stringify(diagram.toJSON(), null, 2), 'utf8');
            
            // Open the diagram with our custom editor
            const diagramUri = vscode.Uri.file(diagramFilePath);
            await vscode.commands.executeCommand('vscode.openWith', diagramUri, 'extension-test.diagramEditor');
            
            // Show success message
            progress.report({ increment: 10, message: 'Done!' });
            
            vscode.window.showInformationMessage(
              `Diagram created with ${resources.length} resources`
            );
          });
        } catch (error) {
          console.error('Error creating diagram:', error);
          vscode.window.showErrorMessage(`Error creating diagram: ${error}`);
        }
      } else {
        vscode.window.showInformationMessage('Please select a Terraform file first');
      }
    })
  );
  
  // Register diagnostic command for Terraform resource parsing
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.runTerraformDiagnostics', async (fileUri: vscode.Uri) => {
      try {
        if (!fileUri) {
          // If no file provided, get from selection
          const selectedItems = treeView.selection;
          let fileUri: vscode.Uri = selectedItems.length > 0 && selectedItems[0].resourceUri ? 
                         selectedItems[0].resourceUri : vscode.Uri.parse('file:///');
          
          if (!fileUri) {
            vscode.window.showInformationMessage('Please select a Terraform file first');
            return;
          }
        }
        
        // Create output channel for diagnostics
        const outputChannel = vscode.window.createOutputChannel('Terraform Resource Diagnostics');
        outputChannel.clear();
        outputChannel.show();
        
        outputChannel.appendLine(`Running diagnostics on: ${fileUri.fsPath}`);
        outputChannel.appendLine('--------------------------------------------------------------');
        
        // Create a console.log override to redirect to output channel
        const originalConsoleLog = console.log;
        const originalConsoleWarn = console.warn;
        const originalConsoleError = console.error;
        
        console.log = (...args) => {
          outputChannel.appendLine(args.map(a => String(a)).join(' '));
          originalConsoleLog(...args);
        };
        
        console.warn = (...args) => {
          outputChannel.appendLine('WARNING: ' + args.map(a => String(a)).join(' '));
          originalConsoleWarn(...args);
        };
        
        console.error = (...args) => {
          outputChannel.appendLine('ERROR: ' + args.map(a => String(a)).join(' '));
          originalConsoleError(...args);
        };
        
        try {
          // Step 1: Check file content
          outputChannel.appendLine('\n--- Step 1: Checking file content ---');
          const fileContent = fs.readFileSync(fileUri.fsPath, 'utf8');
          const firstFewLines = fileContent.split('\n').slice(0, 10).join('\n');
          outputChannel.appendLine('First 10 lines of file:');
          outputChannel.appendLine(firstFewLines);
          outputChannel.appendLine('...');
          
          // Step 2: List dependencies
          outputChannel.appendLine('\n--- Step 2: Listing dependencies ---');
          const terraformParser = new TerraformParser();
          const dependencies = await terraformParser.getAllDependentFileUris(fileUri.fsPath);
          outputChannel.appendLine(`Found ${dependencies.length} dependent files:`);
          dependencies.forEach((dep: string) => outputChannel.appendLine(`- ${dep}`));
          
          // Step 3: Load config
          outputChannel.appendLine('\n--- Step 3: Loading resource mapping config ---');
          const config = await ResourceMappingConfigManager.loadConfig();
          outputChannel.appendLine(`Config version: ${config.version}`);
          outputChannel.appendLine(`Resource mappings: ${config.resourceMappings.length}`);
          outputChannel.appendLine('Resource types in config:');
          config.resourceMappings.forEach(mapping => {
            outputChannel.appendLine(`- ${mapping.terraformType} → ${mapping.componentType}`);
          });
          
          // Step 4: Parse resources
          outputChannel.appendLine('\n--- Step 4: Parsing resources ---');
          const resourceParser = new TerraformResourceParser();
          const resources = await resourceParser.parseResourcesFromFile(fileUri.fsPath, config);
          
          outputChannel.appendLine(`\nFound ${resources.length} resources after filtering:`);
          resources.forEach(resource => {
            outputChannel.appendLine(`- ${resource.id} (from ${path.basename(resource.sourceFile)})`);
            outputChannel.appendLine(`  Attributes: ${JSON.stringify(resource.attributes)}`);
            if (resource.dependencies.length > 0) {
              outputChannel.appendLine(`  Dependencies: ${resource.dependencies.join(', ')}`);
            }
          });
          
          // Step 5: Summary
          outputChannel.appendLine('\n--- Step 5: Diagnostics Summary ---');
          if (resources.length === 0) {
            outputChannel.appendLine('⚠️ No resources were found that match your configuration.');
            outputChannel.appendLine('Recommendations:');
            outputChannel.appendLine('1. Check if your Terraform files contain resources with the types listed in your config');
            outputChannel.appendLine('2. Edit your resource mapping configuration with types that match your Terraform files');
            outputChannel.appendLine('3. Run the "Edit Resource Mapping Configuration" command to adjust your settings');
          } else {
            outputChannel.appendLine('✅ Resources were successfully parsed.');
            outputChannel.appendLine(`Found ${resources.length} resources across ${dependencies.length} files.`);
          }
          
        } finally {
          // Restore console functions
          console.log = originalConsoleLog;
          console.warn = originalConsoleWarn;
          console.error = originalConsoleError;
        }
        
        outputChannel.appendLine('\nDiagnostics complete.');
        
      } catch (error) {
        console.error('Error running Terraform diagnostics:', error);
        vscode.window.showErrorMessage(`Error running diagnostics: ${error}`);
      }
    })
  );
  
  // Register the diagram editor provider
  context.subscriptions.push(
    DiagramEditorProvider.register(context)
  );
  
  // Add command to open resource mapping configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.openResourceMappingConfig', async () => {
      await vscode.commands.executeCommand('extension-test.editResourceMappingConfig');
    })
  );
}

export function deactivate() {}