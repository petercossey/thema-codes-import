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
 * Sanitizes a string for use in URLs by:
 * - Removing special characters
 * - Converting to lowercase
 * - Replacing spaces with hyphens
 * - Removing consecutive hyphens
 * - Trimming hyphens from start/end
 */
function sanitizeUrlSegment(str: string): string {
  return str
    // Convert to lowercase first
    .toLowerCase()
    // Replace special characters and spaces with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading and trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds a URL path from a template and code data
 */
export function buildUrlPath(template: string, code: ThemaCode, transformations: string[] = []): string {
  // First replace template variables with values
  let path = template.replace(/\${([^}]+)}/g, (match, field) => {
    // Cast field to keyof ThemaCode to ensure type safety
    const value = code[field as keyof ThemaCode]?.toString() || '';
    // Sanitize URL segments individually before any other transformations
    return field === 'CodeDescription' ? sanitizeUrlSegment(value) : value;
  });

  // Apply additional transformations
  if (transformations.includes('lowercase')) {
    path = path.toLowerCase();
  }
  if (transformations.includes('replace-spaces')) {
    path = path.replace(/\s+/g, '-');
  }

  return path;
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
  // Validate parent_id if provided
  if (parentId && parentId <= 0) {
    throw new Error(`Invalid parent_id: ${parentId}`);
  }

  const category: BigCommerceCategory = {
    name: mapField(config.name, code),
    description: mapField(config.description, code),
    is_visible: config.is_visible,
    tree_id: treeId,
    parent_id: parentId || undefined // Explicitly set parent_id
  };

  if (config.url) {
    category.url = {
      is_customized: true,
      path: buildUrlPath(config.url.path, code, config.url.transformations)
    };
  }

  return category;
} 