import * as vscode from 'vscode';
import * as path from 'path';
import { TerraformTreeProvider } from "./providers/TerraformTreeProvider";
import { DiagramEditorProvider } from "./providers/DiagramEditorProvider";
import { TerraformDependencyDecorationProvider } from './providers/TerraformDependencyDecorationProvider';
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
  
  // Register create diagram command (placeholder)
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.createDiagramFromSelected', async () => {
      // Get the selected item from the TreeView directly
      const selectedItems = treeView.selection;
      const selectedFile = selectedItems.length > 0 && selectedItems[0].resourceUri ? 
                           selectedItems[0].resourceUri : undefined;
      
      if (selectedFile) {
        try {
          // Get information about the selected file and its dependencies
          const parser = new TerraformParser();
          const fileInfo = await parser.buildFileDependencyTree(selectedFile.fsPath);
          
          // Create a list of all files and determine the root folder
          const allFiles: string[] = [fileInfo.path];
          const collectFiles = (info: any) => {
            if (info.dependencies) {
              for (const dep of info.dependencies) {
                allFiles.push(dep.path);
                collectFiles(dep);
              }
            }
          };
          collectFiles(fileInfo);
          
          // Determine the common root folder
          let rootFolder = path.dirname(selectedFile.fsPath);
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(selectedFile);
          if (workspaceFolder) {
            rootFolder = workspaceFolder.uri.fsPath;
          }
          
          // Include diagram source info in a context value
          const sourceFilesInfo = {
            rootFolder: rootFolder,
            files: allFiles
          };
          
          console.log("Storing source files info:", sourceFilesInfo);
          
          // Store the source file info for use when the diagram is created
          context.workspaceState.update('diagramSourceFiles', sourceFilesInfo);
          
          // Create and open a new diagram
          await vscode.commands.executeCommand('extension-test.createDiagram');
          
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
  
  // Export YAML command - this will be handled by the editor provider
  // but we register it here to ensure it exists in the command palette
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.exportDiagramToYaml', () => {
      vscode.window.showInformationMessage(
        'Use the "Export YAML" button in the diagram editor to export as YAML'
      );
    })
  );
}

export function deactivate() {}