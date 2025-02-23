import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { access } from 'fs/promises';
import { constants } from 'fs';
import logger from './utils/logger';
import { ConfigLoader } from './config';
import { DataLoader } from './data-loader';
import { DatabaseManager } from './db';
import { BigCommerceClient } from './bigcommerce';
import { HierarchicalProcessor } from './processor';

async function validateFilePath(path: string): Promise<void> {
  try {
    await access(path, constants.R_OK);
  } catch {
    throw new Error(`Cannot access file: ${path}`);
  }
}

async function main() {
  let db: DatabaseManager | undefined;
  let bcClient: BigCommerceClient | undefined;
  
  try {
    // Parse command line arguments
    const argv = await yargs(hideBin(process.argv))
      .option('config', {
        alias: 'c',
        type: 'string',
        description: 'Path to configuration file',
        demandOption: true
      })
      .option('source', {
        alias: 's',
        type: 'string',
        description: 'Path to Thema codes JSON file',
        demandOption: true
      })
      .help()
      .argv;

    logger.info('Starting Thema import process...');

    // Validate file paths
    await validateFilePath(argv.config);
    await validateFilePath(argv.source);

    // Load configuration
    const config = await ConfigLoader.load(argv.config);
    logger.info('Configuration loaded successfully');

    // Initialize database
    db = new DatabaseManager(config.database);
    logger.info('Database initialized successfully');

    // Initialize BigCommerce client
    bcClient = new BigCommerceClient(config.bigcommerce);
    logger.info('BigCommerce client initialized successfully');

    // Load and validate Thema codes
    const themaCodes = await DataLoader.loadThemaCodes(argv.source);
    DataLoader.validateHierarchy(themaCodes);
    logger.info(`Loaded ${themaCodes.length} Thema codes successfully`);

    // Initialize processor
    const processor = new HierarchicalProcessor(db, bcClient, config);
    
    // Process codes hierarchically
    const results = await processor.processCodes(themaCodes);
    
    // Log results
    const successful = results.filter(r => r.categoryId).length;
    const failed = results.filter(r => r.error).length;
    
    logger.info(`Import completed. Successfully imported: ${successful}, Failed: ${failed}`);
    
    if (failed > 0) {
      logger.warn('Failed imports:', results.filter(r => r.error));
    }
    
  } catch (error) {
    logger.error('Error in main process:', error);
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

if (require.main === module) {
  main();
}

export { main }; 