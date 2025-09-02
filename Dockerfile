# Build client
FROM node:20-alpine AS build
WORKDIR /app
COPY client ./client
COPY server ./server
WORKDIR /app/client
RUN npm install && npm run build
# Move built client to server/public
RUN rm -rf /app/server/public && cp -r dist /app/server/public

# Runtime server
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/server ./server
WORKDIR /app/server
RUN npm install --omit=dev
ENV PORT=10000
EXPOSE 10000
CMD ["npm", "start"]
