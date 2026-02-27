FROM node:18-slim

WORKDIR /app

COPY packages/tunnel/package*.json ./

RUN npm install --production

COPY packages/tunnel/dist/index.js ./index.js

EXPOSE 3055

CMD ["node", "index.js"]
