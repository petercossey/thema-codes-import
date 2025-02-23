import { ThemaCode, ProcessingResult } from './types/thema';
import { DatabaseManager } from './db';
import { BigCommerceClient } from './bigcommerce';
import { BigCommerceCategory } from './types/bigcommerce';
import { Config } from './types/config';
import logger from './utils/logger';
import { mapThemaToCategory } from './mapper';
import { ImportStatus } from './types/database';

interface ProcessResult {
  codeValue: string;
  categoryId?: number;
  error?: string;
}

export class HierarchicalProcessor {
  constructor(
    private db: DatabaseManager,
    private bcClient: BigCommerceClient,
    private config: Config
  ) {}

  async processCodes(codes: ThemaCode[]): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];
    const processed = new Map<string, number>();

    // Process codes without parents first
    for (const code of codes) {
      if (!code.CodeParent) {
        try {
          const categoryId = await this.processCode(code);
          processed.set(code.CodeValue, categoryId);
          results.push({ codeValue: code.CodeValue, categoryId });
        } catch (error) {
          results.push({ 
            codeValue: code.CodeValue, 
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    // Then process codes with parents
    for (const code of codes) {
      if (code.CodeParent) {
        // Check if parent exists in processed map
        const parentProcessed = processed.get(code.CodeParent);
        const hasDefaultParent = this.config.import.parentCategoryId !== undefined;
        
        // If no parent found and no default parent configured
        if (!parentProcessed && !hasDefaultParent) {
          results.push({ 
            codeValue: code.CodeValue, 
            error: `Parent category ${code.CodeParent} not found and no default parent category configured` 
          });
        } else {
          try {
            const categoryId = await this.processCode(code);
            processed.set(code.CodeValue, categoryId);
            results.push({ codeValue: code.CodeValue, categoryId });
          } catch (error) {
            results.push({ 
              codeValue: code.CodeValue, 
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    }

    return results;
  }

  private async processCode(code: ThemaCode): Promise<number> {
    try {
      const parentId = await this.resolveParentId(code);
      
      const category = mapThemaToCategory(
        code,
        this.config.mapping,
        this.config.import.categoryTreeId,
        parentId
      );

      const categoryId = await this.bcClient.createCategory(category);
      
      await this.db.updateProgress(code.CodeValue, {
        bc_category_id: categoryId,
        status: ImportStatus.COMPLETED
      });

      return categoryId;

    } catch (error) {
      logger.error(`Failed to process code ${code.CodeValue}:`, error);
      
      await this.db.updateProgress(code.CodeValue, {
        status: ImportStatus.FAILED,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  private async resolveParentId(code: ThemaCode): Promise<number | undefined> {
    // If no parent code is specified, return the default parent category ID
    if (!code.CodeParent) {
      return this.config.import.parentCategoryId;
    }

    // If parent code exists, try to get its category ID
    const parent = await this.db.getProgress(code.CodeParent);
    if (parent?.bc_category_id) {
      return parent.bc_category_id;
    }

    // If parent code doesn't exist, fall back to default parent category ID
    if (this.config.import.parentCategoryId) {
      return this.config.import.parentCategoryId;
    }

    // Only throw if we have no fallback
    throw new Error(`Parent category ${code.CodeParent} not found or not yet processed`);
  }
} 