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
# Give execution rights on the cron job
RUN chmod 0644 /etc/cron.d/mine.cron
# Create the log file to be able to run tail
RUN touch /var/log/cron.log
# Run the command on container startup
CMD cron && tail -f /var/log/cron.log

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

EXPOSE 8080
EXPOSE 8087


CMD [ "npm", "start" ]

