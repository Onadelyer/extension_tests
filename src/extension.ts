import * as vscode from 'vscode';
import { TerraformTreeProvider } from "./providers/TerraformTreeProvider";
import { TerraformDependencyDecorationProvider } from './providers/TerraformDependencyDecorationProvider';
import { openDiagramPanel } from './panels/DiagramPanel';

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
    vscode.commands.registerCommand('extension-test.createDiagram', () => {
      try {
        openDiagramPanel(context);
      } catch (error) {
        console.error('Error opening diagram panel:', error);
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
}

export function deactivate() {}