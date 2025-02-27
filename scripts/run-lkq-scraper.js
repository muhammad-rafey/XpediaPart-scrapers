#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const { logger } = require('../src/utils/logger');
const lkqScraper = require('../src/scrapers/lkq');
const { createScraperJob, updateScraperJob, storeScrapedData } = require('../src/services/storage');
const config = require('../src/config');
const fs = require('fs');

/**
 * LKQ Scraper Test Script
 * -----------------------
 * 
 * This script runs the LKQ scraper with the specified parameters
 * and stores the results in MongoDB.
 * 
 * Usage:
 *   ./scripts/run-lkq-scraper.js [query] [batchSize] [maxProducts] [cookiesFile] [usePresetUrls]
 * 
 * Parameters:
 *   - query: Category path to scrape (defaults to 'Engine Compartment|Alternator')
 *   - batchSize: Number of products to fetch per batch (defaults to config value)
 *   - maxProducts: Maximum number of products to scrape (defaults to 100)
 *   - cookiesFile: Path to cookies file (optional)
 *   - usePresetUrls: Whether to use preset URLs from config (true/false, defaults to false)
 * 
 * Examples:
 *   ./scripts/run-lkq-scraper.js "Engine Compartment|Alternator" 20 50 cookies.txt
 *   ./scripts/run-lkq-scraper.js "Engine Compartment|Alternator" 20 50 cookies.txt true
 */

// Parse command line arguments
const args = process.argv.slice(2);
const query = args[0] || 'Engine Compartment|Alternator';
const batchSize = args[1] ? parseInt(args[1], 10) : config.scrapers.lkq.batchSize;
const maxProducts = args[2] ? parseInt(args[2], 10) : 10000;
const cookiesFile = args[3] || null;
const usePresetUrls = args[4] === 'true';

/**
 * Main function
 */
async function main() {
  // Create a job ID at the beginning so it can be used throughout the function
  const jobId = Date.now().toString();
  
  try {
    logger.info('Starting LKQ scraper test script');
    logger.info(`Query: ${query}`);
    logger.info(`Batch size: ${batchSize}`);
    logger.info(`Max products: ${maxProducts}`);
    logger.info(`Use preset URLs: ${usePresetUrls}`);
    
    if (usePresetUrls) {
      const numUrls = config.scrapers.lkq.categoryUrls ? config.scrapers.lkq.categoryUrls.length : 0;
      logger.info(`Found ${numUrls} preset URLs in configuration`);
      
      if (numUrls === 0) {
        logger.warn('No preset URLs found in configuration. Add URLs to config.scrapers.lkq.categoryUrls array.');
        logger.info('Falling back to using the query parameter.');
      }
    }
    
    // Load cookies from file if provided
    let cookies = '';
    if (cookiesFile) {
      try {
        logger.info(`Loading cookies from file: ${cookiesFile}`);
        cookies = fs.readFileSync(cookiesFile, 'utf8').trim();
        logger.info('Cookies loaded successfully');
      } catch (error) {
        logger.error(`Error loading cookies from file: ${error.message}`);
      }
    }
    
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info('Connected to MongoDB');
    
    // Create a scraper job
    await createScraperJob({
      jobId,
      source: 'lkq',
      query,
      options: { 
        batchSize, 
        maxProducts,
        usePresetUrls 
      },
      status: 'pending'
    });
    
    logger.info(`Created scraper job: ${jobId}`);
    
    // Update job status to running
    await updateScraperJob(jobId, { status: 'running', startTime: new Date() });
    
    // Configure the scraper
    if (cookies) {
      config.scrapers.lkq.cookies = cookies;
    }
    
    if (batchSize) {
      config.scrapers.lkq.batchSize = batchSize;
    }
    
    // Run the scraper
    logger.info('Running LKQ scraper...');
    const startTime = Date.now();
    
    const products = await lkqScraper.scrape(query, { 
      maxProducts,
      fetchDetails: true,
      usePresetUrls
    });
    
    const duration = (Date.now() - startTime) / 1000;
    logger.info(`Scraper completed in ${duration.toFixed(2)} seconds`);
    logger.info(`Scraped ${products.length} products`);
    
    // Store the scraped products in the database
    if (products.length > 0) {
      logger.info(`Storing ${products.length} products in the database...`);
      const storageResult = await storeScrapedData('lkq', products, { jobId });
      logger.info(`Storage complete: ${storageResult.created} created, ${storageResult.updated} updated, ${storageResult.failed} failed`);
    } else {
      logger.warn('No products to store in the database');
    }
    
    // Update job status to completed
    await updateScraperJob(jobId, {
      status: 'completed',
      endTime: new Date(),
      duration,
      itemsScraped: products.length
    });
    
    // Display some sample data
    if (products.length > 0) {
      logger.info('Sample product:');
      const sample = JSON.stringify(products[0], null, 2).substring(0, 500) + '...';
      logger.info(sample);
    }
    
    // Close MongoDB connection
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    
    logger.info('Script completed successfully');
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    
    // Try to update job status if error occurs
    try {
      await updateScraperJob(jobId, {
        status: 'failed',
        endTime: new Date(),
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    } catch (dbError) {
      logger.error(`Error updating job status: ${dbError.message}`);
    }
    
    // Close MongoDB connection
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      logger.error(`Error disconnecting from MongoDB: ${disconnectError.message}`);
    }
    
    process.exit(1);
  }
}

// Run the script
main();

 