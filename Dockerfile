FROM node:18.16.1-alpine

RUN apk add --no-cache git

COPY . /var/www/

WORKDIR /var/www/

RUN npm install && npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]