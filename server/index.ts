import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { connectMongoDB } from "./db-mongo";

// Global process-level handlers to keep the server alive and log unexpected
// errors during development. These make crashes less likely to silently kill
// the dev server so the UI doesn't disappear when a non-fatal error occurs.
process.on('uncaughtException', (err) => {
  console.error('[process] Uncaught exception:', err && (err as any).stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[process] Unhandled rejection:', reason);
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize MongoDB connection
  console.log('[Startup] Connecting to MongoDB...');
  await connectMongoDB();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  
  const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");

  const listenOptions: any = {
    port,
    host,
  };
  
  // reusePort is not supported on Windows, so only add it on non-Windows systems
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }
  
  // Attach an error handler so listen errors (eg. EADDRINUSE) don't emit an
  // uncaught 'error' event that crashes the process. We log and exit
  // gracefully when the port is already in use.
  httpServer.on('error', (err: any) => {
    console.error('[httpServer] Server error:', err && err.stack ? err.stack : err);
    if (err && err.code === 'EADDRINUSE') {
      log(`Port ${port} already in use. Another instance may be running.`, 'express');
      // Exit with non-zero so supervising tools can restart if configured.
      process.exit(1);
    }
  });

  httpServer.listen(listenOptions, () => {
    log(`serving on http://${host}:${port}`);
  });

  // In development, also listen on the common Vite port (5173) and redirect
  // to the actual server port. This avoids confusion when users open :5173
  // while the integrated dev server runs on a single port (default 5000).
  if (process.env.NODE_ENV !== "production") {
    try {
      const redirectPort = 5173;
      const redirectServer = createServer((req, res) => {
        const host = `http://127.0.0.1:${port}`;
        const target = host + (req.url || "");
        res.writeHead(307, { Location: target });
        res.end();
      });

      redirectServer.on("error", (err: any) => {
        log(`redirect server on :5173 failed: ${String(err)}`, "redirect");
      });

      redirectServer.listen(5173, "127.0.0.1", () => {
        log(`dev-redirect listening on http://127.0.0.1:5173 -> http://127.0.0.1:${port}` , "redirect");
      });
    } catch (e) {
      log(`unable to start :5173 redirect - ${String(e)}`, "redirect");
    }
  }
})();
