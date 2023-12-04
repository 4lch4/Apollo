FROM oven/bun:slim

WORKDIR /app

COPY package.json ./
COPY bun.lockb ./
COPY src ./src

RUN bun install
RUN bun run build

CMD ["bun", "run", "start"]
