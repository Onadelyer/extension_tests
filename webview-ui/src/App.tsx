import React, { useEffect, useState } from 'react';
import './App.css';
import FileExplorer from './FileExplorer';

// Declare the VS Code API which is available in the webview
declare global {
  interface Window {
    acquireVsCodeApi: any;
  }
}

// Get VS Code API
const vscode = window.acquireVsCodeApi();

// Define the file structure interface
interface TerraformFile {
  uri: string;
  path: string;
  name: string;
  workspaceName: string;
}

function App() {
  const [tfFiles, setTfFiles] = useState<TerraformFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<TerraformFile | null>(null);

  useEffect(() => {
    // Request Terraform files when component mounts
    vscode.postMessage({
      command: 'getTerraformFiles'
    });

    // Listen for messages from the extension
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.command) {
        case 'tfFiles':
          // Update file list when received from extension
          setTfFiles(message.files);
          break;
      }
    };

    window.addEventListener('message', messageListener);
    
    // Clean up
    return () => {
      window.removeEventListener('message', messageListener);
    };
  }, []);

  // Handle file selection
  const handleFileSelect = (file: TerraformFile | null) => {
    setSelectedFile(file);
  };

  // Handle create diagram button click
  const handleCreateDiagram = () => {
    if (selectedFile) {
      vscode.postMessage({
        command: 'createDiagram',
        filePath: selectedFile.uri
      });
    }
  };

  return (
    <div className="app-container">
      <FileExplorer 
        files={tfFiles} 
        onSelect={handleFileSelect} 
      />
      <div className="button-container">
        <button 
          className={`create-button ${!selectedFile ? 'disabled' : ''}`}
          onClick={handleCreateDiagram}
          disabled={!selectedFile}
        >
          Create diagram
        </button>
      </div>
      {selectedFile && (
        <div className="selected-file">
          Selected: {selectedFile.name}
        </div>
      )}
    </div>
  );
}

export default App;