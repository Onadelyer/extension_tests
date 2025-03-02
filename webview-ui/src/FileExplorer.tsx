import React, { useState, useEffect } from 'react';
import './FileExplorer.css';

// Define the file structure interface
interface TerraformFile {
  uri: string;
  path: string;
  name: string;
  workspaceName: string;
}

interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  uri?: string;
  path?: string;
  children: Record<string, TreeNode>;
}

interface FileExplorerProps {
  files: TerraformFile[];
  onSelect: (file: TerraformFile | null) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ files, onSelect }) => {
  const [tree, setTree] = useState<TreeNode>({ name: 'root', type: 'folder', children: {} });
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Build the file tree structure
  useEffect(() => {
    const root: TreeNode = { name: 'root', type: 'folder', children: {} };
    
    // Build file tree structure
    files.forEach(file => {
      const pathParts = file.path.split(/[\/\\]/);
      let currentNode = root;
      
      // Build the directory structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        
        if (!currentNode.children[part]) {
          currentNode.children[part] = {
            name: part,
            type: 'folder',
            children: {}
          };
        }
        
        currentNode = currentNode.children[part];
      }
      
      // Add the file
      const fileName = pathParts[pathParts.length - 1];
      currentNode.children[fileName] = {
        name: fileName,
        type: 'file',
        uri: file.uri,
        path: file.path,
        children: {}
      };
    });
    
    setTree(root);
  }, [files]);

  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Handle file selection
  const handleFileSelect = (file: TerraformFile) => {
    const newSelectedFile = selectedFile === file.uri ? null : file.uri;
    setSelectedFile(newSelectedFile);
    
    // Find the full file object to send back
    const selectedFileObj = newSelectedFile 
      ? files.find(f => f.uri === newSelectedFile) || null 
      : null;
    
    onSelect(selectedFileObj);
  };

  // Render a folder and its contents
  const renderFolder = (node: TreeNode, path: string = '', level: number = 0) => {
    const isExpanded = expandedFolders[path] !== false; // Default to expanded for top level
    const folderPath = path ? `${path}/${node.name}` : node.name;
    
    return (
      <div key={folderPath} className="folder-container">
        {node.name !== 'root' && (
          <div 
            className="folder-item"
            style={{ paddingLeft: `${level * 16}px` }}
            onClick={() => toggleFolder(folderPath)}
          >
            <span className={`folder-icon ${isExpanded ? 'expanded' : 'collapsed'}`}>
              {isExpanded ? '▼' : '►'}
            </span>
            <span className="folder-name">{node.name}</span>
          </div>
        )}
        
        {(node.name === 'root' || isExpanded) && (
          <div className="folder-contents">
            {Object.values(node.children)
              .sort((a, b) => {
                // Sort folders before files
                if (a.type !== b.type) {
                  return a.type === 'folder' ? -1 : 1;
                }
                // Sort alphabetically within the same type
                return a.name.localeCompare(b.name);
              })
              .map(child => {
                if (child.type === 'folder') {
                  return renderFolder(child, folderPath, level + 1);
                } else {
                  return renderFile(child, folderPath, level + 1);
                }
              })}
          </div>
        )}
      </div>
    );
  };

  // Render a file item
  const renderFile = (node: TreeNode, path: string, level: number) => {
    if (!node.uri || !node.path) return null;
    
    const fileData: TerraformFile = {
      uri: node.uri,
      path: node.path,
      name: node.name,
      workspaceName: ''
    };
    
    return (
      <div 
        key={node.uri} 
        className={`file-item ${selectedFile === node.uri ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => handleFileSelect(fileData)}
      >
        <input 
          type="checkbox" 
          checked={selectedFile === node.uri}
          onChange={() => {}}
          className="file-checkbox"
        />
        <span className="file-icon">.tf</span>
        <span className="file-name">{node.name}</span>
      </div>
    );
  };

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <h3>Terraform Files</h3>
      </div>
      <div className="explorer-content">
        {files.length === 0 ? (
          <div className="no-files">No .tf files found</div>
        ) : (
          renderFolder(tree)
        )}
      </div>
    </div>
  );
};

export default FileExplorer;