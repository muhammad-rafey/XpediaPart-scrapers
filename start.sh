#!/bin/bash

# Check if .env file exists, if not create from example
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "Creating .env file from .env.example"
    cp .env.example .env
  else
    echo "Error: .env.example file not found"
    exit 1
  fi
fi

# Install dependencies if node_modules does not exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start the application in development mode
echo "Starting application in development mode..."
npm run dev
