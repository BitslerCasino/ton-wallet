FROM node:20.10-alpine

RUN apk add --no-cache git

COPY . /var/www/

WORKDIR /var/www/

RUN npm install && npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]