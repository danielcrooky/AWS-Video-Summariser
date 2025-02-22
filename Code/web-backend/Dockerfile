FROM node:14
WORKDIR /usr/src/app
RUN apt-get update
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
