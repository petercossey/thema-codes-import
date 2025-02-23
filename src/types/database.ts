export interface ImportProgress {
  code_value: string;
  bc_category_id?: number;
  parent_code: string;
  status: ImportStatus;
  error?: string;
  created_at: string;
  updated_at: string;
}

export enum ImportStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export type ImportProgressUpdate = Partial<Omit<ImportProgress, 'created_at' | 'code_value'>> & {
  error?: string;
}; 