export enum SummaryScopeTypes {
  Day,
  Week,
}

export interface Keylog {
  rawPath: string | null;
  appPath: string | null;
  chronoPath: string | null;
  date: Date;
}

export interface Screenshot {
  imagePath: string | null;
  summaryPath: string | null;
  date: Date;
}

export interface Summary {
  date: Date;
  loading: boolean;
  keylogs: Keylog[];
  screenshots: Screenshot[];
  scope: SummaryScopeTypes;
  contents: string | null;
  path: string | null;
  keylogCharCount?: number;
  screenshotSummaryCharCount?: number;
}
