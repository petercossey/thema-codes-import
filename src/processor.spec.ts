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

  const sampleCodes: ThemaCode[] = [
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

  it('should process codes in hierarchical order', async () => {
    mockBcClient.createCategory.mockImplementation(async (category) => 
      category.name === 'Top Level' ? 100 : 101
    );

    mockDb.getProgress.mockImplementation((codeValue: string): ImportProgress | undefined => {
      if (codeValue === 'A') {
        return {
          code_value: 'A',
          bc_category_id: 100,
          parent_code: '',
          status: ImportStatus.COMPLETED,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      return undefined;
    });

    const results = await processor.processCodes(sampleCodes);

    expect(results).toHaveLength(2);
    expect(mockBcClient.createCategory).toHaveBeenCalledTimes(2);
    
    // Verify processing order
    const calls = mockBcClient.createCategory.mock.calls;
    expect(calls[0][0].name).toBe('Top Level');
    expect(calls[1][0].name).toBe('Child Level');
  });

  it('should handle missing parent categories', async () => {
    mockDb.getProgress.mockImplementation((codeValue: string): ImportProgress | undefined => undefined);

    const results = await processor.processCodes([sampleCodes[1]]);

    expect(results[0].error).toBeDefined();
    expect(mockBcClient.createCategory).not.toHaveBeenCalled();
  });
}); 