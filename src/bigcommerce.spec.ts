import { BigCommerceClient } from './bigcommerce';
import { BigCommerceCategory } from './types/bigcommerce';

describe('BigCommerceClient', () => {
  let client: BigCommerceClient;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    client = new BigCommerceClient({
      storeHash: 'test-store',
      apiToken: 'test-token',
      apiVersion: 'v3'
    });
  });

  const mockCategory: BigCommerceCategory = {
    name: 'Test Category',
    tree_id: 1,
    description: 'Test Description',
    is_visible: true,
    url: {
      path: '/test-category/',
      is_customized: true
    }
  };

  describe('createCategory', () => {
    it('should successfully create a category', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ category_id: 123 }]
        })
      });

      const categoryId = await client.createCategory(mockCategory);
      expect(categoryId).toBe(123);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.bigcommerce.com/stores/test-store/v3/catalog/trees/categories',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': 'test-token',
            'Accept': 'application/json'
          },
          body: JSON.stringify([mockCategory])
        }
      );
    });

    it('should retry on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ category_id: 123 }]
          })
        });

      const categoryId = await client.createCategory(mockCategory, 3);
      expect(categoryId).toBe(123);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle rate limits', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: [{ category_id: 123 }]
        })
      }));

      const start = Date.now();
      await Promise.all([
        client.createCategory(mockCategory),
        client.createCategory(mockCategory),
        client.createCategory(mockCategory),
        client.createCategory(mockCategory),
        client.createCategory(mockCategory)
      ]);

      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(800); // At least 4 intervals of 200ms
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('should throw after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.createCategory(mockCategory, 3))
        .rejects
        .toThrow('Network error');

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
}); 