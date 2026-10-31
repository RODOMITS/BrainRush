FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/app/data/brainrot.db
EXPOSE 3000
CMD ["node", "server/index.js"]
