# Use Node.js as the base image
FROM node:18-alpine

# Set the working directory
WORKDIR '/app'

# Copy package.json and install dependencies
COPY package.json .
RUN npm install

# Copy the entire project
COPY . .

EXPOSE 3000

# Start the Node.js server
CMD ["npm", "start"]
