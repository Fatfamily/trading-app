# Build & Run with Node on Render
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
ENV PORT=10000
EXPOSE 10000
CMD ["npm","start"]
