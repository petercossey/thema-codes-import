import { DatabaseManager } from './db';
import { ImportStatus } from './types/database';
import { join } from 'path';
import { unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('DatabaseManager', () => {
  let dbPath: string;
  let db: DatabaseManager;

  beforeEach(() => {
    // Create a temporary directory for the test database
    const testDir = path.join(os.tmpdir(), 'thema-import-test');
    fs.mkdirSync(testDir, { recursive: true });
    
    // Use a unique database file for each test
    dbPath = path.join(testDir, `test-${Date.now()}.db`);
    db = new DatabaseManager(dbPath);
  });

  afterEach(() => {
    // Clean up the database file
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
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
      status: ImportStatus.PENDING,
      retry_count: 0,
      bc_category_id: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
      status: ImportStatus.PENDING,
      retry_count: 0
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
        status: ImportStatus.PENDING,
        retry_count: 0
      });
    });

    const pendingRecords = db.getProgressByStatus(ImportStatus.PENDING);
    expect(pendingRecords).toHaveLength(3);
  });

  it('should handle non-existent records', () => {
    const retrieved = db.getProgress('NON_EXISTENT');
    expect(retrieved).toBeUndefined();
  });

  it('should store and retrieve error messages', () => {
    const progress = {
      code_value: 'ABA',
      parent_code: '',
      status: ImportStatus.FAILED,
      retry_count: 0,
      error: 'Test error message'
    };

    db.insertProgress(progress);
    const retrieved = db.getProgress('ABA');

    expect(retrieved).toBeDefined();
    expect(retrieved?.error).toBe('Test error message');
  });

  it('should update error messages', () => {
    const progress = {
      code_value: 'ABA',
      parent_code: '',
      status: ImportStatus.PENDING,
      retry_count: 0
    };

    db.insertProgress(progress);
    
    const updates = {
      status: ImportStatus.FAILED,
      error: 'New error message'
    };

    db.updateProgress('ABA', updates);
    const retrieved = db.getProgress('ABA');

    expect(retrieved?.status).toBe(ImportStatus.FAILED);
    expect(retrieved?.error).toBe('New error message');
  });
}); 