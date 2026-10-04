# Install docker in Kubuntu
sudo apt remove docker docker-engine docker.io containerd runc
sudo apt update
sudo apt install ca-certificates curl gnupg lsb-release -y
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y

sudo docker run hello-world                         Runs hello world

docker ps	                                        Lists all running containers
docker images                                       List local images
docker rmi <image_name>                             Delete an Image
docker image prune                                  Remove all unused images
docker pull <image_name>                            Pull an image from a Docker Hub

docker -ps -a	                                    Lists all containers
docker run --name <container_name> <image_name>     Create and run a container from an image, with a custom name

docker start|stop <cont_name> (or <container-id>)   Start or stop an existing container
docker rm <container_name>                          Remove a stopped container


docker login	                                   Logs in to a registry
docker logout	                                   Logs out from a registry

docker run -it --name service-plus -p 8080:80 python:3.14.3-slim-bookworm bash
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
