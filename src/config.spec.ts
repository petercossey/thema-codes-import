import { ConfigLoader } from './config';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

describe('ConfigLoader', () => {
  const testDir = join(__dirname, '../test-temp');
  const validConfig = {
    bigcommerce: {
      storeHash: 'abc123',
      apiToken: 'test-token',
      apiVersion: 'v3'
    },
    import: {
      categoryTreeId: 1
    },
    mapping: {
      name: '${CodeDescription}',
      description: '<p>${CodeNotes}</p>',
      url: {
        path: '/${CodeValue}/${CodeDescription}/',
        transformations: ['lowercase', 'replace-spaces']
      },
      is_visible: true
    },
    database: 'import-progress.db'
  } as const;

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should load a valid configuration file', async () => {
    const configPath = join(testDir, 'valid-config.json');
    await writeFile(configPath, JSON.stringify(validConfig));

    const config = await ConfigLoader.load(configPath);
    expect(config).toEqual(validConfig);
  });

  it('should throw error for invalid configuration', async () => {
    // Create an invalid config by omitting required field
    const invalidConfig = {
      import: validConfig.import,
      mapping: validConfig.mapping,
      database: validConfig.database
    };

    const configPath = join(testDir, 'invalid-config.json');
    await writeFile(configPath, JSON.stringify(invalidConfig));

    await expect(ConfigLoader.load(configPath)).rejects.toThrow();
  });

  it('should throw error for non-existent file', async () => {
    await expect(ConfigLoader.load('non-existent.json')).rejects.toThrow();
  });
}); 