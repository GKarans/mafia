# Stage 1: Node.js backend
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy server package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy rest of the server code
COPY . .

# Expose port
EXPOSE 3001

# Start the Node server
CMD ["npm", "start"]
