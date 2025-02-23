export interface ImportProgress {
  code_value: string;
  bc_category_id?: number;
  parent_code?: string;
  status: ImportStatus;
  error?: string;
  created_at: string;
  updated_at: string;
  retry_count: number;
}

export enum ImportStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export type ImportProgressUpdate = Partial<Omit<ImportProgress, 'created_at' | 'code_value'>> & {
  error?: string;
}; 