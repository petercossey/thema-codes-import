import { ThemaCode } from './types/thema';
import { BigCommerceCategory } from './types/bigcommerce';
import { MappingConfig } from './types/config';

/**
 * Replaces template variables with values from a Thema code object
 */
export function mapField(template: string, code: ThemaCode): string {
  return template.replace(/\${([^}]+)}/g, (match, field) => {
    return code[field as keyof ThemaCode]?.toString() || '';
  });
}

/**
 * Applies transformations to a URL path
 */
export function applyUrlTransformations(path: string, transformations: string[]): string {
  let result = path;

  for (const transform of transformations) {
    switch (transform) {
      case 'lowercase':
        result = result.toLowerCase();
        break;
      case 'replace-spaces':
        result = result.replace(/\s+/g, '-');
        break;
      case 'remove-special-chars':
        result = result.replace(/[^a-zA-Z0-9-]/g, '');
        break;
    }
  }

  return result;
}

/**
 * Builds a URL path using template and transformations
 */
export function buildUrlPath(template: string, code: ThemaCode, transformations: string[]): string {
  const path = mapField(template, code);
  return applyUrlTransformations(path, transformations);
}

/**
 * Maps a Thema code to a BigCommerce category using the provided mapping configuration
 */
export function mapThemaToCategory(
  code: ThemaCode, 
  config: MappingConfig,
  treeId: number,
  parentId?: number,
): BigCommerceCategory {
  const category: BigCommerceCategory = {
    name: mapField(config.name, code),
    description: mapField(config.description, code),
    is_visible: config.is_visible,
    tree_id: treeId,
  };

  if (parentId) {
    category.parent_id = parentId;
  }

  if (config.url) {
    category.url = {
      is_customized: true,
      path: buildUrlPath(config.url.path, code, config.url.transformations)
    };
  }

  return category;
} 