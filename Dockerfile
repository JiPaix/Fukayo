FROM debian:buster-slim

ENV USERNAME=${USERNAME:-admin}
ENV PASSWORD=${PASSWORD:-password}

RUN apt-get update
RUN apt-get install -y xvfb chromium

RUN groupadd -g 999 fukayo && \
    useradd -r -u 999 -g fukayo fukayo
RUN mkdir -p /home/fukayo && chown -R fukayo:fukayo /home/fukayo

USER fukayo
WORKDIR /home/fukayo
COPY dist/linux-unpacked ./

EXPOSE 8080
CMD xvfb-run ./fukayo --server --login=$USERNAME --password=$PASSWORD --port=8080 --no-sandbox
