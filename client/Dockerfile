# Stage 1: Build React app
FROM node:20-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve built files via Nginx
FROM nginx:1.27-alpine

# Copy build output from previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy Nginx default config and update CORS
RUN rm /etc/nginx/conf.d/default.conf
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { try_files $uri /index.html; } \
    add_header Access-Control-Allow-Origin "*"; \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
