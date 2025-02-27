const express = require('express');
const router = express.Router();

const scraperController = require('./controllers/scraper.controller');

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Scraper routes
router.get('/scrapers', scraperController.listScrapers);
router.post('/scrapers/lkq', scraperController.runLkqScraper);

// Job status routes
router.get('/scrapers/jobs/:jobId', scraperController.getScraperJobStatus);

// Add routes for other scrapers here
// router.post('/scrapers/other-scraper', scraperController.runOtherScraper);

module.exports = router; 