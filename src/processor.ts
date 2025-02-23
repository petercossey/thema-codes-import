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

    // Build hierarchy map
    const hierarchyMap = new Map<string, ThemaCode[]>();
    const rootCodes: ThemaCode[] = [];

    // Organize codes by their parent
    for (const code of codes) {
      if (!code.CodeParent) {
        rootCodes.push(code);
      } else {
        // Check if parent exists in the input codes
        const parentExists = codes.some(c => c.CodeValue === code.CodeParent);
        if (!parentExists) {
          // If parent doesn't exist, add error to results immediately
          results.push({
            codeValue: code.CodeValue,
            error: `Parent category ${code.CodeParent} not found`
          });
          continue;
        }
        
        if (!hierarchyMap.has(code.CodeParent)) {
          hierarchyMap.set(code.CodeParent, []);
        }
        hierarchyMap.get(code.CodeParent)!.push(code);
      }
    }

    // Process level by level
    const processLevel = async function(
      this: HierarchicalProcessor,
      currentCodes: ThemaCode[]
    ) {
      // Process all codes at current level
      for (const code of currentCodes) {
        try {
          const categoryId = await this.processCode(code);
          processed.set(code.CodeValue, categoryId);
          results.push({ codeValue: code.CodeValue, categoryId });

          // Process children if any exist
          const children = hierarchyMap.get(code.CodeValue) || [];
          if (children.length > 0) {
            await processLevel.call(this, children);
          }
        } catch (error) {
          results.push({
            codeValue: code.CodeValue,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    };

    // Start processing from root level
    await processLevel.call(this, rootCodes);
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
    // For top-level codes
    if (!code.CodeParent) {
      return this.config.import.parentCategoryId;
    }

    // For child codes, we must find their parent's category ID
    const parent = await this.db.getProgress(code.CodeParent);
    
    if (!parent?.bc_category_id) {
      throw new Error(`Parent category ${code.CodeParent} not found or not yet processed`);
    }

    return parent.bc_category_id;
  }
} 