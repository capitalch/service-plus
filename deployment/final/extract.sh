#!/bin/bash

# Define the target directory
TARGET_DIR="/usr/share/nginx/html"
ZIP_FILE="final.zip"

echo "📂 Moving to deployment directory..."
cd "$TARGET_DIR" || { echo "❌ Error: Could not find $TARGET_DIR"; exit 1; }

# Check if final.zip exists before proceeding
if [ ! -f "$ZIP_FILE" ]; then
    echo "⚠️  Warning: $ZIP_FILE not found in $TARGET_DIR"
    echo "Make sure you have uploaded the zip file first."
    exit 1
fi

echo "🧹 Removing old folders..."
# Using sudo because /usr/share/nginx is usually root-owned
sudo rm -rf dist service-plus-server

echo "📦 Unzipping new files..."
sudo unzip -q "$ZIP_FILE"

echo "🔒 Setting permissions (Optional)..."
# Ensures Nginx can actually read the new files
# sudo chown -R www-data:www-data "$TARGET_DIR"

echo "✅ Extraction complete in $TARGET_DIR"