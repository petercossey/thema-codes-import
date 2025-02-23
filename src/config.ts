import { readFile } from 'fs/promises';
import { Config, ConfigSchema } from './types/config';

export class ConfigLoader {
  static async load(configPath: string): Promise<Config> {
    try {
      const configFile = await readFile(configPath, 'utf-8');
      const configData = JSON.parse(configFile);
      
      // Validate and parse config using Zod schema
      const config = ConfigSchema.parse(configData);
      
      return config;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load configuration: ${error.message}`);
      }
      throw error;
    }
  }
} 