# Use Python 3.12 as base
FROM python:3.12-slim

# Install Node.js 18
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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