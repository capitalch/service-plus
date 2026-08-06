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

# Window 6.1: Service Client Shell 4
konsole --workdir "/home/sushant/projects/service-plus/dev/service-plus-client" &
sleep 1

# Window 6.2: Service Client Shell 5
konsole --workdir "/home/sushant/projects/service-plus/dev/service-plus-client" &
sleep 1

# Window 6.3: Service Client Shell 6
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

konsole --workdir "/home/sushant/projects/service-plus/dev/service-plus-web" & -e bash -ic "pnpm start; exec bash" &
sleep 1

konsole --workdir "/home/sushant/projects/service-plus/dev/service-plus-web" & -e bash -c "claude; exec bash" &
sleep 1

konsole --workdir "/home/sushant/projects/service-plus/dev/service-plus-web" &

konsole --workdir "/home/sushant/projects/capital-chowringhee-web/" & -e bash -ic "git pull; exec bash" &
sleep 1

konsole --workdir "/home/sushant/projects/capital-chowringhee-web/" & -e bash -ic "pnpm start; exec bash" &
sleep 1

konsole --workdir "/home/sushant/projects/capital-chowringhee-web/" & -e bash -ic "claude; exec bash" &
sleep 1

konsole --workdir "/home/sushant/projects/capital-chowringhee-web/" &
sleep 1

sleep 1
