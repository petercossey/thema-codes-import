import { readFile } from 'fs/promises';
import { ThemaCode, ThemaCodesSchema } from './types/thema';
import logger from './utils/logger';

export class DataLoader {
  static async loadThemaCodes(sourcePath: string): Promise<ThemaCode[]> {
    try {
      // Read and parse JSON file
      const fileContent = await readFile(sourcePath, 'utf-8');
      const jsonData = JSON.parse(fileContent);

      // Validate data structure using Zod schema
      const validatedData = ThemaCodesSchema.parse(jsonData);

      logger.info(`Successfully loaded ${validatedData.length} Thema codes`);
      return validatedData;

    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in source file: ${error.message}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to load Thema codes: ${error.message}`);
      }
      throw error;
    }
  }

  static validateHierarchy(codes: ThemaCode[]): void {
    const codeSet = new Set(codes.map(code => code.CodeValue));
    
    // Check that all parent codes exist
    const invalidParents = codes
      .filter(code => code.CodeParent && !codeSet.has(code.CodeParent))
      .map(code => ({
        code: code.CodeValue,
        parent: code.CodeParent
      }));

    if (invalidParents.length > 0) {
      logger.warn('Found codes with non-existent parents:', invalidParents);
    }
  }
} 