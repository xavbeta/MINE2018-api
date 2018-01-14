FROM node:carbon

# Create app directory
WORKDIR /usr/src/app

#install cron
RUN apt-get update && apt-get install -y cron

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

COPY mine.cron /etc/cron.d/mine.cron
RUN crontab /etc/cron.d/mine.cron
RUN touch /tmp/cron.log

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

RUN service cron start

# Bundle app source
COPY . .

# Expose external ports
EXPOSE 8080
EXPOSE 8087

CMD [ "npm", "start" ]

