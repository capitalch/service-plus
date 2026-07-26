# nginx configuration file for service plus server
- I have created this config file for service plus server. its not working. Please correct it and place it in plan.md

server {
    listen 80;
    server_name _;

    # Serve React static files
    root /usr/share/nginx/html/dist;
    index index.html;
    
    location / {
        try_files $uri /index.html;
    }
    
    # Reverse proxy to FastAPI (Uvicorn)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
      location /graphql/ {
        proxy_pass http://127.0.0.1:8000/graphql/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
