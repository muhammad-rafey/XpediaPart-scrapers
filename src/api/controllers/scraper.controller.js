const { logger } = require('../../utils/logger');
const lkqScraper = require('../../scrapers/lkq');
const storageService = require('../../services/storage');

/**
 * List all available scrapers
 */
const listScrapers = async (req, res) => {
  try {
    const scrapers = [
      {
        id: 'lkq',
        name: 'LKQ Auto Parts',
        description: 'Scraper for LKQ auto parts website',
        status: 'active',
        categories: lkqScraper.getAvailableCategories(),
      },
      // Add other scrapers here as they are implemented
    ];

    return res.status(200).json({ scrapers });
  } catch (error) {
    logger.error(`Error listing scrapers: ${error.message}`);
    return res.status(500).json({ error: 'Failed to list scrapers' });
  }
};

/**
 * Run the LKQ scraper
 */
const runLkqScraper = async (req, res) => {
  try {
    const { query, options = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Generate a job ID
    const jobId = Date.now().toString();
    
    // Merge options with job ID
    const scraperOptions = {
      ...options,
      jobId,
    };
    
    logger.info(`Starting LKQ scraper with query: ${query} and options: ${JSON.stringify(scraperOptions)}`);
    
    // Start the scraper in the background and return immediately
    res.status(202).json({ 
      message: 'Scraper started successfully', 
      query,
      jobId,
      options: scraperOptions
    });
    
    try {
      // Run the scraper
      const scrapedData = await lkqScraper.scrape(query, scraperOptions);
      
      // Store the data
      const storageResult = await storageService.storeScrapedData('lkq', scrapedData, { jobId });
      
      logger.info(`LKQ scraper completed for query: ${query}. Storage result: ${JSON.stringify({
        total: storageResult.total,
        created: storageResult.created,
        updated: storageResult.updated,
        failed: storageResult.failed
      })}`);
    } catch (error) {
      logger.error(`Error in LKQ scraper job ${jobId}: ${error.message}`);
      // We already returned a response to the client, so we just log the error
    }
  } catch (error) {
    logger.error(`Error starting LKQ scraper: ${error.message}`);
    return res.status(500).json({ error: 'Failed to start scraper' });
  }
};

/**
 * Get the status of a scraper job
 */
const getScraperJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    const job = await storageService.getScraperJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Scraper job not found' });
    }
    
    return res.status(200).json({
      jobId: job.jobId,
      source: job.source,
      query: job.query,
      status: job.status,
      startTime: job.startTime,
      endTime: job.endTime,
      duration: job.duration,
      itemsScraped: job.itemsScraped,
      error: job.error ? {
        message: job.error.message
      } : null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    logger.error(`Error getting scraper job status: ${error.message}`);
    return res.status(500).json({ error: 'Failed to get scraper job status' });
  }
};

module.exports = {
  listScrapers,
  runLkqScraper,
  getScraperJobStatus,
}; 