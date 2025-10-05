#!/usr/bin/env bash
# Build script for Render deployment

set -o errexit  # Exit on error

echo "🔧 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "📦 Installing Node dependencies..."
cd client
npm install

echo "🏗️ Building React frontend..."
npm run build
cd ..

echo "📁 Setting up Flask to serve React..."
# Clean existing static/templates for React
rm -rf server/static/react server/templates/react
mkdir -p server/static/react server/templates/react

# Copy built React files
cp -r client/dist/* server/static/react/
cp client/dist/index.html server/templates/react/

echo "✅ Build complete!"
