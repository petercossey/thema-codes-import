import { HierarchicalProcessor } from './processor';
import { DatabaseManager } from './db';
import { BigCommerceClient } from './bigcommerce';
import { ThemaCode } from './types/thema';
import { Config } from './types/config';
import { ImportProgress, ImportStatus } from './types/database';

describe('HierarchicalProcessor', () => {
  let processor: HierarchicalProcessor;
  let mockDb: jest.Mocked<DatabaseManager>;
  let mockBcClient: jest.Mocked<BigCommerceClient>;
  let mockConfig: Config;

  beforeEach(() => {
    mockDb = {
      getProgress: jest.fn(),
      updateProgress: jest.fn(),
      insertProgress: jest.fn(),
      getProgressByStatus: jest.fn(),
      close: jest.fn()
    } as any;

    mockBcClient = {
      createCategory: jest.fn(),
    } as any;

    mockConfig = {
      import: {
        categoryTreeId: 1,
        parentCategoryId: 42,
      },
      mapping: {
        name: '${CodeDescription}',
        description: '${CodeNotes}',
        is_visible: true,
        url: {
          path: '/${CodeValue}/',
          transformations: ['lowercase']
        }
      }
    } as any;

    processor = new HierarchicalProcessor(mockDb, mockBcClient, mockConfig);
  });

  it('should process codes level by level', async () => {
    jest.setTimeout(10000);
    
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
      cb();
      return undefined as any;
    });

    const codes = [
      {
        CodeValue: 'A',
        CodeDescription: 'Top Level',
        CodeNotes: 'Notes',
        CodeParent: '',
        IssueNumber: 1,
        Modified: '2024-03-01'
      },
      {
        CodeValue: 'AA',
        CodeDescription: 'Child Level',
        CodeNotes: 'Notes',
        CodeParent: 'A',
        IssueNumber: 1,
        Modified: '2024-03-01'
      },
      {
        CodeValue: 'AAA',
        CodeDescription: 'Grandchild Level',
        CodeNotes: 'Notes',
        CodeParent: 'AA',
        IssueNumber: 1,
        Modified: '2024-03-01'
      }
    ];

    // Mock sequential category creation
    mockBcClient.createCategory.mockImplementation(async (category) => {
      const id = category.name === 'Top Level' ? 100 : 
                 category.name === 'Child Level' ? 101 : 102;
      return id;
    });

    // Mock database operations to track progress
    const dbState = new Map();
    mockDb.getProgress.mockImplementation(async (codeValue) => {
      return dbState.get(codeValue);
    });

    mockDb.updateProgress.mockImplementation(async (codeValue, updates) => {
      dbState.set(codeValue, {
        code_value: codeValue,
        ...updates,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 0
      });
    });

    const results = await processor.processCodes(codes);

    // Verify processing order
    const createCalls = mockBcClient.createCategory.mock.calls;
    expect(createCalls[0][0].name).toBe('Top Level');
    expect(createCalls[1][0].name).toBe('Child Level');
    expect(createCalls[2][0].name).toBe('Grandchild Level');

    // Verify all categories were created
    expect(results).toHaveLength(3);
    expect(results[0].categoryId).toBe(100);
    expect(results[1].categoryId).toBe(101);
    expect(results[2].categoryId).toBe(102);
  });

  it('should skip processing children of failed categories', async () => {
    const codes = [
      {
        CodeValue: 'A',
        CodeDescription: 'Top Level',
        CodeNotes: 'Notes',
        CodeParent: '',
        IssueNumber: 1,
        Modified: '2024-03-01'
      },
      {
        CodeValue: 'AA',
        CodeDescription: 'Child Level',
        CodeNotes: 'Notes',
        CodeParent: 'A',
        IssueNumber: 1,
        Modified: '2024-03-01'
      }
    ];

    // Mock parent category creation failure
    mockBcClient.createCategory.mockRejectedValueOnce(new Error('API Error'));
    mockDb.getProgress.mockReturnValue(undefined);
    mockDb.updateProgress.mockReturnValue();

    const results = await processor.processCodes(codes);

    expect(results).toHaveLength(2);
    expect(results[0].error).toBeDefined();
    expect(results[1].error).toBe('Parent category A not ready');
    expect(mockBcClient.createCategory).toHaveBeenCalledTimes(1);
  });

  it('should use existing category ID for previously processed codes', async () => {
    const codes = [
      {
        CodeValue: 'A',
        CodeDescription: 'Top Level',
        CodeNotes: 'Notes',
        CodeParent: '',
        IssueNumber: 1,
        Modified: '2024-03-01'
      }
    ];

    // Mock existing category in database
    mockDb.getProgress.mockResolvedValue({
      code_value: 'A',
      bc_category_id: 100,
      parent_code: '',
      status: ImportStatus.COMPLETED,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      retry_count: 0
    });

    const results = await processor.processCodes(codes);

    expect(results[0].categoryId).toBe(100);
    expect(mockBcClient.createCategory).not.toHaveBeenCalled();
  });
}); 