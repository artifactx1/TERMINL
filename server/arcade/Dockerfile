# Build with the repository root as the context; game rules live in lib/arcade.
FROM node:22-bookworm-slim
WORKDIR /app

# Install only the backend dependency, never the Next.js/wallet/browser stack.
COPY server/arcade/package.json server/arcade/package-lock.json ./server/arcade/
RUN npm ci --prefix server/arcade --omit=dev --ignore-scripts --no-audit --no-fund

COPY lib/arcade/ ./lib/arcade/
COPY server/arcade/index.mjs server/arcade/journal.mjs ./server/arcade/

ENV NODE_ENV=production ARCADE_HOST=0.0.0.0
EXPOSE 4010
# Railway mounts /data at runtime; production also requires explicit origins.
CMD ["node", "server/arcade/index.mjs"]
