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
  
  // Register the TreeView
  const treeView = vscode.window.createTreeView('extension-test.terraformFiles', {
    treeDataProvider: terraformProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);
  
  // Register file selection command
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.selectTerraformFile', (fileUri: vscode.Uri) => {
      terraformProvider.setSelectedFile(fileUri);
    })
  );
  
  // Register create diagram command
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.createDiagramFromSelected', async () => {
      const selectedFile = terraformProvider.getSelectedFile();
      
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