const { logger } = require('../../utils/logger');
const config = require('../../config');
const { 
  chunk, 
  delay, 
  extractCookiesWithPuppeteer,
  randomWait,
  retry
} = require('../../utils/scraper-utils');
const lkqApi = require('./api');
const { mapProductToPart } = require('./mapper');
const { getRandomUserAgent } = require('../../utils/user-agents');

/**
 * Scraper for LKQ Online (https://www.lkqonline.com/)
 * Fetches product data from the LKQ API
 */
class LkqScraper {
  constructor() {
    this.name = 'lkq';
    this.baseUrl = config.scrapers.lkq.baseUrl;
    this.apiUrl = config.scrapers.lkq.apiUrl;
    this.batchSize = config.scrapers.lkq.batchSize;
    this.requestDelay = config.scrapers.lkq.requestDelay;
    this.parallelRequests = config.scrapers.lkq.parallelRequests;
    this.cookies = config.scrapers.lkq.cookies;
  }

  /**
   * Initialize the scraper
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.info('Initializing LKQ scraper');
    
    // Verify API URL format
    const apiUrl = config.scrapers.lkq.apiUrl;
    if (!apiUrl.includes('/api/')) {
      logger.warn(`API URL format may be incorrect: ${apiUrl}`);
      logger.warn('The expected format should include "/api/" in the path');
      
      // Try to fix the URL
      if (apiUrl.endsWith('/')) {
        config.scrapers.lkq.apiUrl = `${apiUrl}api/catalog/0/product`;
      } else {
        config.scrapers.lkq.apiUrl = `${apiUrl}/api/catalog/0/product`;
      }
      
      logger.info(`Updated API URL to: ${config.scrapers.lkq.apiUrl}`);
    }
    
    // Check if we have predefined category URLs
    if (config.scrapers.lkq.categoryUrls && config.scrapers.lkq.categoryUrls.length > 0) {
      logger.info(`Found ${config.scrapers.lkq.categoryUrls.length} predefined category URLs in config`);
      for (let i = 0; i < config.scrapers.lkq.categoryUrls.length; i++) {
        logger.debug(`Category URL ${i+1}: ${config.scrapers.lkq.categoryUrls[i]}`);
      }
    } else {
      logger.info('No predefined category URLs found in config, will use dynamic URL generation');
    }
    
    // Try to get cookies if none are provided
    if (!this.cookies) {
      logger.info('No cookies configured, attempting to get cookies from website');
      try {
        this.cookies = await extractCookiesWithPuppeteer(this.baseUrl);
        if (this.cookies) {
          logger.info('Successfully obtained cookies from website');
          // Update cookies in the config
          config.scrapers.lkq.cookies = this.cookies;
        } else {
          logger.warn('Failed to obtain cookies, scraping may fail');
        }
      } catch (error) {
        logger.error(`Error getting cookies: ${error.message}`);
      }
    }
    
    try {
      // Initialize the API client
      await lkqApi.initializeApi();
      logger.info('LKQ scraper initialized successfully');
    } catch (error) {
      logger.error(`LKQ scraper initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get available scraper categories
   * @returns {Array} - Available categories
   */
  getAvailableCategories() {
    return config.scrapers.lkq.categories;
  }

  /**
   * Fetch products for a category with pagination
   * @param {string} category - Product category
   * @param {number} maxProducts - Maximum number of products to fetch (defaults to all)
   * @returns {Promise<Array>} - Product data
   */
  async fetchProductsByCategory(category, maxProducts = Infinity) {
    logger.info(`Fetching products for category: ${category} (max: ${maxProducts === Infinity ? 'unlimited' : maxProducts})`);
    
    let allProducts = [];
    let skip = 0;
    let hasMore = true;
    let consecutiveErrors = 0;
    const maxRetries = config.scrapers.retryAttempts;
    
    try {
      // Get category counts to estimate total
      const countsData = await lkqApi.getCategoryCounts(category);
      const totalEstimate = countsData?.totalCount || 'unknown';
      logger.info(`Category ${category} has approximately ${totalEstimate} products`);
      
      // Continue fetching until we get all products or reach maxProducts
      while (hasMore && allProducts.length < maxProducts && consecutiveErrors < maxRetries) {
        try {
          const take = Math.min(this.batchSize, maxProducts - allProducts.length);
          
          // Fetch a batch of products
          const response = await lkqApi.getSearchResults(category, skip, take);
          
          if (!response || !Array.isArray(response.data)) {
            throw new Error(`Invalid response format: ${JSON.stringify(response).substring(0, 100)}...`);
          }
          
          const products = response.data;
          
          // Check if we got any products
          if (products.length === 0) {
            logger.info(`No more products found for category ${category}`);
            hasMore = false;
            break;
          }
          
          // Reset consecutive errors on success
          consecutiveErrors = 0;
          
          // Add products to our collection
          allProducts = [...allProducts, ...products];
          
          logger.info(`Fetched batch of ${products.length} products, total: ${allProducts.length}`);
          
          // Check if we have more products to fetch based on total count in response
          if (response.count) {
            const totalCount = parseInt(response.count, 10);
            hasMore = (skip + take) < totalCount;
            logger.info(`Progress: ${allProducts.length}/${totalCount} products (${Math.round(allProducts.length / totalCount * 100)}%)`);
          } else {
            // If no count is provided, use the batch size to determine if there might be more
            hasMore = products.length === take;
          }
          
          // Update skip for the next request
          skip += take;
          
          // Respect maxProducts limit
          if (allProducts.length >= maxProducts) {
            logger.info(`Reached max products limit: ${maxProducts}`);
            break;
          }
          
          // Add a delay between batches to avoid rate limiting
          if (hasMore) {
            await randomWait(1000, 3000); // Use random wait instead of fixed delay
          }
        } catch (error) {
          consecutiveErrors++;
          logger.error(`Error fetching batch (skip=${skip}): ${error.message}. Attempt ${consecutiveErrors}/${maxRetries}`);
          
          if (consecutiveErrors >= maxRetries) {
            logger.error(`Max retries (${maxRetries}) reached. Stopping pagination.`);
            break;
          }
          
          // Exponential backoff with randomization
          const baseBackoff = 1000 * Math.pow(2, consecutiveErrors);
          const randomizedBackoff = baseBackoff + Math.floor(Math.random() * 1000);
          logger.info(`Waiting ${randomizedBackoff}ms before retry`);
          await delay(randomizedBackoff);
        }
      }
      
      // Trim to maxProducts if needed
      if (allProducts.length > maxProducts) {
        allProducts = allProducts.slice(0, maxProducts);
      }
      
      logger.info(`Completed fetching products for category "${category}". Total: ${allProducts.length} products`);
      
      return allProducts;
    } catch (error) {
      logger.error(`Failed to fetch products for category "${category}": ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch products using a predefined URL
   * @param {string} url - Full URL to fetch products from
   * @param {number} maxProducts - Maximum number of products to fetch
   * @returns {Promise<Array>} - Product data
   */
  async fetchProductsByUrl(url, maxProducts = Infinity) {
    logger.info(`Fetching products from URL: ${url}`);
    
    // Initialize variables
    let skip = 0;
    const take = 50; // Default page size
    let hasMore = true;
    let allProducts = [];
    let consecutiveErrors = 0;
    const maxRetries = 3;
    
    // Parse the URL to use as a template for pagination
    if (!url) {
      throw new Error('URL is required');
    }
    
    try {
      // Continue fetching until we get all products or reach maxProducts
      while (hasMore && allProducts.length < maxProducts && consecutiveErrors < maxRetries) {
        try {
          // Create a new URL with updated skip parameter
          const urlObj = new URL(url);
          urlObj.searchParams.set('skip', skip.toString());
          const currentTake = Math.min(take, maxProducts - allProducts.length);
          urlObj.searchParams.set('take', currentTake.toString());
          
          // Make the request using our API module which will use random user agents
          logger.info(`Making request to: ${urlObj.toString()}`);
          const response = await lkqApi.makeApiRequest('', Object.fromEntries(urlObj.searchParams.entries()));
          
          if (!response || !Array.isArray(response.data)) {
            throw new Error(`Invalid response format: ${JSON.stringify(response).substring(0, 100)}...`);
          }
          
          const products = response.data;
          
          // Check if we got any products
          if (products.length === 0) {
            logger.info(`No more products found for URL`);
            hasMore = false;
            break;
          }
          
          // Reset consecutive errors on success
          consecutiveErrors = 0;
          
          // Add products to our collection
          allProducts = [...allProducts, ...products];
          
          logger.info(`Fetched batch of ${products.length} products, total: ${allProducts.length}`);
          
          // Check if we have more products to fetch based on total count in response
          if (response.count) {
            const totalCount = parseInt(response.count, 10);
            hasMore = (skip + take) < totalCount;
            logger.info(`Progress: ${allProducts.length}/${totalCount} products (${Math.round(allProducts.length / totalCount * 100)}%)`);
          } else {
            // If no count is provided, use the batch size to determine if there might be more
            hasMore = products.length === currentTake;
          }
          
          // Update skip for the next request
          skip += currentTake;
          
          // Respect maxProducts limit
          if (allProducts.length >= maxProducts) {
            logger.info(`Reached max products limit: ${maxProducts}`);
            break;
          }
          
          // Add a delay between batches to avoid rate limiting
          if (hasMore) {
            await randomWait(1000, 3000); // Use random wait instead of fixed delay
          }
        } catch (error) {
          consecutiveErrors++;
          logger.error(`Error fetching batch (skip=${skip}): ${error.message}. Attempt ${consecutiveErrors}/${maxRetries}`);
          
          if (consecutiveErrors >= maxRetries) {
            logger.error(`Max retries (${maxRetries}) reached. Stopping pagination.`);
            break;
          }
          
          // Exponential backoff
          const backoffTime = this.requestDelay * Math.pow(2, consecutiveErrors);
          logger.info(`Waiting ${backoffTime}ms before retry`);
          await delay(backoffTime);
        }
      }
      
      // Trim to maxProducts if needed
      if (allProducts.length > maxProducts) {
        allProducts = allProducts.slice(0, maxProducts);
      }
      
      logger.info(`Completed fetching products from URL. Total: ${allProducts.length} products`);
      
      return allProducts;
    } catch (error) {
      logger.error(`Failed to fetch products from URL "${url}": ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch detailed product information for a list of products
   * @param {Array} products - Basic product data
   * @param {boolean} includeImages - Whether to include image data
   * @returns {Promise<Array>} - Products with detailed information
   */
  async fetchProductDetails(products, includeImages = false) {
    if (!products || !Array.isArray(products) || products.length === 0) {
      logger.warn('No products provided to fetch details');
      return [];
    }
    
    logger.info(`Fetching details for ${products.length} products`);
    
    // Process products in batches to control parallelism
    const batches = chunk(products, this.parallelRequests);
    const productsWithDetails = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.info(`Processing batch ${i+1}/${batches.length} (${batch.length} products)`);
      
      // Process each batch in parallel
      const detailsPromises = batch.map(async (product) => {
        try {
          // Use the product ID to fetch details
          const productId = product.id || product.productId;
          if (!productId) {
            logger.warn(`Product is missing ID: ${JSON.stringify(product).substring(0, 100)}...`);
            return product;
          }
          
          const details = await lkqApi.getProductDetails(productId);
          
          if (!details) {
            logger.warn(`No details returned for product ${productId}`);
            return product;
          }
          
          // Merge the details with the product data
          return { ...product, details };
        } catch (error) {
          logger.error(`Error fetching details for product: ${error.message}`);
          return product;
        }
      });
      
      // Wait for all promises in the batch to resolve
      const batchResults = await Promise.all(detailsPromises);
      productsWithDetails.push(...batchResults);
      
      // Add delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await randomWait(1500, 3500); // Use random wait instead of fixed delay
      }
    }
    
    logger.info(`Fetched details for ${productsWithDetails.length} products`);
    return productsWithDetails;
  }

  /**
   * Map API products to database model
   * @param {Array} products - API product data
   * @returns {Array} - Mapped products
   */
  mapProducts(products) {
    logger.info(`Mapping ${products.length} products to database model`);
    
    const mappedProducts = products.map(product => {
      try {
        return mapProductToPart(product);
      } catch (error) {
        logger.error(`Error mapping product: ${error.message}`);
        return null;
      }
    }).filter(Boolean);
    
    logger.info(`Successfully mapped ${mappedProducts.length} products`);
    return mappedProducts;
  }

  /**
   * Run the scraper for one or more categories or URLs
   * @param {string|Array} categories - Category, array of categories, or URLs to scrape
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - Scraped products
   */
  async scrape(categories, options = {}) {
    const {
      maxProducts = Infinity,
      fetchDetails = true,
      usePresetUrls = false
    } = options;
    
    // Normalize categories to array
    const categoryList = Array.isArray(categories) ? categories : [categories];
    
    if (categoryList.length === 0) {
      logger.error('No categories provided to scrape');
      return [];
    }
    
    logger.info(`Starting LKQ scraper for ${categoryList.length} categories/URLs`);
    
    try {
      // Initialize the scraper
      await this.initialize();
      
      let allProducts = [];
      
      // Check if we should use preset URLs from config
      if (usePresetUrls && config.scrapers.lkq.categoryUrls && config.scrapers.lkq.categoryUrls.length > 0) {
        logger.info(`Using ${config.scrapers.lkq.categoryUrls.length} preset URLs from config`);
        
        // Process each URL from config
        for (const url of config.scrapers.lkq.categoryUrls) {
          logger.info(`Processing URL: ${url}`);
          
          // Calculate how many products to fetch
          const remainingProducts = maxProducts - allProducts.length;
          if (remainingProducts <= 0) {
            logger.info('Reached maximum product limit, skipping remaining URLs');
            break;
          }
          
          // Fetch products for this URL
          const products = await this.fetchProductsByUrl(url, remainingProducts);
          
          if (products.length === 0) {
            logger.warn(`No products found for URL ${url}`);
            continue;
          }
          
          logger.info(`Fetched ${products.length} products from URL ${url}`);
          
          // Fetch detailed information if requested
          let productsWithDetails = products;
          if (fetchDetails) {
            productsWithDetails = await this.fetchProductDetails(products);
          }
          
          // Add products to the total
          allProducts = [...allProducts, ...productsWithDetails];
          
          logger.info(`Completed processing URL, total products: ${allProducts.length}`);
        }
      } else {
        // Process each category
        for (const category of categoryList) {
          // Check if the category is a URL
          if (category.startsWith('http')) {
            logger.info(`Processing URL: ${category}`);
            
            // Calculate how many products to fetch
            const remainingProducts = maxProducts - allProducts.length;
            if (remainingProducts <= 0) {
              logger.info('Reached maximum product limit, skipping remaining URLs');
              break;
            }
            
            // Fetch products for this URL
            const products = await this.fetchProductsByUrl(category, remainingProducts);
            
            if (products.length === 0) {
              logger.warn(`No products found for URL ${category}`);
              continue;
            }
            
            logger.info(`Fetched ${products.length} products from URL ${category}`);
            
            // Fetch detailed information if requested
            let productsWithDetails = products;
            if (fetchDetails) {
              productsWithDetails = await this.fetchProductDetails(products);
            }
            
            // Add products to the total
            allProducts = [...allProducts, ...productsWithDetails];
            
            logger.info(`Completed processing URL, total products: ${allProducts.length}`);
          } else {
            logger.info(`Processing category: ${category}`);
            
            // Calculate how many products to fetch from this category
            const remainingProducts = maxProducts - allProducts.length;
            if (remainingProducts <= 0) {
              logger.info('Reached maximum product limit, skipping remaining categories');
              break;
            }
            
            // Fetch products for this category
            const products = await this.fetchProductsByCategory(category, remainingProducts);
            
            if (products.length === 0) {
              logger.warn(`No products found for category ${category}`);
              continue;
            }
            
            logger.info(`Fetched ${products.length} products from category ${category}`);
            
            // Fetch detailed information if requested
            let productsWithDetails = products;
            if (fetchDetails) {
              productsWithDetails = await this.fetchProductDetails(products);
            }
            
            // Add products to the total
            allProducts = [...allProducts, ...productsWithDetails];
            
            logger.info(`Completed processing category ${category}, total products: ${allProducts.length}`);
          }
        }
      }
      
      // Map products to database model
      const mappedProducts = this.mapProducts(allProducts);
      
      logger.info(`LKQ scraper completed, scraped ${mappedProducts.length} products`);
      return mappedProducts;
    } catch (error) {
      logger.error(`LKQ scraper failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new LkqScraper(); 