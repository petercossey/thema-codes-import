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
  private hierarchyMap: Map<string, ThemaCode[]>;
  
  constructor(
    private db: DatabaseManager,
    private bcClient: BigCommerceClient,
    private config: Config
  ) {
    this.hierarchyMap = new Map();
  }

  async processCodes(codes: ThemaCode[]): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];
    
    // Build hierarchy map
    const hierarchyMap = new Map<string, ThemaCode[]>();
    const rootCodes: ThemaCode[] = [];
    
    // Organize codes by their parent
    for (const code of codes) {
      if (!code.CodeParent) {
        rootCodes.push(code);
      } else {
        if (!hierarchyMap.has(code.CodeParent)) {
          hierarchyMap.set(code.CodeParent, []);
        }
        hierarchyMap.get(code.CodeParent)!.push(code);
      }
    }

    this.hierarchyMap = hierarchyMap;

    // Process root level first
    await this.processLevel(rootCodes, 0);
    
    // Collect results for all codes
    for (const code of codes) {
      const progress = await this.db.getProgress(code.CodeValue);
      if (progress) {
        results.push({
          codeValue: code.CodeValue,
          categoryId: progress.bc_category_id,
          error: progress.error
        });
      }
    }

    return results;
  }

  private async processLevel(currentCodes: ThemaCode[], level: number): Promise<void> {
    logger.info(`Processing level ${level} with ${currentCodes.length} codes`);

    // Process codes sequentially at current level
    for (const code of currentCodes) {
        try {
            await this.processCode(code);
            
            // Process children immediately after parent succeeds
            const children = this.hierarchyMap.get(code.CodeValue) || [];
            if (children.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 250)); // Small delay between levels
                await this.processLevel(children, level + 1);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to process code ${code.CodeValue}:`, errorMessage);
            // Continue with next code even if this one fails
        }
    }
  }

  private async processCode(code: ThemaCode): Promise<number> {
    try {
      // First check if already processed
      const existing = await this.db.getProgress(code.CodeValue);
      if (existing?.status === ImportStatus.COMPLETED && existing.bc_category_id) {
        logger.debug(`Using existing category ${existing.bc_category_id} for code ${code.CodeValue}`);
        return existing.bc_category_id;
      }

      // Initialize progress record if it doesn't exist
      if (!existing) {
        await this.db.insertProgress({
          code_value: code.CodeValue,
          parent_code: code.CodeParent,
          status: ImportStatus.PENDING,
          retry_count: 0
        });
      }

      // Try to get parent ID
      const parentId = await this.resolveParentId(code);
      
      // If parent isn't ready, mark for retry
      if (code.CodeParent && parentId === undefined) {
        const message = `Parent category ${code.CodeParent} not ready`;
        logger.debug(`Skipping ${code.CodeValue}: ${message}`);
        
        await this.db.updateProgress(code.CodeValue, {
          status: ImportStatus.PENDING,
          parent_code: code.CodeParent,
          error: message
        });
        throw new Error(message);
      }

      // Create category with validated parent ID
      const category = mapThemaToCategory(
        code,
        this.config.mapping,
        this.config.import.categoryTreeId,
        parentId
      );

      logger.info(`Creating category for ${code.CodeValue}`, {
        name: category.name,
        parentId: parentId,
        treeId: category.tree_id
      });

      // Create in BigCommerce
      const categoryId = await this.bcClient.createCategory(category);
      
      // Update database with success status
      await this.db.updateProgress(code.CodeValue, {
        bc_category_id: categoryId,
        parent_code: code.CodeParent || undefined,
        status: ImportStatus.COMPLETED,
        error: undefined
      });

      logger.info(`Successfully processed code ${code.CodeValue} with category ID ${categoryId}`);
      return categoryId;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update progress with error status
      await this.db.updateProgress(code.CodeValue, {
        status: ImportStatus.FAILED,
        error: errorMessage
      });

      // Only log as error if it's not a parent-waiting condition
      if (!errorMessage.includes('not ready')) {
        logger.error(`Failed to process code ${code.CodeValue}:`, {
          error: errorMessage,
          code: code.CodeValue,
          parent: code.CodeParent
        });
      }

      throw error;
    }
  }

  private async resolveParentId(code: ThemaCode): Promise<number | undefined> {
    // For top-level codes
    if (!code.CodeParent) {
        const parentId = this.config.import.parentCategoryId;
        logger.debug(`Using configured parent ID ${parentId} for root code ${code.CodeValue}`);
        return parentId;
    }

    // For child codes, verify parent exists and has been processed
    const parent = await this.db.getProgress(code.CodeParent);
    
    if (!parent) {
        logger.debug(`No progress record found for parent ${code.CodeParent} of code ${code.CodeValue}`);
        return undefined;
    }

    if (parent.status !== ImportStatus.COMPLETED) {
        logger.debug(`Parent ${code.CodeParent} (status: ${parent.status}) not yet completed for code ${code.CodeValue}`);
        return undefined;
    }

    if (!parent.bc_category_id) {
        logger.error(`Parent ${code.CodeParent} has no BigCommerce category ID for code ${code.CodeValue}`);
        throw new Error(`Invalid parent category state for ${code.CodeParent}`);
    }

    logger.debug(`Using parent ID ${parent.bc_category_id} from ${code.CodeParent} for code ${code.CodeValue}`);
    return parent.bc_category_id;
  }
} 