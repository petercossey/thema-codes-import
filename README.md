# Thema Import Script

A TypeScript command-line tool that imports Thema subject codes into BigCommerce store categories.

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
│   ├── db.ts                # SQLite database handler
│   ├── mapper.ts            # Field mapping logic  
│   ├── bigcommerce.ts       # API client
│   └── utils/
│       └── logger.ts        # Logging utility
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## License

ISC 