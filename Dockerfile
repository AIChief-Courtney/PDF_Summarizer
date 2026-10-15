FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY server/package.json server/package-lock.json ./server/
COPY client/package.json client/package-lock.json ./client/

RUN npm install && npm run install:all

COPY . .
RUN npm run build

ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
