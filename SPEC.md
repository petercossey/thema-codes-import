# Thema Import Script Specification

## Overview

A TypeScript command-line tool that imports Thema subject codes into BigCommerce store categories. The script reads from a JSON source file, transforms the data according to simple mapping rules, and creates categories via the BigCommerce API.

## Requirements

1. Import Thema codes as BigCommerce categories
2. Allow importing under an existing parent category
3. Support customizable URL paths using Thema code fields
4. Track import progress using a local SQLite database

## Implementation

### Command Line Interface

```
thema-import --config=config.json --source=thema-codes.json
```

### Configuration File (config.json)

```json
{
  "bigcommerce": {
    "storeHash": "abc123",
    "apiToken": "your-api-token",
    "apiVersion": "v3"
  },
  "import": {
    "parentCategoryId": 42,
    "categoryTreeId": 1,
    "batchSize": 50
  },
  "mapping": {
    "name": "${CodeDescription}",
    "description": "<p>${CodeNotes}</p>",
    "url": {
      "path": "/${CodeValue}/${CodeDescription}/",
      "transformations": ["lowercase", "replace-spaces"]
    },
    "is_visible": true
  },
  "database": "import-progress.db"
}
```

### Data Model

**Source Data (Thema Codes)**
```typescript
interface ThemaCode {
  CodeValue: string;        // e.g., "ABA"
  CodeDescription: string;  // e.g., "Theory of art"
  CodeNotes: string;        // Usage information
  CodeParent: string;       // Parent code, empty for top-level
  IssueNumber: number;
  Modified: string | number;
}
```

**Target Data (BigCommerce Category)**
```typescript
interface BigCommerceCategory {
  name: string;
  parent_id?: number;
  tree_id: number;
  description?: string;
  is_visible?: boolean;
  url?: {
    path: string;
    is_customized: boolean;
  };
}
```

**Tracking Database Schema**
```sql
CREATE TABLE import_progress (
  code_value TEXT PRIMARY KEY,
  bc_category_id INTEGER,
  parent_code TEXT,
  status TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX idx_parent_code ON import_progress(parent_code);
CREATE INDEX idx_status ON import_progress(status);
```

### Program Flow

1. Parse command line arguments
2. Load configuration file
3. Initialize SQLite database
4. Load and validate Thema code data
5. Process codes in hierarchy order:
   - First pass: process top-level codes (empty CodeParent)
   - Subsequent passes: process child codes with known parents
6. For each code:
   - Check if already imported (from database)
   - Apply mapping template
   - Send to BigCommerce API
   - Record result in database
7. Generate import report

### Mapping Engine

A simple template-based mapper that supports:
- Field references: `${CodeValue}`
- Basic transformations: lowercase, replace spaces, truncate
- Default values

Example mapping function:
```typescript
function mapField(template: string, code: ThemaCode): string {
  return template.replace(/\${([^}]+)}/g, (match, field) => {
    return code[field] || '';
  });
}
```

### Parent Category Handling

1. If importing under an existing category:
   - Set `parent_id` to the configured `parentCategoryId` for top-level Thema codes
   - For child codes, look up parent's BigCommerce ID from database

2. For hierarchical import:
   - Store each created category's ID in the database
   - Process in order of hierarchy depth
   - Look up parent IDs from previous import steps

Example parent resolution:
```typescript
async function resolveParentId(code: ThemaCode, db: Database, config): Promise<number> {
  // For top-level codes with configured parent
  if (!code.CodeParent && config.import.parentCategoryId) {
    return config.import.parentCategoryId;
  }
  
  // For child codes, look up parent from database
  if (code.CodeParent) {
    const parent = await db.get(
      'SELECT bc_category_id FROM import_progress WHERE code_value = ?',
      [code.CodeParent]
    );
    
    if (parent) {
      return parent.bc_category_id;
    }
  }
  
  // Default: top-level category (no parent)
  return 0;
}
```

### URL Path Construction

Support custom URL paths using simple template and transformations:

```typescript
function buildUrlPath(template: string, code: ThemaCode, transformations: string[]): string {
  // Replace template variables
  let path = mapField(template, code);
  
  // Apply transformations
  if (transformations.includes('lowercase')) {
    path = path.toLowerCase();
  }
  
  if (transformations.includes('replace-spaces')) {
    path = path.replace(/\s+/g, '-');
  }
  
  return path;
}
```

### BigCommerce API Integration

Use Axios or Fetch to communicate with BigCommerce API:

```typescript
async function createCategory(category: BigCommerceCategory, config): Promise<number> {
  const response = await fetch(
    `https://api.bigcommerce.com/stores/${config.bigcommerce.storeHash}/v3/catalog/trees/categories`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': config.bigcommerce.apiToken
      },
      body: JSON.stringify([category])
    }
  );
  
  const result = await response.json();
  return result.data[0].category_id;
}
```

## Project Structure

```
/
├── src/
│   ├── index.ts             # Main entry point
│   ├── config.ts            # Configuration loader
│   ├── db.ts                # SQLite database handler
│   ├── mapper.ts            # Field mapping logic  
│   ├── bigcommerce.ts       # API client
│   └── utils.ts             # Helper functions
├── package.json
├── tsconfig.json
└── README.md
```

## Error Handling

- Log errors to console and file
- Retry failed API calls with exponential backoff
- Continue processing after errors, flagging failed items in database
- Generate error report at end of import

## Reporting

Generate summary report with:
- Total categories imported
- Failed imports
- Categories by level
- Import duration
- Missing parent categories