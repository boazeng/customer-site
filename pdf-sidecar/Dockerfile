# שירות ה-PDF (Node + priority-web-sdk) — מפיק חשבונית דרך WWWSHOWAIV
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
ENV PORT=3001
EXPOSE 3001
CMD ["node", "server.js"]
