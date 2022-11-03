FROM almalinux:9-minimal

ENV FUKAYO_USERNAME=${FUKAYO_USERNAME:-admin} \
    FUKAYO_PASSWORD=${FUKAYO_PASSWORD:-password} \
    FUKAYO_PORT=${FUKAYO_PORT:-4444}

RUN microdnf install -y epel-release && \
    microdnf install -y chromium xorg-x11-server-Xvfb && \
    microdnf remove -y chromium && \
    microdnf clean all

RUN useradd -m fukayo && \
    mkdir /home/fukayo/app && chown -R fukayo:fukayo /home/fukayo/app && chmod -R 755 /home/fukayo/app && \
    mkdir -p /home/fukayo/.config/fukayo && chown -R fukayo:fukayo /home/fukayo/.config && \
    chmod -R 755 /home/fukayo/.config/fukayo

WORKDIR /home/fukayo/app
COPY dist/linux-unpacked/ ./
VOLUME ["/home/fukayo/.config/fukayo"]
USER fukayo
EXPOSE $FUKAYO_PORT
CMD xvfb-run ./fukayo --server --login=$FUKAYO_USERNAME --password=$FUKAYO_PASSWORD --port=$FUKAYO_PORT --no-sandbox
LABEL org.opencontainers.image.authors="Farah Nur (farahnur42@gmail.com)"
