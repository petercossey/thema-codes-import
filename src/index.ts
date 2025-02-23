import logger from './utils/logger';

async function main() {
  try {
    logger.info('Starting Thema import process...');
    // Main application logic will go here
  } catch (error) {
    logger.error('Error in main process:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 