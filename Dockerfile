FROM node:18-alpine

WORKDIR /app

COPY package.json .
RUN npm ci --only=production --silent

COPY index.js .

EXPOSE 8080

CMD ["node", "index.js"]
