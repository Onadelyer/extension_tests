import React, { useEffect, useState } from 'react';
import './App.css';
import DiagramEditor from './components/diagram/DiagramEditor';
import { DiagramData } from './types/aws';
import { createDefaultDiagram } from './utils/diagramConverters';

// Declare the VS Code API which is available in the webview
declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
      setState: (state: any) => void;
      getState: () => any;
    };
  }
}

// Get VS Code API
const vscode = window.acquireVsCodeApi();

function App() {
  const [diagram, setDiagram] = useState<DiagramData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Try to get cached state first
    try {
      const savedState = vscode.getState();
      if (savedState && savedState.diagram) {
        setDiagram(savedState.diagram);
        setLoading(false);
      }
    } catch (err) {
      console.log('No saved state found');
    }

    // Listen for messages from the extension
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.type) {
        case 'update':
          try {
            // Parse the diagram from the content
            const diagramData = JSON.parse(message.content);
            setDiagram(diagramData);
            
            // Save to webview state (this is not saving to filesystem)
            vscode.setState({ diagram: diagramData });
            
            // Clear any errors
            setError(null);
            setLoading(false);
          } catch (error) {
            console.error('Error parsing diagram data:', error);
            setError('Failed to parse diagram data. See console for details.');
            setLoading(false);
          }
          break;
          
        case 'error':
          setError(message.message || 'An unknown error occurred');
          setLoading(false);
          break;
      }
    };

    window.addEventListener('message', messageListener);
    
    // Request the current diagram data
    vscode.postMessage({ type: 'requestDiagram' });
    
    // Clean up
    return () => {
      window.removeEventListener('message', messageListener);
    };
  }, []);

  // Handle diagram update - no file saving, just state updates
  const handleUpdateDiagram = (updatedDiagram: DiagramData) => {
    // Save to webview state only (not filesystem)
    vscode.setState({ diagram: updatedDiagram });
    setDiagram(updatedDiagram);
    
    // Send the updated diagram back to the extension for UI updates only
    vscode.postMessage({
      type: 'update',
      content: JSON.stringify(updatedDiagram, null, 2)
    });
  };

  // Show loading state
  if (loading) {
    return (
      <div className="loading-container" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'var(--vscode-foreground)',
        backgroundColor: 'var(--vscode-editor-background)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ 
            border: '4px solid var(--vscode-panel-border)',
            borderTop: '4px solid var(--vscode-progressBar-background)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <p>Loading diagram...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="error-container" style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        padding: '20px',
        color: 'var(--vscode-errorForeground)',
        backgroundColor: 'var(--vscode-editor-background)',
        textAlign: 'center'
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path d="M8 8L16 16M8 16L16 8" stroke="currentColor" strokeWidth="2" />
        </svg>
        <h2 style={{ marginTop: '15px', color: 'var(--vscode-foreground)' }}>Error</h2>
        <p>{error}</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={() => {
              // Create a new empty diagram
              const newDiagram = createDefaultDiagram();
              setDiagram(newDiagram);
              setError(null);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Create New Diagram
          </button>
          <button
            onClick={() => vscode.postMessage({ type: 'requestDiagram' })}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Reload Diagram
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ height: '100vh', overflow: 'hidden' }}>
      <DiagramEditor
        initialDiagram={diagram}
        onUpdate={handleUpdateDiagram}
      />
    </div>
  );
}

export default App;