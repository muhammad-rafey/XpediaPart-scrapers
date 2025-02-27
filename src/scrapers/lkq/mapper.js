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
    
    // Map compatibility from fitments - keep original year value without parsing
    const compatibility = fitments.map(fitment => ({
      make: fitment.SystemMake || '',
      model: fitment.SystemModel || '',
      year: fitment.SystemYear || 0, // Keep as is, no parseInt
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
    
    // Map price information - keep original price format
    let price = 0;
    let currency = 'USD';
    
    if (product.price !== undefined) {
      price = product.price; // Keep original format, whether string or number
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
    
    // Collect other fields to save in otherParams
    const otherParams = {};
    
    // Add any fields from product that we don't explicitly map
    Object.keys(product).forEach(key => {
      // Skip fields we already handle explicitly
      const explicitFields = [
        'number', 'id', 'descriptionRetail', 'description', 'price', 
        'sourceVehicleMake', 'category', 'availability', 'ftcDisplay',
        'interchange', 'sourceVehicleYear', 'sourceVehicleModel', 
        'mileage', 'location', 'yardCity', 'yardState', 'catalog',
        'isReman', 'images', 'pricing', '_salvageSourceVehicle', 'fitmentJson'
      ];
      
      if (!explicitFields.includes(key)) {
        otherParams[key] = product[key];
      }
    });
    
    // If product has details, add them to otherParams
    if (product.details) {
      otherParams.details = product.details;
    }
    
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
      },
      // Add the otherParams
      otherParams,
    };
    
    return part;
  } catch (error) {
    logger.error(`Error mapping product to part: ${error.message}`);
    // Even if there's an error, try to return a basic part with the raw data
    return {
      partNumber: product?.number || product?.id || 'unknown',
      name: product?.descriptionRetail || product?.description || 'Unknown part',
      source: 'lkq',
      otherParams: {
        rawData: product ? JSON.stringify(product) : 'Error mapping product',
        mappingError: error.message
      }
    };
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