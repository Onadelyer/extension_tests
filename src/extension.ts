import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TerraformTreeProvider } from "./providers/TerraformTreeProvider";
import { DiagramEditorProvider } from "./providers/DiagramEditorProvider";
import { TerraformDependencyDecorationProvider } from './providers/TerraformDependencyDecorationProvider';
import { ResourceMappingConfigManager } from './config/ResourceMappingConfig';
import { TerraformResourceParser } from './parsers/TerraformResourceParser';
import { TerraformToDiagramConverter } from './converters/TerraformToDiagramConverter';

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
              vscode.window.showInformationMessage(
                'No matching resources found. Check your resource mapping configuration.'
              );
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