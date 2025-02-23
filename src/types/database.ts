export interface ImportProgress {
  code_value: string;
  bc_category_id?: number;
  parent_code: string;
  status: ImportStatus;
  created_at: string;
  updated_at: string;
}

export enum ImportStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
} 