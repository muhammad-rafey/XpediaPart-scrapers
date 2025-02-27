const { Part, ScraperJob } = require('../../models');
const { logger } = require('../../utils/logger');

/**
 * Store scraped data in the database
 * @param {string} source - The source of the data (e.g., 'lkq')
 * @param {Array} data - The scraped data to store
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Result of the storage operation
 */
const storeScrapedData = async (source, data, options = {}) => {
  const { jobId, updateTotalOnly = false, currentTotal = 0 } = options;
  
  try {
    logger.info(`Storing ${data.length} items from ${source}`);
    
    // Update job status if jobId is provided and not just updating totals
    if (jobId && !updateTotalOnly) {
      await ScraperJob.findOneAndUpdate(
        { jobId },
        { 
          status: 'running',
          ...(currentTotal === 0 ? { startTime: new Date() } : {})
        }
      );
    }
    
    const result = {
      total: data.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };
    
    // Process each item in the scraped data
    for (const item of data) {
      try {
        // Add source to the item
        item.source = source;
        
        // Check if the part already exists
        const existingPart = await Part.findOne({
          partNumber: item.partNumber,
          source,
        });
        
        if (existingPart) {
          // Update existing part
          await Part.findByIdAndUpdate(existingPart._id, item);
          result.updated++;
        } else {
          // Create new part
          await Part.create(item);
          result.created++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          partNumber: item.partNumber,
          error: error.message,
        });
        logger.error(`Error storing part ${item.partNumber}: ${error.message}`);
      }
    }
    
    // Update job status if jobId is provided
    if (jobId) {
      const totalItemsScraped = currentTotal + result.created + result.updated;
      
      // Update the job with the latest counts without changing status to completed
      if (updateTotalOnly) {
        await ScraperJob.findOneAndUpdate(
          { jobId },
          { 
            itemsScraped: totalItemsScraped,
            lastBatchTime: new Date()
          }
        );
      } else {
        // If not just updating totals, update job as completed
        const endTime = new Date();
        const startTime = await ScraperJob.findOne({ jobId }).select('startTime');
        const duration = startTime ? (endTime - startTime.startTime) / 1000 : 0;
        
        await ScraperJob.findOneAndUpdate(
          { jobId },
          { 
            status: 'completed',
            endTime,
            duration,
            itemsScraped: totalItemsScraped,
          }
        );
      }
    }
    
    logger.info(`Storage complete: ${result.created} created, ${result.updated} updated, ${result.failed} failed`);
    
    // Return the results along with the updated total
    return {
      ...result,
      totalItemsScraped: currentTotal + result.created + result.updated
    };
  } catch (error) {
    logger.error(`Error in storeScrapedData: ${error.message}`);
    
    // Update job status if jobId is provided and we're not just updating totals
    if (jobId && !updateTotalOnly) {
      await ScraperJob.findOneAndUpdate(
        { jobId },
        { 
          status: 'failed',
          endTime: new Date(),
          error: {
            message: error.message,
            stack: error.stack,
          },
        }
      );
    }
    
    throw error;
  }
};

/**
 * Create a new scraper job
 * @param {Object} jobData - The job data
 * @returns {Promise<Object>} - The created job
 */
const createScraperJob = async (jobData) => {
  try {
    const job = await ScraperJob.create({
      ...jobData,
      itemsScraped: 0, // Initialize to 0
      lastBatchTime: new Date()
    });
    return job;
  } catch (error) {
    logger.error(`Error creating scraper job: ${error.message}`);
    throw error;
  }
};

/**
 * Update a scraper job
 * @param {string} jobId - The job ID
 * @param {Object} updateData - The data to update
 * @returns {Promise<Object>} - The updated job
 */
const updateScraperJob = async (jobId, updateData) => {
  try {
    const job = await ScraperJob.findOneAndUpdate(
      { jobId },
      updateData,
      { new: true }
    );
    return job;
  } catch (error) {
    logger.error(`Error updating scraper job: ${error.message}`);
    throw error;
  }
};

/**
 * Get a scraper job by ID
 * @param {string} jobId - The job ID
 * @returns {Promise<Object>} - The job
 */
const getScraperJob = async (jobId) => {
  try {
    const job = await ScraperJob.findOne({ jobId });
    return job;
  } catch (error) {
    logger.error(`Error getting scraper job: ${error.message}`);
    throw error;
  }
};

/**
 * List scraper jobs with pagination and filtering
 * @param {Object} filters - The filters to apply
 * @param {Object} options - Options for pagination and sorting
 * @returns {Promise<Object>} - The list of jobs and count
 */
const listScraperJobs = async (filters = {}, options = {}) => {
  try {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    
    const skip = (page - 1) * limit;
    
    // Build query from filters
    const query = {};
    
    if (filters.source) {
      query.source = filters.source;
    }
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    } else if (filters.startDate) {
      query.createdAt = { $gte: new Date(filters.startDate) };
    } else if (filters.endDate) {
      query.createdAt = { $lte: new Date(filters.endDate) };
    }
    
    // Get total count
    const total = await ScraperJob.countDocuments(query);
    
    // Get jobs with pagination
    const jobs = await ScraperJob.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    return {
      jobs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error(`Error listing scraper jobs: ${error.message}`);
    throw error;
  }
};

module.exports = {
  storeScrapedData,
  createScraperJob,
  updateScraperJob,
  getScraperJob,
  listScraperJobs,
}; 