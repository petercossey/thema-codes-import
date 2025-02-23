import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { access } from 'fs/promises';
import { constants } from 'fs';
import logger from './utils/logger';
import { ConfigLoader } from './config';

async function validateFilePath(path: string): Promise<void> {
  try {
    await access(path, constants.R_OK);
  } catch {
    throw new Error(`Cannot access file: ${path}`);
  }
}

async function main() {
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

    // TODO: Load and process Thema codes
    
  } catch (error) {
    logger.error('Error in main process:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main }; 