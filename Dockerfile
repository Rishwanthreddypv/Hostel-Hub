FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000 DEMO_MODE=false
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p data uploads/private && chown -R node:node /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
USER node
EXPOSE 4000
CMD ["node", "server/index.js"]
