import logger from './logger';

describe('Logger', () => {
  test('logger should be defined', () => {
    expect(logger).toBeDefined();
  });

  test('logger should have required methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });
}); 