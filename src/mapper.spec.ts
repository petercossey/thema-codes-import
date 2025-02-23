import { mapField, buildUrlPath, mapThemaToCategory } from './mapper';
import { ThemaCode } from './types/thema';
import { MappingConfig } from './types/config';

describe('Mapper', () => {
  const sampleCode: ThemaCode = {
    CodeValue: 'ABA',
    CodeDescription: 'Theory of Art',
    CodeNotes: 'Usage information here',
    CodeParent: '',
    IssueNumber: 1,
    Modified: '2024-02-28'
  };

  describe('mapField', () => {
    it('should replace template variables with values', () => {
      const template = '${CodeValue}: ${CodeDescription}';
      const result = mapField(template, sampleCode);
      expect(result).toBe('ABA: Theory of Art');
    });

    it('should handle missing fields gracefully', () => {
      const template = '${NonexistentField}';
      const result = mapField(template, sampleCode);
      expect(result).toBe('');
    });
  });

  describe('buildUrlPath', () => {
    it('should build and transform URL path', () => {
      const template = '/${CodeValue}/${CodeDescription}/';
      const transformations = ['lowercase', 'replace-spaces'];
      const result = buildUrlPath(template, sampleCode, transformations);
      expect(result).toBe('/aba/theory-of-art/');
    });
  });

  describe('mapThemaToCategory', () => {
    const config: MappingConfig = {
      name: '${CodeDescription}',
      description: '<p>${CodeNotes}</p>',
      is_visible: true,
      url: {
        path: '/${CodeValue}/${CodeDescription}/',
        transformations: ['lowercase', 'replace-spaces']
      }
    };

    it('should map Thema code to BigCommerce category', () => {
      const treeId = 1;
      const result = mapThemaToCategory(sampleCode, config, treeId);
      expect(result).toEqual({
        name: 'Theory of Art',
        description: '<p>Usage information here</p>',
        is_visible: true,
        tree_id: 1,
        url: {
          is_customized: true,
          path: '/aba/theory-of-art/'
        }
      });
    });

    it('should include parent_id when provided', () => {
      const result = mapThemaToCategory(sampleCode, config, 1, 42);
      expect(result.parent_id).toBe(42);
    });
  });

  describe('URL sanitization', () => {
    const config: MappingConfig = {
      name: '${CodeDescription}',
      description: '<p>${CodeNotes}</p>',
      is_visible: true,
      url: {
        path: '/${CodeValue}/${CodeDescription}/',
        transformations: ['lowercase']
      }
    };

    it('should sanitize special characters in CodeDescription', () => {
      const codeWithSpecialChars: ThemaCode = {
        CodeValue: 'ABC',
        CodeDescription: 'Art & Design: Theory (2024)',
        CodeNotes: 'Test notes',
        CodeParent: '',
        IssueNumber: 1,
        Modified: 1.0
      };

      const result = mapThemaToCategory(codeWithSpecialChars, config, 1);
      expect(result.url?.path).toBe('/abc/art-design-theory-2024/');
    });

    it('should handle multiple consecutive special characters', () => {
      const codeWithMultipleSpecialChars: ThemaCode = {
        CodeValue: 'ABC',
        CodeDescription: 'Art   &   Design:::Theory',
        CodeNotes: 'Test notes',
        CodeParent: '',
        IssueNumber: 1,
        Modified: 1.0
      };

      const result = mapThemaToCategory(codeWithMultipleSpecialChars, config, 1);
      expect(result.url?.path).toBe('/abc/art-design-theory/');
    });
  });
}); 