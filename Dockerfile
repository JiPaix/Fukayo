FROM node:18-buster
ENV APP_LOGIN=${APP_LOGIN:-admin}
ENV APP_PASSWORD=${APP_LOGIN:-password}
RUN apt-get update
RUN apt-get install -y xvfb libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \
    libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget \
    xfonts-100dpi xfonts-75dpi xfonts-scalable xfonts-cyrillic libgbm-dev
RUN groupadd -g 999 fukayo && \
    useradd -r -u 999 -g fukayo fukayo
RUN mkdir -p /home/fukayo && chown -R fukayo:fukayo /home/fukayo
USER fukayo
WORKDIR /home/fukayo
COPY dist/linux-unpacked ./
EXPOSE 8080
CMD xvfb-run ./fukayo --server --login=$APP_LOGIN --password=$APP_PASSWORD --port=8080 --no-sandbox
