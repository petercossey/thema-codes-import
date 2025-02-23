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
npm start -- --config=config.json --source=thema-codes.json
```

## Development

For local development, you can use:

```bash
npm run dev -- --config=config.json --source=thema-codes.json
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
│   └── utils/
│       └── logger.ts        # Logging utility
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## License

ISC 