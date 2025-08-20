export enum SerializedScopeTypes {
  Day,
  Week,
}

// FIXME merge with the similar LogFileInfo
export interface SerializedLog {
  summaryContents?: string;
  rawPath?: string;
  appPath?: string;
  chronoPath?: string;
  date: Date;
  scope: SerializedScopeTypes;
  loading: boolean;
}

export enum SummaryScopeTypes {
  Day,
  Week,
}

export interface Keylog {
  rawPath: string;
  appPath: string;
  chronoPath: string;
  date: Date;
}

export interface Screenshot {
  imagePath: string;
  summaryPath: string;
  date: Date;
}

export interface Summary {
  date: Date;
  loading: boolean;
  keylogs: Keylog[];
  screenshots: Screenshot[];
  scope: SummaryScopeTypes;
  contents: string;
}
