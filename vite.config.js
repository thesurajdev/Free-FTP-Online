const fs = require("node:fs");
const path = require("node:path");
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        const error = new Error("Invalid JSON body");
        error.statusCode = 400;
        reject(error);
      }
    });
  });
}

function createResponseBridge(nodeRes) {
  const bridge = {
    statusCode: 200,
    status(code) {
      this.statusCode = Number(code) || 200;
      return this;
    },
    json(payload) {
      nodeRes.statusCode = this.statusCode;
      nodeRes.setHeader("Content-Type", "application/json");
      nodeRes.end(JSON.stringify(payload));
    },
    end(payload) {
      nodeRes.statusCode = this.statusCode;
      nodeRes.end(payload);
    },
  };

  return bridge;
}

function localApiPlugin() {
  return {
    name: "local-api-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) {
          next();
          return;
        }

        const [pathname] = req.url.split("?");
        const endpoint = pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
        const filePath = path.join(process.cwd(), "api", `${endpoint}.js`);

        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end();
          return;
        }

        try {
          delete require.cache[require.resolve(filePath)];
          const handler = require(filePath);

          req.body = await parseJsonBody(req);

          const bridge = createResponseBridge(res);
          await handler(req, bridge);
        } catch (error) {
          res.statusCode = Number(error?.statusCode || 500);
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: false,
              error: error?.message || "Local API execution failed",
            })
          );
        }
      });
    },
  };
}

module.exports = defineConfig({
  plugins: [react(), localApiPlugin()],
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
});
