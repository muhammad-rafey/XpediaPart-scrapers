# XpediaPart Scrapers

A collection of web scrapers for retrieving product data from various automotive part suppliers and storing it in MongoDB.

## Features

- Multiple scraper implementations (currently LKQ)
- REST API for controlling scrapers
- MongoDB storage
- Job-based scraping
- Robust error handling

## Installation

#### Standard Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/XpediaPart-scrapers.git
   cd XpediaPart-scrapers
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment variables by creating a `.env` file based on `.env.example`
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your specific configuration values.

#### Docker Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/XpediaPart-scrapers.git
   cd XpediaPart-scrapers
   ```

2. Configure environment variables (optional, as they are defined in docker-compose.yml)
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file if you need to override any values.

3. Build and start the Docker containers
   ```bash
   docker-compose up -d
   ```

## Usage

#### Starting the API server

**Standard method:**
```bash
npm start
```

**Docker method:**
```bash
docker-compose up -d
```

The API will be available at `http://localhost:3000`.

#### API Endpoints

- `GET /health`: Health check endpoint
- `POST /api/scrapers/lkq/start`: Start the LKQ scraper
- `GET /api/scrapers/lkq/status/:jobId`: Check status of a scraper job

#### Running the LKQ scraper directly

**Via API:**
```bash
curl -X POST http://localhost:3000/api/scrapers/lkq/start -H "Content-Type: application/json" -d '{
  "categories": ["Engine Compartment|Alternator"],
  "batchSize": 10, 
  "maxProducts": 100
}'
```

**Via command line:**

Standard method:
```bash
node scripts/run-lkq-scraper.js "Engine Compartment|Alternator" 10 100
```

Docker method:
```bash
docker exec xpediapart-scrapers node scripts/run-lkq-scraper.js "Engine Compartment|Alternator" 10 100
```

### Docker Commands

#### Start the application and database
```bash
docker-compose up -d
```

#### View logs
```bash
docker-compose logs -f app
```

#### Stop the application
```bash
docker-compose down
```

#### Remove volumes (will delete database data)
```bash
docker-compose down -v
```

## Project Structure

```
XpediaPart-scrapers/
├── scripts/             # Utility scripts
├── src/
│   ├── api/             # API routes and controllers
│   ├── config/          # Configuration files
│   ├── models/          # Database models
│   ├── scrapers/        # Scraper implementations
│   │   └── lkq/         # LKQ scraper
│   ├── services/        # Service implementations
│   │   └── storage/     # Storage service
│   └── utils/           # Utility functions
├── .env                 # Environment variables
├── .env.example         # Example environment variables
├── package.json         # Dependencies and scripts
└── README.md            # This file
```

## Development

#### Running in development mode
```bash
npm run dev
```

#### Linting
```bash
npm run lint
```

## License

MIT