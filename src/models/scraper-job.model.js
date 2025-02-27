const mongoose = require('mongoose');

const scraperJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
    },
    source: {
      type: String,
      required: true,
      enum: ['lkq', 'other-source'], // Add other sources as they are implemented
    },
    query: {
      type: String,
      required: true,
    },
    options: {
      type: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number, // in milliseconds
    },
    itemsScraped: {
      type: Number,
      default: 0,
    },
    error: {
      message: String,
      stack: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for efficient querying
scraperJobSchema.index({ source: 1, status: 1 });
scraperJobSchema.index({ createdAt: -1 });

const ScraperJob = mongoose.model('ScraperJob', scraperJobSchema);

module.exports = ScraperJob; 