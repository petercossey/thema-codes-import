import { ThemaCode, ProcessingResult } from './types/thema';
import { DatabaseManager } from './db';
import { BigCommerceClient } from './bigcommerce';
import { BigCommerceCategory } from './types/bigcommerce';
import { Config } from './types/config';
import logger from './utils/logger';
import { mapThemaToCategory } from './mapper';
import { ImportStatus } from './types/database';

export class HierarchicalProcessor {
  constructor(
    private db: DatabaseManager,
    private bcClient: BigCommerceClient,
    private config: Config
  ) {}

  async processCodes(codes: ThemaCode[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    const processed = new Set<string>();
    
    // First, validate all parent references exist
    const codeMap = new Map(codes.map(code => [code.CodeValue, code]));
    const orphanedCodes = codes.filter(code => 
      code.CodeParent && !codeMap.has(code.CodeParent)
    );

    // Handle orphaned codes first
    if (orphanedCodes.length > 0) {
      const orphanResults = await Promise.all(
        orphanedCodes.map(code => this.processCode(code))
      );
      results.push(...orphanResults);
      orphanedCodes.forEach(code => processed.add(code.CodeValue));
    }

    // Process remaining codes in waves
    while (processed.size < codes.length) {
      const wave = codes.filter(code => {
        // Skip already processed codes and orphaned codes
        if (processed.has(code.CodeValue)) return false;
        
        // Include if top-level or parent is processed
        return !code.CodeParent || processed.has(code.CodeParent);
      });

      if (wave.length === 0) {
        logger.error('Circular dependency detected');
        break;
      }

      const waveResults = await Promise.all(
        wave.map(code => this.processCode(code))
      );

      results.push(...waveResults);
      wave.forEach(code => processed.add(code.CodeValue));
    }

    return results;
  }

  private async processCode(code: ThemaCode): Promise<ProcessingResult> {
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

      return {
        codeValue: code.CodeValue,
        categoryId
      };

    } catch (error) {
      logger.error(`Failed to process code ${code.CodeValue}:`, error);
      
      await this.db.updateProgress(code.CodeValue, {
        status: ImportStatus.FAILED,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        codeValue: code.CodeValue,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async resolveParentId(code: ThemaCode): Promise<number | undefined> {
    if (!code.CodeParent && this.config.import.parentCategoryId) {
      return this.config.import.parentCategoryId;
    }

    if (code.CodeParent) {
      const parent = this.db.getProgress(code.CodeParent);
      
      if (!parent?.bc_category_id) {
        throw new Error(`Parent category ${code.CodeParent} not found or not yet processed`);
      }
      
      return parent.bc_category_id;
    }

    return undefined;
  }
} 