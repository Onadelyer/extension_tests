import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TerraformTreeProvider } from "./providers/TerraformTreeProvider";
import { TerraformDependencyDecorationProvider } from './providers/TerraformDependencyDecorationProvider';
import { openDiagramPanel } from './panels/DiagramPanel';
import { TerraformParser, FileInfo } from './parsers/TerraformParser';
import { 
  generateDependencyTree, 
  displayFileDependencyTree, 
  extractTerraformResources,
  displayResourceMappings
} from './utils/TerraformDiagnosticsUtils';
import { ResourceMappingConfigManager } from './config/ResourceMappingConfig';

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
  
  // Register the config manager commands
  ResourceMappingConfigManager.registerCommands(context);
  
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
            // Only show message if user cancelled the selection
            vscode.window.showInformationMessage('Diagram creation cancelled. No file selected.');
            return; // User cancelled the selection
          }
          
          selectedFile = selected.uri;
        }
        
        if (selectedFile && selectedFile.fsPath.endsWith('.tf')) {
          // Pass the source file to the diagram panel
          openDiagramPanel(context, { source: selectedFile.fsPath });
        } else {
          vscode.window.showInformationMessage('Selected file is not a Terraform file. Please select a .tf file.');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error opening diagram: ${error}`);
      }
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.createDiagramFromSelected', async () => {
      try {
        // Get the selected item from the TreeView directly
        const selectedItems = treeView.selection;
        const selectedFile = selectedItems.length > 0 && selectedItems[0].resourceUri ? 
                            selectedItems[0].resourceUri : undefined;
        
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
            vscode.window.showInformationMessage('Diagram creation cancelled. No file selected.');
            return; // User cancelled the selection
          }
          
          const selectedUri = selected.uri;
          
          // Only pass the source information, don't save to file
          openDiagramPanel(context, { source: selectedUri.fsPath });
          return;
        }
        
        // Only pass the source information, don't save to file
        openDiagramPanel(context, { source: selectedFile.fsPath });
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
        
        // Get the file or directory to analyze - check the selection FIRST before showing any other UI
        let targetUri: vscode.Uri | undefined;
        
        // Check if there's a valid selection in the tree view
        const hasSelection = treeView.selection && 
                            treeView.selection.length > 0 && 
                            treeView.selection[0].resourceUri;
        
        // If we have a valid selection, use it directly
        if (hasSelection) {
          targetUri = treeView.selection[0].resourceUri;
          
          // Now show the filter options after setting the target
          const filterOption = await vscode.window.showQuickPick(
            [
              { label: 'Show all resources', value: false },
              { label: 'Filter resources based on configuration', value: true }
            ],
            { placeHolder: 'Select resource display option' }
          );
          
          // Default to filtered if canceled
          const shouldFilter = filterOption ? filterOption.value : true;
          
          // Make sure targetUri is defined
          if (targetUri) {
            // Process the selected file/directory
            await processTerraformDiagnostics(targetUri, outputChannel, shouldFilter, context);
          } else {
            vscode.window.showWarningMessage('Selected item is not valid. Please select a Terraform file or directory.');
          }
        } 
        // Only if no file is selected, show the QuickPick
        else {
          // Find all Terraform files in the workspace
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
            placeHolder: 'Select a Terraform file to analyze'
          });
          
          if (!selected) {
            vscode.window.showInformationMessage('Diagnostics canceled. No file selected.');
            return; // User cancelled the selection
          }
          
          targetUri = selected.uri;
          
          // Now show the filter options after selection
          const filterOption = await vscode.window.showQuickPick(
            [
              { label: 'Show all resources', value: false },
              { label: 'Filter resources based on configuration', value: true }
            ],
            { placeHolder: 'Select resource display option' }
          );
          
          // Default to filtered if canceled
          const shouldFilter = filterOption ? filterOption.value : true;
          
          // Process the selected file/directory
          await processTerraformDiagnostics(targetUri, outputChannel, shouldFilter, context);
        }
      } catch (error) {
        console.error('Error running diagnostics command:', error);
        vscode.window.showErrorMessage(`Error running Terraform diagnostics: ${error}`);
      }
    })
  );

  // Register the "hello world" command
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.helloWorld', () => {
      vscode.window.showInformationMessage('Hello World from extension-test!');
    })
  );
}

export function deactivate() {}

/**
 * Process Terraform diagnostics for the selected file or directory
 * @param targetUri The URI of the file or directory to analyze
 * @param outputChannel The output channel to write to
 * @param shouldFilter Whether to filter resources based on config
 * @param context The extension context
 */
async function processTerraformDiagnostics(
  targetUri: vscode.Uri,
  outputChannel: vscode.OutputChannel,
  shouldFilter: boolean,
  context: vscode.ExtensionContext
): Promise<void> {
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
      
      // Initialize the parser
      const parser = new TerraformParser();
      
      if (stats.type === vscode.FileType.Directory) {
        // If it's a directory, analyze the directory structure
        outputChannel.appendLine(`Terraform Project Structure: ${path.basename(targetUri.fsPath)}`);
        outputChannel.appendLine('');
        
        // Generate the directory tree structure
        await generateDependencyTree(targetUri, outputChannel, parser, shouldFilter);
        
      } else if (stats.type === vscode.FileType.File && targetUri.fsPath.endsWith('.tf')) {
        // If it's a Terraform file, analyze just that file and its dependencies
        const fileName = path.basename(targetUri.fsPath);
        outputChannel.appendLine(`${fileName} file selected`);
        outputChannel.appendLine('');
        
        // Build file dependency tree
        const fileInfo = await parser.buildFileDependencyTree(targetUri.fsPath);
        
        // Display file and its dependencies
        await displayFileDependencyTree(fileInfo, outputChannel, '', true, parser, shouldFilter);
      } else {
        outputChannel.appendLine('Selected item is not a Terraform file or directory.');
        return;
      }
      
      // Display the list of resource mappings from the configuration
      await displayResourceMappings(outputChannel);
      
      outputChannel.appendLine('');
      outputChannel.appendLine('Terraform diagnostics completed.');
      outputChannel.show(true); // Show and focus the output
    } catch (error) {
      console.error('Error during diagnostics:', error);
      outputChannel.appendLine(`Error during diagnostics: ${error}`);
    }
  });
}