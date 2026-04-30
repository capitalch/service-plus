## Successful Deployment effort in April 2026 for trace-plus-server

# 1 stage: started with python:3.14.3-slim-bookworm
	- this is selected by selecting docker image of python, then at top dropdown select 3.14.3-slim-bookworm. This is debian
	apt update
	apt install nginx
	
# 2 Remove old apache index file. otherwise apache site will appear
  rm /usr/share/nginx/html/index.html
  
# 3 Remove the default site. Otherwise nginx default screen will come up instead of application screen
  rm /etc/nginx/sites-enabled/default
  
# 4 Disable Nginx Autostart: do this
  sudo systemctl disable nginx
  
# 5 create a new file as /etc/nginx/conf.d/service-plus-server.conf as
- corrected
server {
    listen 80;
    server_name _;

    # Serve React static files
    root /usr/share/nginx/html/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    # Health check — proxy to FastAPI
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # REST API — proxy to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # GraphQL — WebSocket upgrade required for subscriptions
    location /graphql/ {
        proxy_pass http://127.0.0.1:8000/graphql/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 6 check configuration file syntax
  sudo nginx -t
  
# 7 install code and libraries
	pip install --upgrade pip
-   pip install aiofiles ariadne bcrypt fastapi openpyxl pandas python-multipart psycopg[binary] pydantic pydantic-settings PyJWT uvicorn[standard] websockets apscheduler mcp[cli]
	- copy TraceServer folder as it is containing config.py to final folder in local machine
	- npm run build for react trace-client app. Copy the dist folder to final folder in local machine
	- zip final folder as say final.zip: final.zip
	- upload in folder /usr/share/nginx/html
	
	cd /usr/share/nginx/html
	unzip final.zip

# 8 create a startup.sh file as /usr/share/nginx/html/startup.sh
    #!/bin/bash
    sudo nginx &
    export APP_ENV=production
    cd /usr/share/nginx/html/trace-server && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 9 At command entry point of cloudjiffy write this line
  /usr/share/nginx/html/startup.sh
# Completed. Restart the server:: success

# Automate the deployment process in linux
- Local machine
    - deploy.sh file in final folder
    ./deploy.sh
- Cloudjiffy Server
    - a file named as extract having linux scripts is created at /usr/local/bin with (execute permissions: cd /usr/local/bin chmod +x extract)
    - you need to upload final.zip in folder /usr/share/nginx/html
    - type extract in any terminal
    - restart server
    
## Impotant docker commands for the docker env in kubuntu:
docker run -it --name fastapi -p 8080:80 debian:bookworm-20260316 bash
    Explain:-it
    This is actually two flags combined:
    -i → Interactive (keeps STDIN open)
    -t → Allocates a terminal (TTY)
    👉 Together: you get a live terminal inside the container, like logging into a Linux machine.

    --name fastapi
    👉 Assigns a custom name to the container.
    Instead of a random ID, you can refer to it by this name
    
    -p 8080:80
    maps host port 8080 to container port 80
    👉 Port mapping:
    host_port : container_port
    Your Kubuntu machine → localhost:8080
    Inside container → port 80
    
    bash
    👉 The command to run inside the container.
    Instead of running a server, you're starting:
    👉 an interactive Bash shell

## Sharing data between kubuntu and windows machine

- kubuntu
  - install samba in kubuntu
  - Right click folder and set permissions and set shared from shared tab
  - get ip address from 
      hostname -I
- windows: explorer: \\ip-address
  - asking credentials: give uid, pwd of linux machine,maybe sushant,pwd
- you will be able to see the shared folders

# Start nginx at startup : not required : for knowledge

sudo systemctl enable nginx

- To start uvicorn manually
    uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# start uvicorn at startup : not required : for knowledge

    - At cloudjiffy entry point
    cd /usr/share/nginx/html/trace-server && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Reload nginx at config change : not required : for knowledge

sudo nginx -t && sudo systemctl reload nginx

## Handy Linux commands

- To see Linux distribution
  cat /etc/os-release
