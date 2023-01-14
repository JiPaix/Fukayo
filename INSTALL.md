# Docker/Podman Deployment
This document assumes that you have installed Docker/Podman already, if you have not yet done so, here are the relevant links for them - <a href="https://docs.docker.com/desktop/"> Install Docker Desktop</a>, <a href="https://docs.docker.com/engine/install/"> Install Docker Engine</a>, <a href="https://podman.io/getting-started/installation"> Install Podman</a>.

## CLI deployment:

For Docker/Podman (substitute the command name as necessary, I would also recommend using a non-root shell with Podman) - this is not the way I would recommend in general over using Docker Desktop or better yet Docker Compose.
```
# docker run -d --name fukayo \
 -e FUKAYO_USERNAME=<username> \
 -e FUKAYO_PASSWORD=<password> \
 -p <host_port>:4444 \
 -u "1000:1000" \
 -v <config_dir>:/home/fukayo/.config/fukayo \
 jipaix/fukayo:beta
```

## Docker Desktop deployment:

TBD

## Docker Compose deployment:

There is an example [docker-compose](docker-compose-example.yml) file included in this repository to be used with docker-compose/docker compose or any other relevant tool such as Portainer. The two less obvious tunables in it (as well as the CLI deployment) are as follows:

1. `<host_port>` = The port that your host exposes for Fukayo 
2. `<config_dir>` = The config directory on your **host** that you want Fukayo to use

