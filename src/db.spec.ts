import { DatabaseManager } from './db';
import { ImportStatus } from './types/database';
import { join } from 'path';
import { unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';

describe('DatabaseManager', () => {
  const testDir = join(__dirname, '../test-temp');
  const testDbPath = join(testDir, 'test.db');
  let db: DatabaseManager;

  beforeEach(async () => {
    // Ensure test directory exists
    await mkdir(testDir, { recursive: true });
    
    // Remove test database if it exists
    if (existsSync(testDbPath)) {
      await unlink(testDbPath);
    }

    db = new DatabaseManager(testDbPath);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  afterAll(async () => {
    if (existsSync(testDbPath)) {
      await unlink(testDbPath);
    }
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should initialize database with required table and indexes', () => {
    // If no error is thrown during initialization, the test passes
    expect(() => new DatabaseManager(testDbPath)).not.toThrow();
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