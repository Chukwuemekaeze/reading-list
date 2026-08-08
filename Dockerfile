# Official Node.js Alpine base image.
FROM node:20-alpine

# App directory. node:alpine ships with a non-root "node" user we will use.
WORKDIR /app

# Copy package manifests first so the install layer is cached until deps change.
COPY package.json package-lock.json* ./

# Install production dependencies only.
RUN npm install --omit=dev

# Copy the rest of the application source.
COPY src ./src
COPY public ./public

# Drop privileges: run as the built-in non-root "node" user.
USER node

# The app reads PORT from the environment; default to 8080.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/server.js"]
