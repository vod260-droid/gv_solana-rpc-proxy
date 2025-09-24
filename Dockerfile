FROM node:18-alpine

WORKDIR /app

COPY package.json ./

RUN apk add --no-cache python3 make g++

RUN npm install --only=production --silent

COPY index.js .

EXPOSE 8080

CMD ["node", "index.js"]
