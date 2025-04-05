import { SourceFileInfo } from './types/aws';

declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
      setState: (state: any) => void;
      getState: () => any;
    };
    diagramSourceFiles?: SourceFileInfo;
  }
}

export {};