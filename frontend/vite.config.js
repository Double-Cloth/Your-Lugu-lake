import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

function knowledgeBaseStaticPlugin() {
  return {
    name: "knowledge-base-static",
    configureServer(server) {
      server.middlewares.use("/knowledge-base", (req, res, next) => {
        const reqPath = (req.url || "/").split("?")[0];
        const safePath = decodeURIComponent(reqPath).replace(/^\/+/, "");
        const kbRoot = path.resolve(server.config.root, "../knowledge-base");
        const filePath = path.resolve(kbRoot, safePath);

        if (!filePath.startsWith(kbRoot)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }

        let targetPath = filePath;
        try {
          const stat = fs.statSync(targetPath);
          if (stat.isDirectory()) {
            targetPath = path.join(targetPath, "index.json");
          }
        } catch {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }

        fs.readFile(targetPath, (err, data) => {
          if (err) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }

          const ext = path.extname(targetPath).toLowerCase();
          if (ext === ".json") {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
          }
          if (ext === ".jpg" || ext === ".jpeg") {
            res.setHeader("Content-Type", "image/jpeg");
          }
          if (ext === ".png") {
            res.setHeader("Content-Type", "image/png");
          }
          if (ext === ".webp") {
            res.setHeader("Content-Type", "image/webp");
          }

          res.statusCode = 200;
          res.end(data);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), knowledgeBaseStaticPlugin()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: 'all',
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/uploads': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    },
  },
});
