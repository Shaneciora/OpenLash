FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATA_DIR=/app/data
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
