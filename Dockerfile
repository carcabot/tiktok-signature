#tiktok-signature
FROM ubuntu:22.04 AS tiktok_signature.build

WORKDIR /usr

# 1. Install Node.js 20 (LTS)
RUN apt-get update && apt-get install -y curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pm2


# 2. Install WebKit dependencies
RUN npx playwright install-deps

# 3. Install Chromium dependencies

RUN apt-get install -y libnss3 \
    libxss1 \
    libasound2

# 4. Install Firefox dependencies

RUN apt-get install -y libdbus-glib-1-2 \
    libxt6

# 5. Clean up package cache to reduce image size
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# 6. Copying required files

COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm ci --omit=dev
COPY . .

EXPOSE 8080
CMD [ "pm2-runtime", "listen.js" ]
