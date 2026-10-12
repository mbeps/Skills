# Worked Example: Docker Containerization for Next.js App & Stack

Multi-stage Next.js Docker configuration and multi-container Docker Compose orchestration.

## Example 7: Docker Containerization for Next.js App & Stack

### Scenario
Containerizing the Next.js application with a multi-stage Dockerfile and orchestrating it alongside PostgreSQL using Docker Compose.

---

### 1. Next.js Multi-Stage Dockerfile (`docker/next/Dockerfile`)

```dockerfile
# ---- Build Stage ----
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# ---- Release Stage ----
FROM node:24-alpine AS release
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/yarn.lock ./
RUN yarn install --production --frozen-lockfile
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["yarn", "start"]
```

---

### 2. Multi-Container Orchestration (`docker/docker-compose.yml`)

```yaml
version: '3'
services:
  nextjs:
    build:
      context: ..
      dockerfile: docker/next/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    restart: always
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: app_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

