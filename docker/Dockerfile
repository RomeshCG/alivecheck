FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY apps ./apps
COPY packages ./packages
COPY worker ./worker
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @alivecheck/db generate
EXPOSE 3000 4000
CMD ["pnpm", "dev"]
