import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MenuViewProvider } from "./providers/MenuViewProvider"

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, "extension-test" is now active!');

  // Register the original Hello World command
  const disposable = vscode.commands.registerCommand('extension-test.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from extension_test!');
  });
  context.subscriptions.push(disposable);

  // Register the custom webview provider for the activity bar view
  const provider = new MenuViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('extension-test.menuView', provider)
  );
}

/**
 * WebviewViewProvider implementation for the activity bar menu
 */

export function deactivate() {}