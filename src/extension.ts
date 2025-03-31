import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DiagramEditorProvider } from "./providers/DiagramEditorProvider";
import { TerraformTreeProvider } from "./providers/TerraformTreeProvider";
import { TerraformParser } from "./parsers/TerraformParser";

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
  
  // Register create diagram command with empty implementation
  // This placeholder keeps the command registered but doesn't do anything
  context.subscriptions.push(
    vscode.commands.registerCommand('extension-test.createDiagramFromSelected', async () => {
      // Command functionality has been removed
      vscode.window.showInformationMessage('This functionality has been removed.');
    })
  );
  
  // Register the diagram editor provider
  context.subscriptions.push(
    DiagramEditorProvider.register(context)
  );
}

export function deactivate() {}