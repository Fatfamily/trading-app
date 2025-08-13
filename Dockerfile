FROM node:18-alpine
WORKDIR /app

COPY package.json package-lock.json* ./

# lock 파일 있으면 ci, 없으면 install
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY . .

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "index.js"]
