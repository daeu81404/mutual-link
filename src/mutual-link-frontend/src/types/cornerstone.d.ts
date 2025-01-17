declare module "cornerstone-core" {
  export interface Image {
    imageId: string;
    minPixelValue: number;
    maxPixelValue: number;
    slope: number;
    intercept: number;
    windowCenter: number;
    windowWidth: number;
    getPixelData: () => Uint8Array | Float32Array;
    rows: number;
    columns: number;
    height: number;
    width: number;
    color: boolean;
    columnPixelSpacing: number;
    rowPixelSpacing: number;
    sizeInBytes: number;
  }

  export interface Math {
    rectangular: {
      enable: (element: HTMLElement) => void;
      disable: (element: HTMLElement) => void;
    };
  }

  export function enable(element: HTMLElement): void;
  export function disable(element: HTMLElement): void;
  export function loadImage(imageId: string): Promise<Image>;
  export function displayImage(element: HTMLElement, image: Image): void;

  export default {
    enable,
    disable,
    loadImage,
    displayImage,
  };
}

declare module "cornerstone-wado-image-loader" {
  export const external: {
    cornerstone: any;
    dicomParser: any;
  };

  export const wadouri: {
    fileManager: {
      add: (file: Blob) => string;
    };
  };

  export const wadors: {
    dicomParser: any;
  };

  export const webWorkerManager: {
    initialize: (config: {
      maxWebWorkers: number;
      startWebWorkersOnDemand: boolean;
      taskConfiguration: {
        decodeTask: {
          initializeCodecsOnStartup: boolean;
          usePDFJS: boolean;
          strict: boolean;
        };
      };
    }) => void;
  };

  export default {
    external,
    wadouri,
    wadors,
    webWorkerManager,
  };
}

declare module "cornerstone-tools" {
  export interface External {
    cornerstone: any;
    Hammer: any;
  }

  export const external: External;

  export interface Tool {
    new (): any;
  }

  export const WwwcTool: Tool;
  export const PanTool: Tool;
  export const ZoomTool: Tool;

  export function init(): void;
  export function addTool(tool: Tool): void;
  export function setToolActive(
    toolName: string,
    options: { mouseButtonMask: number }
  ): void;
  export function clearToolState(element: HTMLElement, toolType: string): void;

  export default {
    external,
    WwwcTool,
    PanTool,
    ZoomTool,
    init,
    addTool,
    setToolActive,
    clearToolState,
  };
}

declare module "dicom-parser";
