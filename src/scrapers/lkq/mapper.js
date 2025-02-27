const { logger } = require('../../utils/logger');

/**
 * Map a LKQ API product to our Part model format
 * @param {Object} product - The product data from LKQ API
 * @returns {Object} - The formatted product data for our database
 */
const mapProductToPart = (product) => {
  try {
    if (!product) {
      logger.warn('Empty product data received in mapper');
      return null;
    }
    
    // Try to parse the source vehicle data if it's a string
    let sourceVehicle = {};
    if (product._salvageSourceVehicle && typeof product._salvageSourceVehicle === 'string') {
      try {
        sourceVehicle = JSON.parse(product._salvageSourceVehicle);
      } catch (error) {
        logger.warn(`Failed to parse source vehicle data: ${error.message}`);
      }
    }
    
    // Try to parse fitment data if it's a string
    let fitments = [];
    if (product.fitmentJson && typeof product.fitmentJson === 'string') {
      try {
        fitments = JSON.parse(product.fitmentJson);
      } catch (error) {
        logger.warn(`Failed to parse fitment data: ${error.message}`);
      }
    }
    
    // Map compatibility from fitments
    const compatibility = fitments.map(fitment => ({
      make: fitment.SystemMake || '',
      model: fitment.SystemModel || '',
      year: parseInt(fitment.SystemYear, 10) || 0,
      trim: '',
    }));
    
    // Map images
    const images = (product.images || []).map(image => ({
      url: image.url || '',
      alt: image.description || product.description || '',
    }));
    
    // Add source vehicle images if they exist
    if (sourceVehicle.SourceVehicleImages && Array.isArray(sourceVehicle.SourceVehicleImages)) {
      sourceVehicle.SourceVehicleImages.forEach(url => {
        images.push({
          url,
          alt: `Source Vehicle - ${sourceVehicle.Year || ''} ${sourceVehicle.Make || ''} ${sourceVehicle.Model || ''}`,
        });
      });
    }
    
    // Map price information
    let price = 0;
    let currency = 'USD';
    
    if (product.price) {
      price = product.price;
    } else if (product.pricing && product.pricing.length > 0) {
      price = product.pricing[0].customerPrice || 0;
    }
    
    // Extract specifications from description
    const specifications = {};
    const descriptionParts = (product.description || '').split(',').map(part => part.trim());
    
    descriptionParts.forEach(part => {
      const [key, value] = part.split(' ');
      if (key && value) {
        specifications[key] = value;
      }
    });
    
    // Create the part object
    const part = {
      partNumber: product.number || product.id || '',
      name: product.descriptionRetail || product.description || '',
      description: product.description || '',
      price,
      currency,
      manufacturer: sourceVehicle.Make || product.sourceVehicleMake || '',
      category: (product.category || '').split('|')[1] || '',
      subcategory: '',
      compatibility,
      images,
      specifications,
      source: 'lkq',
      sourceUrl: `https://www.lkqonline.com/parts/${product.number || product.id || ''}`,
      inStock: product.availability === 'availableLocal' || product.availability === 'availableShip',
      quantity: 1, // Default to 1 for available items
      condition: product.ftcDisplay === 'Used' ? 'used' : 
                 product.ftcDisplay === 'New' ? 'new' : 
                 product.ftcDisplay === 'Refurbished' ? 'refurbished' : 'unknown',
      metadata: {
        originalId: product.id || '',
        interchange: product.interchange || '',
        sourceVehicleYear: product.sourceVehicleYear || sourceVehicle.Year || '',
        sourceVehicleMake: product.sourceVehicleMake || sourceVehicle.Make || '',
        sourceVehicleModel: product.sourceVehicleModel || sourceVehicle.Model || '',
        mileage: product.mileage || sourceVehicle.Mileage || 0,
        location: product.location || '',
        yardCity: product.yardCity || '',
        yardState: product.yardState || '',
        catalogId: product.catalog ? product.catalog.id : 0,
        catalogName: product.catalog ? product.catalog.name : '',
        isReman: product.isReman || false,
        rawData: JSON.stringify(product), // Store the raw data for reference
      },
    };
    
    return part;
  } catch (error) {
    logger.error(`Error mapping product to part: ${error.message}`);
    return null;
  }
};

/**
 * Map multiple LKQ API products to our Part model format
 * @param {Array} products - The product data array from LKQ API
 * @returns {Array} - The formatted product data array for our database
 */
const mapProductsToParts = (products) => {
  if (!Array.isArray(products)) {
    logger.warn('Non-array products data received in mapper');
    return [];
  }
  
  const parts = products
    .map(mapProductToPart)
    .filter(part => part !== null);
  
  logger.info(`Mapped ${parts.length} out of ${products.length} products to parts`);
  
  return parts;
};

module.exports = {
  mapProductToPart,
  mapProductsToParts,
}; 