# Dockerfile untuk Static Site dengan Nginx
FROM nginx:alpine

# Install curl untuk health check
RUN apk add --no-cache curl

# Copy semua file static ke directory nginx
COPY . /usr/share/nginx/html/

# Copy custom nginx configuration (opsional)
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
