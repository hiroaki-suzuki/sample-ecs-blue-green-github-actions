FROM public.ecr.aws/docker/library/node:20-bookworm-slim AS base
RUN apt-get update \
    && apt-get -y upgrade \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY ./ ./
RUN npm ci
RUN ls -la

USER node
CMD ["npm", "run", "dev"]