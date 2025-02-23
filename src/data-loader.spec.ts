import { DataLoader } from './data-loader';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

describe('DataLoader', () => {
  const testDir = join(__dirname, '../test-temp');
  const validCodes = {
    CodeList: {
      ThemaCodes: {
        Code: [
          {
            CodeValue: 'ABA',
            CodeDescription: 'Theory of art',
            CodeNotes: 'Some notes',
            CodeParent: '',
            IssueNumber: 1,
            Modified: '2024-02-28'
          }
        ]
      }
    }
  };

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should load valid Thema codes', async () => {
    const sourcePath = join(testDir, 'valid-codes.json');
    await writeFile(sourcePath, JSON.stringify(validCodes));

    const codes = await DataLoader.loadThemaCodes(sourcePath);
    expect(codes).toEqual(validCodes.CodeList.ThemaCodes.Code);
  });

  it('should throw error for invalid JSON', async () => {
    const sourcePath = join(testDir, 'invalid-json.json');
    await writeFile(sourcePath, '{ invalid json }');

    await expect(DataLoader.loadThemaCodes(sourcePath)).rejects.toThrow('Invalid JSON');
  });

  it('should throw error for missing required fields', async () => {
    const invalidCodes = [
      {
        // Missing CodeValue
        CodeDescription: 'Theory of art',
        CodeNotes: 'Some notes',
        CodeParent: '',
        IssueNumber: 1,
        Modified: '2024-02-28'
      }
    ];

    const sourcePath = join(testDir, 'invalid-codes.json');
    await writeFile(sourcePath, JSON.stringify(invalidCodes));

    await expect(DataLoader.loadThemaCodes(sourcePath)).rejects.toThrow();
  });

  it('should validate hierarchy correctly', () => {
    // Valid hierarchy
    DataLoader.validateHierarchy(validCodes.CodeList.ThemaCodes.Code);
    
    // Invalid hierarchy
    const invalidHierarchy = [
      ...validCodes.CodeList.ThemaCodes.Code,
      {
        CodeValue: 'ABC',
        CodeDescription: 'Invalid parent',
        CodeNotes: '',
        CodeParent: 'NON_EXISTENT',
        IssueNumber: 1,
        Modified: '2024-02-28'
      }
    ];

    // Should not throw but should log warning
    DataLoader.validateHierarchy(invalidHierarchy);
  });
}); 