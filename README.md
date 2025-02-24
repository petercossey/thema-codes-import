# Thema Import Script

A TypeScript command-line tool that imports Thema subject codes into BigCommerce store categories.

## Disclaimer

This program is provided as-is, without any warranties or guarantees of any kind, express or implied. It is intended as a proof of concept only. The authors accept no liability for any data loss or other damages resulting from its use.

## AI Attribution

Significant portions of this codebase were generated with the assistance of AI coding tools. While efforts have been made to verify the code's functionality, users should review and test thoroughly before use in any critical environments.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Run tests:
```bash
npm test
```

## Usage

Create a config.json file with your BigCommerce credentials and run:

```bash
npm start -- --config=config.json --source=data/thema-codes.json
```

### Command Line Arguments

- `--config` or `-c`: Path to the configuration JSON file (required)
- `--source` or `-s`: Path to the Thema codes JSON file (required)
- `--help`: Display help information

### Configuration File Structure

The configuration file (config.json) should contain:

```json
{
  "bigcommerce": {
    "storeHash": "your-store-hash",
    "apiToken": "your-api-token",
    "apiVersion": "v3"
  },
  "import": {
    "parentCategoryId": 42,
    "categoryTreeId": 1
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

## Development

For local development, you can use:

```bash
npm run dev -- --config=config.json --source=data/thema-codes.json
```

## Project Structure

```
/
├── src/
│   ├── index.ts             # Main entry point
│   ├── config.ts            # Configuration loader
│   ├── types/
│   │   └── config.ts        # Configuration types
│   │   └── bigcommerce.ts   # BigCommerce API types
│   │   └── thema.ts         # Thema API types
│   │   └── database.ts      # Database types
│   ├── db.ts                # SQLite database handler
│   ├── mapper.ts            # Field mapping logic
│   ├── bigcommerce.ts       # API client
│   ├── processor.ts         # Main processing logic
│   ├── data-loader.ts       # Data loading and validation
│   └── utils/
│       └── logger.ts        # Logging utility
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## License

ISC 

### Source Data Format

The source JSON file should contain an array of Thema codes with the following structure:

```json
{
  "CodeList": {
    "ThemaCodes": {
      "Code": [
        {
          "CodeValue": "ABA",
          "CodeDescription": "Theory of art",
          "CodeNotes": "Usage information",
          "CodeParent": "",
          "IssueNumber": 1,
          "Modified": "2024-02-28"
        },
        {
          "CodeValue": "ABAA",
          "CodeDescription": "Art techniques",
          "CodeNotes": "Child category",
          "CodeParent": "ABA",
          "IssueNumber": 1,
          "Modified": "2024-02-28"
        }
      ]
    }
  }
}
```

Required fields:
- `CodeValue`: Unique identifier for the Thema code
- `CodeDescription`: Human-readable description
- `CodeNotes`: Additional information about the code
- `CodeParent`: Parent code (empty string for top-level codes)
- `IssueNumber`: Version number
- `Modified`: Last modification date (string or timestamp)

The script validates:
- All required fields are present
- Field types match the expected format
- Parent codes exist in the dataset
- JSON structure is valid 

### Database Structure

The script uses SQLite to track import progress. The database schema includes:

```sql
CREATE TABLE import_progress (
  code_value TEXT PRIMARY KEY,
  code_description TEXT NOT NULL,
  parent_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Status values:
- `pending`: Code not yet processed
- `in_progress`: Currently being imported
- `completed`: Successfully imported
- `failed`: Import failed

The database file location is specified in the configuration file via the `database` property. 