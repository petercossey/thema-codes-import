import { main } from './index';
import { ConfigLoader } from './config';
import { DataLoader } from './data-loader';
import { DatabaseManager } from './db';
import { BigCommerceClient } from './bigcommerce';
import { HierarchicalProcessor } from './processor';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import logger from './utils/logger';

// Add fs/promises mock
jest.mock('fs/promises', () => ({
  access: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  rm: jest.fn()
}));

jest.mock('./config');
jest.mock('./data-loader');
jest.mock('./db');
jest.mock('./bigcommerce');
jest.mock('./processor');
jest.mock('./utils/logger');

describe('Integration Tests', () => {
  const testDir = join(__dirname, '../test-temp');
  const configPath = join(testDir, 'config.json');
  const sourcePath = join(testDir, 'source.json');

  beforeEach(() => {
    jest.clearAllMocks();
    process.argv = ['node', 'script', '--config', configPath, '--source', sourcePath];
  });

  it('should successfully process valid input', async () => {
    // Mock configuration
    const mockConfig = {
      bigcommerce: { storeHash: 'test', apiToken: 'test' },
      import: { categoryTreeId: 1 },
      mapping: { name: '${CodeDescription}' },
      database: ':memory:'
    };
    (ConfigLoader.load as jest.Mock).mockResolvedValue(mockConfig);

    // Mock data loading
    const mockCodes = [
      { CodeValue: 'A', CodeDescription: 'Test', CodeParent: '' }
    ];
    (DataLoader.loadThemaCodes as jest.Mock).mockResolvedValue(mockCodes);

    // Mock processing results
    const mockResults = [
      { codeValue: 'A', categoryId: 1 }
    ];
    (HierarchicalProcessor.prototype.processCodes as jest.Mock)
      .mockResolvedValue(mockResults);

    // Mock database getProgressByStatus
    (DatabaseManager.prototype.getProgressByStatus as jest.Mock)
      .mockResolvedValue([]);

    await main();

    expect(ConfigLoader.load).toHaveBeenCalledWith(configPath);
    expect(DataLoader.loadThemaCodes).toHaveBeenCalledWith(sourcePath);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Successfully imported: 1')
    );
  });

  it('should handle configuration errors gracefully', async () => {
    (ConfigLoader.load as jest.Mock).mockRejectedValue(
      new Error('Invalid configuration')
    );

    await expect(main()).rejects.toThrow('Invalid configuration');

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in main process'),
      expect.any(Error)
    );
  });

  it('should handle data loading errors gracefully', async () => {
    (ConfigLoader.load as jest.Mock).mockResolvedValue({});
    (DataLoader.loadThemaCodes as jest.Mock).mockRejectedValue(
      new Error('Invalid data format')
    );

    await expect(main()).rejects.toThrow('Invalid data format');

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in main process'),
      expect.any(Error)
    );
  });
}); 