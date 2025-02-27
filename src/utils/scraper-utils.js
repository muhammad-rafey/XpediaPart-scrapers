const puppeteer = require('puppeteer');
const { logger } = require('./logger');
const config = require('../config');

/**
 * Launch a Puppeteer browser with default options
 * @returns {Promise<Browser>} - Puppeteer browser instance
 */
const launchBrowser = async () => {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
      timeout: 60000, // 60 second timeout for browser launch
    });
    
    return browser;
  } catch (error) {
    logger.error(`Error launching browser: ${error.message}`);
    throw error;
  }
};

/**
 * Wait for a random time between min and max milliseconds
 * @param {number} min - Minimum wait time in milliseconds
 * @param {number} max - Maximum wait time in milliseconds
 * @returns {Promise<void>}
 */
const randomWait = async (min = 1000, max = 3000) => {
  const waitTime = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, waitTime));
};

/**
 * Retry a function a specified number of times with exponential backoff
 * @param {Function} fn - The function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialDelay - Initial delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {Promise<any>} - The result of the function
 */
const retry = async (fn, maxRetries = 3, initialDelay = 1000, maxDelay = 30000) => {
  let retries = 0;
  let lastError;

  while (retries <= maxRetries) {
    try {
      if (retries > 0) {
        logger.info(`Retry attempt ${retries}/${maxRetries}`);
      }
      return await fn();
    } catch (error) {
      lastError = error;
      retries++;

      if (retries > maxRetries) {
        logger.error(`All ${maxRetries} retry attempts failed`);
        break;
      }

      // Calculate backoff delay with jitter
      const delay = Math.min(
        initialDelay * Math.pow(2, retries - 1) + Math.random() * 1000,
        maxDelay
      );

      logger.warn(`Attempt failed: ${error.message}. Retrying in ${Math.round(delay / 1000)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Delay execution for a specified time
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Split an array into chunks of a specified size
 * @param {Array} array - The array to split
 * @param {number} size - The size of each chunk
 * @returns {Array<Array>} - Array of chunks
 */
const chunk = (array, size) => {
  if (!array || !Array.isArray(array)) return [];
  
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Generate a random number between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Random number
 */
const randomNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Safely parse JSON without throwing errors
 * @param {string} str - JSON string to parse
 * @param {any} defaultValue - Default value to return if parsing fails
 * @returns {any} - Parsed object or default value
 */
const safeParseJSON = (str, defaultValue = {}) => {
  try {
    return str ? JSON.parse(str) : defaultValue;
  } catch (error) {
    logger.warn(`Failed to parse JSON: ${error.message}`);
    return defaultValue;
  }
};

/**
 * Extract text from a selector
 * @param {Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {string} defaultValue - Default value if selector not found
 * @returns {Promise<string>} - Extracted text
 */
const extractText = async (page, selector, defaultValue = '') => {
  try {
    const element = await page.$(selector);
    if (!element) return defaultValue;
    
    const text = await page.evaluate(el => el.textContent.trim(), element);
    return text || defaultValue;
  } catch (error) {
    logger.warn(`Error extracting text from ${selector}: ${error.message}`);
    return defaultValue;
  }
};

/**
 * Extract attribute from a selector
 * @param {Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {string} attribute - Attribute name
 * @param {string} defaultValue - Default value if selector or attribute not found
 * @returns {Promise<string>} - Extracted attribute value
 */
const extractAttribute = async (page, selector, attribute, defaultValue = '') => {
  try {
    const element = await page.$(selector);
    if (!element) return defaultValue;
    
    const value = await page.evaluate((el, attr) => el.getAttribute(attr) || '', element, attribute);
    return value || defaultValue;
  } catch (error) {
    logger.warn(`Error extracting ${attribute} from ${selector}: ${error.message}`);
    return defaultValue;
  }
};

/**
 * Parse cookies from a string into an object format
 * @param {string} cookieString - Cookie string (name=value; name2=value2)
 * @returns {Object[]} - Array of cookie objects with name and value properties
 */
const parseCookies = (cookieString) => {
  if (!cookieString) return [];
  
  return cookieString
    .split(';')
    .map(cookie => cookie.trim())
    .filter(cookie => cookie.length > 0)
    .map(cookie => {
      const [name, ...rest] = cookie.split('=');
      const value = rest.join('='); // Handle values that contain =
      return { name: name.trim(), value: value.trim() };
    });
};

/**
 * Get cookies string from an Axios response's headers
 * @param {Object} response - Axios response object
 * @returns {string} - Formatted cookie string
 */
const getCookiesFromResponse = (response) => {
  if (!response || !response.headers) {
    logger.warn('No headers in response');
    return '';
  }
  
  // Debug: log response headers for troubleshooting
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Response headers:');
    Object.keys(response.headers).forEach(key => {
      logger.debug(`  ${key}: ${response.headers[key]}`);
    });
  }
  
  // Try different header formats (case-insensitive)
  const cookieHeaders = response.headers['set-cookie'] || 
                       response.headers['Set-Cookie'] || 
                       response.headers['SET-COOKIE'];
  
  if (cookieHeaders) {
    if (Array.isArray(cookieHeaders)) {
      // Extract just the cookie name and value, not all the attributes
      return cookieHeaders
        .map(cookie => cookie.split(';')[0])
        .join('; ');
    } else if (typeof cookieHeaders === 'string') {
      return cookieHeaders.split(';')[0];
    }
  }
  
  // Check for request cookies that might have been used
  if (response.config && response.config.headers && response.config.headers.Cookie) {
    return response.config.headers.Cookie;
  }
  
  // Check if we can extract cookies from metadata or other sources
  if (response.request && response.request._header) {
    const cookieMatch = response.request._header.match(/Cookie: ([^\r\n]+)/);
    if (cookieMatch && cookieMatch[1]) {
      return cookieMatch[1];
    }
  }
  
  return '';
};

/**
 * Extract cookies from webpage using Puppeteer
 * @param {string} url - URL to visit
 * @returns {Promise<string>} - Formatted cookie string
 */
const extractCookiesWithPuppeteer = async (url) => {
  let browser = null;
  
  try {
    logger.info(`Extracting cookies from ${url} using Puppeteer`);
    
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    // Set viewport to desktop size
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
    );
    
    // Add additional headers to appear more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    });
    
    logger.info(`Navigating to ${url} with 60 second timeout...`);
    
    // Navigate to the URL with increased timeout
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 60000  // Increase timeout to 60 seconds
    });
    
    logger.info('Page loaded, waiting for additional scripts...');
    
    // Wait for any additional scripts to run
    await delay(5000);
    
    // Try to wait for a common element that would indicate the page is fully loaded
    try {
      await page.waitForSelector('header, nav, .header, #header', { timeout: 10000 });
      logger.info('Header/navigation element found');
    } catch (selectorError) {
      logger.warn(`Couldn't find navigation element: ${selectorError.message}`);
      // Continue anyway
    }
    
    // Get cookies
    const cookies = await page.cookies();
    logger.info(`Found ${cookies.length} cookies from ${url}`);
    
    // Log cookie names for debugging
    if (cookies.length > 0) {
      const cookieNames = cookies.map(c => c.name).join(', ');
      logger.info(`Cookie names: ${cookieNames}`);
    }
    
    // Format cookies
    const cookieString = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
    
    if (cookieString) {
      logger.info(`Successfully extracted cookies with length: ${cookieString.length}`);
    } else {
      logger.warn('No cookies were extracted from the page');
    }
    
    return cookieString;
  } catch (error) {
    logger.error(`Error extracting cookies with Puppeteer: ${error.message}`);
    
    // Try to capture and log the page content in case of error
    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages.length > 0) {
          const pageContent = await pages[0].content();
          logger.error(`Page content preview: ${pageContent.substring(0, 500)}...`);
        }
      } catch (contentError) {
        logger.error(`Could not capture page content: ${contentError.message}`);
      }
    }
    
    return '';
  } finally {
    if (browser) {
      await browser.close();
      logger.info('Browser closed');
    }
  }
};

module.exports = {
  launchBrowser,
  randomWait,
  retry,
  delay,
  chunk,
  randomNumber,
  safeParseJSON,
  extractText,
  extractAttribute,
  parseCookies,
  getCookiesFromResponse,
  extractCookiesWithPuppeteer,
}; 