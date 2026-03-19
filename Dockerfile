FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.mjs ./
COPY scripts ./scripts
COPY README.md ./
COPY README.zh-CN.md ./
COPY TEST_MATRIX.md ./
COPY LICENSE ./

ENV NODE_ENV=production
ENV KIRO_SHIM_HOST=0.0.0.0
ENV KIRO_SHIM_PORT=8765

EXPOSE 8765

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8765/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
