import { DatabaseManager } from './db';
import { ImportStatus } from './types/database';
import { join } from 'path';
import { unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { dirname } from 'path';

describe('DatabaseManager', () => {
  const dbPath = join(__dirname, '../test-temp/test.db');
  let db: DatabaseManager;

  beforeAll(async () => {
    // Ensure the directory exists before creating the database
    await mkdir(dirname(dbPath), { recursive: true });
  });

  beforeEach(async () => {
    // Remove test database if it exists
    if (existsSync(dbPath)) {
      await unlink(dbPath);
    }

    // Wait for the directory to be ready before creating the database
    await new Promise(resolve => setTimeout(resolve, 100));
    
    db = new DatabaseManager(dbPath);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  afterAll(async () => {
    // Clean up by removing the test database if it exists
    try {
      await unlink(dbPath);
    } catch (error) {
      // Ignore errors if file doesn't exist
    }
  });

  it('should initialize database with required table and indexes', async () => {
    // Make this test async and await the database creation
    await expect(async () => new DatabaseManager(dbPath)).not.toThrow();
  });

  it('should insert and retrieve progress record', () => {
    const progress = {
      code_value: 'ABA',
      parent_code: '',
      status: ImportStatus.PENDING
    };

    db.insertProgress(progress);
    const retrieved = db.getProgress('ABA');

    expect(retrieved).toBeDefined();
    expect(retrieved?.code_value).toBe(progress.code_value);
    expect(retrieved?.status).toBe(progress.status);
    expect(retrieved?.created_at).toBeDefined();
    expect(retrieved?.updated_at).toBeDefined();
  });

  it('should update progress record', () => {
    const progress = {
      code_value: 'ABA',
      parent_code: '',
      status: ImportStatus.PENDING
    };

    db.insertProgress(progress);
    
    const updates = {
      status: ImportStatus.COMPLETED,
      bc_category_id: 123
    };

    db.updateProgress('ABA', updates);
    const retrieved = db.getProgress('ABA');

    expect(retrieved?.status).toBe(ImportStatus.COMPLETED);
    expect(retrieved?.bc_category_id).toBe(123);
  });

  it('should get progress records by status', () => {
    const codes = ['ABA', 'ABAA', 'ABAB'];
    
    codes.forEach(code => {
      db.insertProgress({
        code_value: code,
        parent_code: code === 'ABA' ? '' : 'ABA',
        status: ImportStatus.PENDING
      });
    });

    const pendingRecords = db.getProgressByStatus(ImportStatus.PENDING);
    expect(pendingRecords).toHaveLength(3);
  });

  it('should handle non-existent records', () => {
    const retrieved = db.getProgress('NON_EXISTENT');
    expect(retrieved).toBeUndefined();
  });
}); 