#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { logger } = require('../src/utils/logger');
const config = require('../src/config');
const { 
  extractCookiesWithPuppeteer, 
  extractCookiesFromResponse 
} = require('../src/utils/scraper-utils');
const { getRandomUserAgent } = require('../src/utils/user-agents');

/**
 * LKQ Cookie Extractor Script
 * ---------------------------
 * 
 * This script visits the LKQ website and extracts cookies that can be used
 * for scraping. The cookies are then saved to a file or displayed for manual copying.
 * 
 * Usage:
 *   ./scripts/get-lkq-cookies.js [output]
 * 
 * Parameters:
 *   - output: Optional file path to save cookies (if not provided, cookies are displayed in console)
 * 
 * Example:
 *   ./scripts/get-lkq-cookies.js cookies.txt
 */

// Parse command line arguments
const args = process.argv.slice(2);
const outputFile = args[0] || null;

/**
 * Extract cookies from response headers
 * @param {Object} response - Axios response
 * @returns {string|null} - Cookies as string or null
 */
function extractCookiesFromResponse(response) {
  if (!response.headers || !response.headers['set-cookie']) {
    return null;
  }
  
  // Get cookies from response
  const cookies = response.headers['set-cookie'];
  
  // Convert array of cookies to string
  if (Array.isArray(cookies)) {
    return cookies.map(cookie => cookie.split(';')[0]).join('; ');
  }
  
  return cookies;
}

/**
 * Get cookies from LKQ website
 * @returns {Promise<string>} - Cookies as string
 */
async function getCookies() {
  logger.info('Attempting to extract LKQ cookies...');
  
  // Get a random user agent
  const userAgent = getRandomUserAgent();
  logger.info(`Using random user agent: ${userAgent}`);
  
  // Set up headers for request
  const headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'User-Agent': userAgent,
    'Upgrade-Insecure-Requests': '1'
  };
  
  // First try using Puppeteer (most reliable method)
  try {
    logger.info('Trying to extract cookies using Puppeteer...');
    const puppeteerCookies = await extractCookiesWithPuppeteer(config.scrapers.lkq.baseUrl);
    
    if (puppeteerCookies) {
      logger.info(`Successfully extracted cookies with Puppeteer: ${puppeteerCookies}`);
      return puppeteerCookies;
    } else {
      logger.warn('No cookies extracted with Puppeteer, trying fallback methods');
    }
  } catch (puppeteerError) {
    logger.warn(`Puppeteer extraction failed: ${puppeteerError.message}`);
  }
  
  // Fallback: Use axios
  try {
    logger.info('Trying to extract cookies using Axios...');
    
    // Make a request to the homepage
    logger.info('Visiting LKQ homepage...');
    const homeResponse = await axios.get(config.scrapers.lkq.baseUrl, { 
      headers,
      withCredentials: true 
    });
    
    logger.info(`Homepage status: ${homeResponse.status}`);
    
    // Look for API tokens in the page content
    let apiToken = '';
    if (homeResponse.data && typeof homeResponse.data === 'string') {
      const tokenMatch = homeResponse.data.match(/"token":"([^"]+)"/);
      if (tokenMatch && tokenMatch[1]) {
        apiToken = tokenMatch[1];
        logger.info(`Found API token: ${apiToken}`);
      }
    }
    
    // Extract cookies from initial response
    let cookies = extractCookiesFromResponse(homeResponse);
    if (cookies) {
      logger.info(`Extracted cookies from homepage: ${cookies}`);
    }
    
    // Try visiting another page to get more cookies
    logger.info('Visiting product category page...');
    const categoryResponse = await axios.get(`${config.scrapers.lkq.baseUrl}/alternator`, {
      headers: {
        ...headers,
        ...(cookies ? { 'Cookie': cookies } : {})
      },
      withCredentials: true
    });
    
    const additionalCookies = extractCookiesFromResponse(categoryResponse);
    if (additionalCookies) {
      logger.info(`Extracted additional cookies: ${additionalCookies}`);
      cookies = cookies ? `${cookies}; ${additionalCookies}` : additionalCookies;
    }
    
    // If we still don't have cookies, try the API directly
    if (!cookies) {
      logger.info('Trying API endpoint directly...');
      const apiResponse = await axios.get(
        `${config.scrapers.lkq.apiUrl}/Product/GetSearchResults?catalogId=0&category=Engine%20Compartment|Alternator&sort=closestFirst&skip=0&take=10`,
        {
          headers: {
            ...headers,
            'Referer': 'https://www.lkqonline.com/alternator',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }
      );
      
      const apiCookies = extractCookiesFromResponse(apiResponse);
      if (apiCookies) {
        logger.info(`Extracted cookies from API: ${apiCookies}`);
        cookies = cookies ? `${cookies}; ${apiCookies}` : apiCookies;
      }
    }
    
    // Add API token as a cookie if found
    if (apiToken && !cookies.includes('apiToken')) {
      cookies = cookies ? `${cookies}; apiToken=${apiToken}` : `apiToken=${apiToken}`;
    }
    
    return cookies || '';
  } catch (error) {
    logger.error(`Error extracting cookies with Axios: ${error.message}`);
    
    if (error.response) {
      logger.error(`Response status: ${error.response.status}`);
      if (error.response.data) {
        const dataPreview = typeof error.response.data === 'string' 
          ? error.response.data.substring(0, 200) 
          : JSON.stringify(error.response.data).substring(0, 200);
        logger.error(`Response data preview: ${dataPreview}...`);
      }
    }
    
    return '';
  }
}

/**
 * Extract important request headers from a browser session
 */
function getImportantHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://www.lkqonline.com',
    'Referer': 'https://www.lkqonline.com/',
    'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
  };
}

/**
 * Main function
 */
async function main() {
  try {
    let cookies = await getCookies();
    
    if (!cookies) {
      logger.warn('No cookies could be automatically extracted');
      
      // Provide manual instructions
      logger.info('\nManual cookie extraction instructions:');
      logger.info('1. Open your browser and go to https://www.lkqonline.com');
      logger.info('2. Open developer tools (F12 or right-click > Inspect)');
      logger.info('3. Go to the "Network" tab');
      logger.info('4. Search for any "api" requests');
      logger.info('5. Check the "Request Headers" section for the "Cookie" header');
      logger.info('6. Copy the entire cookie string and add it to your .env file');
      
      // Also provide important headers that should be used
      logger.info('\nImportant headers to include in your scraper config:');
      const headers = getImportantHeaders();
      Object.keys(headers).forEach(key => {
        logger.info(`${key}: ${headers[key]}`);
      });
      
      process.exit(1);
    }
    
    // Save to file or display in console
    if (outputFile) {
      fs.writeFileSync(outputFile, cookies);
      logger.info(`Cookies saved to ${outputFile}`);
      
      // Also show how to add to .env file
      logger.info('\nTo add these cookies to your .env file:');
      logger.info(`LKQ_COOKIES=${cookies}`);
    } else {
      // Display for manual copying
      logger.info('\n==== COOKIES ====');
      logger.info(cookies);
      logger.info('================\n');
      
      logger.info('To use these cookies, add them to your .env file as:');
      logger.info(`LKQ_COOKIES=${cookies}`);
    }
    
    // Also provide important headers
    logger.info('\nImportant headers to include in your config:');
    const headers = getImportantHeaders();
    Object.keys(headers).forEach(key => {
      logger.info(`${key}: ${headers[key]}`);
    });
    
    logger.info('\nScript completed successfully');
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main(); 