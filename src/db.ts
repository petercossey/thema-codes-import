import Database from 'better-sqlite3';
import { ImportProgress, ImportStatus } from './types/database';
import logger from './utils/logger';

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    try {
      // Enable foreign keys and WAL mode for better performance
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('journal_mode = WAL');

      // Create tables if they don't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS import_progress (
          code_value TEXT PRIMARY KEY,
          bc_category_id INTEGER,
          parent_code TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_parent_code ON import_progress(parent_code);
        CREATE INDEX IF NOT EXISTS idx_status ON import_progress(status);
      `);

      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  insertProgress(progress: Omit<ImportProgress, 'created_at' | 'updated_at'>): void {
    const now = new Date().toISOString();
    
    try {
      const stmt = this.db.prepare(`
        INSERT INTO import_progress (
          code_value, bc_category_id, parent_code, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        progress.code_value,
        progress.bc_category_id,
        progress.parent_code,
        progress.status,
        now,
        now
      );
    } catch (error) {
      logger.error(`Failed to insert progress for code ${progress.code_value}:`, error);
      throw error;
    }
  }

  updateProgress(
    codeValue: string,
    updates: Partial<Omit<ImportProgress, 'code_value' | 'created_at'>>
  ): void {
    try {
      const sets: string[] = [];
      const values: any[] = [];

      // Build dynamic SET clause
      Object.entries(updates).forEach(([key, value]) => {
        sets.push(`${key} = ?`);
        values.push(value);
      });
      sets.push('updated_at = ?');
      values.push(new Date().toISOString());

      // Add WHERE clause value
      values.push(codeValue);

      const stmt = this.db.prepare(`
        UPDATE import_progress
        SET ${sets.join(', ')}
        WHERE code_value = ?
      `);

      stmt.run(...values);
    } catch (error) {
      logger.error(`Failed to update progress for code ${codeValue}:`, error);
      throw error;
    }
  }

  getProgress(codeValue: string): ImportProgress | undefined {
    try {
      const stmt = this.db.prepare('SELECT * FROM import_progress WHERE code_value = ?');
      return stmt.get(codeValue) as ImportProgress | undefined;
    } catch (error) {
      logger.error(`Failed to get progress for code ${codeValue}:`, error);
      throw error;
    }
  }

  getProgressByStatus(status: ImportStatus): ImportProgress[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM import_progress WHERE status = ?');
      return stmt.all(status) as ImportProgress[];
    } catch (error) {
      logger.error(`Failed to get progress for status ${status}:`, error);
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
} 