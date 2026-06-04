# Use Node.js LTS
FROM node:22-alpine

# Create app directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application code
COPY . .

# Expose backend port
EXPOSE 8000

# Start application
CMD ["node", "data.js"]