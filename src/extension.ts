import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DiagramEditorProvider } from "./providers/DiagramEditorProvider";
import { TerraformTreeProvider } from "./providers/TerraformTreeProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, "extension-test" is now active!');

  // Register the original Hello World command
  const disposable = vscode.commands.registerCommand('extension-test.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from extension_test!');
  });
  context.subscriptions.push(disposable);

  // Create TreeView provider for Terraform files
  const terraformProvider = new TerraformTreeProvider(context);
  
  // Register the TreeView with optimized reveal behavior
  const treeView = vscode.window.createTreeView('extension-test.terraformFiles', {
    treeDataProvider: terraformProvider,
    showCollapseAll: true,
    canSelectMany: false
  });
  context.subscriptions.push(treeView);
  
  // Register file selection command - but we don't need to manually track selection
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.selectTerraformFile', (fileUri: vscode.Uri) => {
      // Selection is handled automatically by TreeView
      // We don't need to do anything here
    })
  );
  
  // Register create diagram command
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.createDiagramFromSelected', async () => {
      // Get the selected item from the TreeView directly
      const selectedItems = treeView.selection;
      const selectedFile = selectedItems.length > 0 && selectedItems[0].resourceUri ? 
                           selectedItems[0].resourceUri : undefined;
      
      if (selectedFile) {
        try {
          // Create a new untitled diagram file
          const fileName = path.basename(selectedFile.fsPath, '.tf');
          
          // Create and open a new diagram
          await vscode.commands.executeCommand('extension-test.createDiagram');
          
          // Show a success message
          vscode.window.showInformationMessage(`Created diagram from ${fileName}.tf`);
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
}

export function deactivate() {}