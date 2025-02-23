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
      db: {} as any,
      initialize: jest.fn(),
      getProgress: jest.fn<ImportProgress | undefined, [string]>(),
      updateProgress: jest.fn(),
      insertProgress: jest.fn(),
      getProgressByStatus: jest.fn().mockReturnValue([]),
      close: jest.fn()
    } as unknown as jest.Mocked<DatabaseManager>;

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

    // Fix: Mock database operations with proper types
    const dbState = new Map<string, ImportProgress>();
    mockDb.getProgress = jest.fn<ImportProgress | undefined, [string]>()
      .mockImplementation((codeValue: string) => dbState.get(codeValue));

    mockDb.updateProgress.mockImplementation(async (codeValue, updates) => {
      const progress: ImportProgress = {
        code_value: codeValue,
        status: updates.status || ImportStatus.PENDING,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 0,
        bc_category_id: updates.bc_category_id,
        parent_code: updates.parent_code,
        error: updates.error
      };
      dbState.set(codeValue, progress);
      return Promise.resolve();
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
    
    const dbState = new Map<string, ImportProgress>();
    mockDb.getProgress.mockImplementation(codeValue => dbState.get(codeValue));
    mockDb.updateProgress.mockImplementation(async (codeValue, updates) => {
      const progress: ImportProgress = {
        code_value: codeValue,
        status: updates.status || ImportStatus.PENDING,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 0,
        bc_category_id: updates.bc_category_id,
        parent_code: updates.parent_code,
        error: updates.error
      };
      dbState.set(codeValue, progress);
    });

    const results = await processor.processCodes(codes);

    expect(results).toHaveLength(1);
    expect(results[0].error).toBe('API Error');
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

    // Fix: Mock with proper ImportProgress type
    const existingProgress: ImportProgress = {
      code_value: 'A',
      bc_category_id: 100,
      parent_code: '',
      status: ImportStatus.COMPLETED,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      retry_count: 0
    };

    mockDb.getProgress = jest.fn<ImportProgress | undefined, [string]>()
      .mockReturnValue(existingProgress);

    const results = await processor.processCodes(codes);

    expect(results[0].categoryId).toBe(100);
    expect(mockBcClient.createCategory).not.toHaveBeenCalled();
  });
}); 