const mongoose = require('mongoose');

const partSchema = new mongoose.Schema(
  {
    partNumber: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    price: {
      type: mongoose.Schema.Types.Mixed,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    manufacturer: {
      type: String,
    },
    category: {
      type: String,
    },
    subcategory: {
      type: String,
    },
    compatibility: [
      {
        make: String,
        model: String,
        year: mongoose.Schema.Types.Mixed,
        trim: String,
      },
    ],
    images: [
      {
        url: String,
        alt: String,
      },
    ],
    specifications: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    source: {
      type: String,
      required: true,
      enum: ['lkq', 'other-source'], // Add other sources as they are implemented
      index: true,
    },
    sourceUrl: {
      type: String,
    },
    inStock: {
      type: Boolean,
      default: false,
    },
    quantity: {
      type: mongoose.Schema.Types.Mixed,
      default: 0,
    },
    condition: {
      type: String,
      enum: ['new', 'used', 'refurbished', 'unknown'],
      default: 'unknown',
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    otherParams: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

// Create compound index for efficient querying
partSchema.index({ partNumber: 1, source: 1 }, { unique: true });

// Create text index for search functionality
partSchema.index(
  { name: 'text', description: 'text', partNumber: 'text' },
  { weights: { name: 10, partNumber: 5, description: 1 } }
);

const Part = mongoose.model('Part', partSchema);

module.exports = Part; 