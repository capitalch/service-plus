#!/bin/bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Navigate to your project root where the 'app' directory lives
cd "/home/sushant/projects/service-plus/dev/service-plus-server"

# Execute the schema extraction tool
python3 -m app.db.tools.extract_schema