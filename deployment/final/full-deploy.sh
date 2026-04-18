#!/bin/bash

# Define paths for clarity
CLIENT_DIR="/home/sushant/projects/service-plus/dev/service-plus-client"
SERVER_DIR="/home/sushant/projects/service-plus/dev/service-plus-server"
DEPLOY_DIR="/home/sushant/projects/service-plus/deployment/final"

#echo "🚀 Incrementing the version..."
#pnpm version patch
#pnpm version minor
#pnpm version major
echo "🚀 Starting Deployment Script..."

# 0. Cleanup old deployment files
echo "🧹 Cleaning up previous deployment..."
rm -f "$DEPLOY_DIR/final.zip"
rm -rf "$DEPLOY_DIR/dist"
rm -rf "$DEPLOY_DIR/service-plus-server"

# 1. Build the React client
echo "📦 Building client..."
cd "$CLIENT_DIR" || { echo "❌ Error: Client directory not found"; exit 1; }
npm run build

# 2. Prepare deployment directory
echo "📁 Ensuring deployment folder exists..."
mkdir -p "$DEPLOY_DIR"

# 3. Copy dist folder to deployment
echo "🚚 Copying new dist folder..."
cp -rf "$CLIENT_DIR/dist" "$DEPLOY_DIR/"

# 4. Copy server folder to deployment
echo "🚚 Copying new server folder..."
# Excludes node_modules or venv to keep the zip small (Optional but recommended)
cp -rf "$SERVER_DIR" "$DEPLOY_DIR/"

# 5. Compress folders to final.zip
echo "📚 Creating zip archive..."
cd "$DEPLOY_DIR" || { echo "❌ Error: Deployment directory not found"; exit 1; }
zip -rq "final.zip" "dist" "service-plus-server"

echo "-----------------------------------------------"
echo "✅ Success! Deployment ready: $DEPLOY_DIR/final.zip"
echo "-----------------------------------------------"

# Configuration
REMOTE_USER="268494-638"  # Replace with your actual SSH username
REMOTE_HOST="gate.cloudjiffy.com"
PORT="3022"
REMOTE_DIR="/usr/share/nginx/html"
ZIP_FILE="/home/sushant/projects/service-plus/deployment/final/final.zip"

echo "📤 Uploading final.zip to CloudJiffy..."
# Copy the file to the remote directory
scp -P $PORT "$ZIP_FILE" $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

echo "🚀 Executing remote extraction..."
# Connect and run the extract command
ssh -p $PORT $REMOTE_USER@$REMOTE_HOST << EOF
  # Run your custom extract script
  extract
  echo "✅ Remote extraction complete!"
EOF
