FROM caddy:2-alpine

COPY dist /app
WORKDIR /app
CMD ["caddy", "file-server"]
