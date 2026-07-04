#!/bin/bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Window 1: Git Pull (Service Plus)
konsole --workdir "/home/sushant/projects/service-plus" -e bash -c "git pull; exec bash" &
sleep 1  # No '&' here! The script will now genuinely pause for 1 second.

# Window 2: Frontend Client
konsole --workdir "/home/sushant/projects/service-plus/dev/service-plus-client" -e bash -ic "pnpm start; exec bash" &
sleep 1

# Window 3: Claude
konsole --workdir "/home/sushant/projects/service-plus/dev/service-plus-client" -e bash -c "claude; exec bash" &
sleep 1

# Window 4: Service Client Shell 1
konsole --workdir "/home/sushant/projects/service-plus/dev/service-plus-client" &
sleep 1

# Window 5: Service Client Shell 2
konsole --workdir "/home/sushant/projects/service-plus/dev/service-plus-client" &
sleep 1

# Window 6: Service Client Shell 3
konsole --workdir "/home/sushant/projects/service-plus/dev/service-plus-client" &
sleep 1

# Window 6.1: Service deployment
konsole --workdir "/home/sushant/projects/service-plus/deployment/app-server" &
sleep 1

# Window 7: Git Pull (Trace Plus)
konsole --workdir "/home/sushant/projects/trace-plus" -e bash -c "git pull; exec bash" &
sleep 1

# Window 8: Trace client
konsole --workdir "/home/sushant/projects/trace-plus/dev/trace-client" -e bash -ic "npm start; exec bash" &
sleep 1

# Window 9: Claude (Trace) - Fixed syntax error here (removed the stray middle &)
konsole --workdir "/home/sushant/projects/trace-plus/dev/trace-client" -e bash -c "claude; exec bash" &
sleep 1

# Window 10: Trace Client Shell 1
konsole --workdir "/home/sushant/projects/trace-plus/dev/trace-client" &

# Window 10.1: Trace deployment
konsole --workdir "/home/sushant/projects/trace-plus/deployment/final" &

# Window 10.2: Trace deployment
konsole --workdir "/home/sushant/mydrive" &

# Final initialization pause before starting any background IDE tasks
sleep 1

# THE IDE LAUNCH PIECE
# Point directly to the actual wrapper binary
#IDE_BIN="/home/sushant/.local/share/antigravity-ide/antigravity-ide"
# Pass the fallback sandbox instruction flags directly to the runtime variables
#IDE_FLAGS="--no-sandbox --disable-setuid-sandbox"

#(cd /home/sushant/projects/service-plus/dev/service-plus-server/ && $IDE_BIN $IDE_FLAGS) &
#(cd /home/sushant/projects/service-plus/dev/service-plus-client/ && $IDE_BIN $IDE_FLAGS) &
