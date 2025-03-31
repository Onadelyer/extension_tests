import * as vscode from 'vscode';
import { TerraformTreeProvider } from "./providers/TerraformTreeProvider";
import { DiagramEditorProvider } from "./providers/DiagramEditorProvider";
import { TerraformDependencyDecorationProvider } from './providers/TerraformDependencyDecorationProvider';

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
      vscode.window.showInformationMessage('This functionality has been removed.');
    })
  );
  
  // Register the diagram editor provider
  context.subscriptions.push(
    DiagramEditorProvider.register(context)
  );
  
  // // Also update highlighting when the active editor changes
  // context.subscriptions.push(
  //   vscode.window.onDidChangeActiveTextEditor(async editor => {
  //     if (editor && editor.document.uri.fsPath.endsWith('.tf')) {
  //       await decorationProvider.setSelectedFile(editor.document.uri);
  //     }
  //   })
  // );
}

export function deactivate() {}