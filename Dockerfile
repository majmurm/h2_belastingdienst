# Use a base image that has Node.js installed
FROM node:18-bullseye

# Install Python 3 and pip
RUN apt-get update && apt-get install -y python3 python3-pip

# Set working directory
WORKDIR /app

# Copy all project files
COPY . .

# 1. Install Python dependencies
RUN pip3 install -r requirements.txt

# 2. Install Node dependencies and Build the Dashboard
WORKDIR /app/dashboard
RUN npm install
RUN npm run build

# Expose the port Render assigns
ENV MODEL_PORT=7071
EXPOSE 7071

# Start the server
CMD ["npm", "run", "model:server"]