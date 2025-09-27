FROM node:20-slim
WORKDIR /app

# Install minimal deps for the worker only
RUN npm init -y && npm i firebase-admin@^13 node-fetch@^3

# Copy worker code
COPY image-gen ./image-gen

CMD ["node", "image-gen/runpod-worker.mjs"]
