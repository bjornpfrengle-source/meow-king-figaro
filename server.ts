import express from "express";
import path from "path";
import os from "os";
import fs from "fs";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

// Prefer the bundled static binary; fall back to system ffmpeg (installed via nixpacks)
let ffmpegPath: string = (ffmpegStatic as unknown as string) || "ffmpeg";
if (ffmpegPath !== "ffmpeg" && !fs.existsSync(ffmpegPath)) {
  ffmpegPath = "ffmpeg";
}
ffmpeg.setFfmpegPath(ffmpegPath);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Uploaded originals are streamed to a temp file, capped at 600MB
  const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 600 * 1024 * 1024 },
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Trim + web-optimize an uploaded video, returning the small clip
  app.post("/api/process-video", upload.single("video"), async (req, res) => {
    const inputPath = req.file?.path;
    if (!inputPath) {
      res.status(400).json({ error: "No video uploaded" });
      return;
    }

    const trimStart = Math.max(parseFloat(req.body.trimStart) || 0, 0);
    const trimEnd = parseFloat(req.body.trimEnd);
    const rawDuration = isNaN(trimEnd) ? 15 : trimEnd - trimStart;
    const duration = Math.min(Math.max(rawDuration, 1), 15);
    const outputPath = path.join(os.tmpdir(), `clip_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);

    const cleanup = () => {
      fs.unlink(inputPath, () => {});
      fs.unlink(outputPath, () => {});
    };

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .seekInput(trimStart)
          .duration(duration)
          .videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions([
            "-preset veryfast",
            "-crf 23",
            "-profile:v main",
            "-level 4.0",
            "-pix_fmt yuv420p",
            // Scale down to max 720px wide, keep aspect, force even dimensions
            "-vf", "scale='min(720,iw)':-2",
            "-b:a 128k",
            "-movflags +faststart",
          ])
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .save(outputPath);
      });

      res.setHeader("Content-Type", "video/mp4");
      const stream = fs.createReadStream(outputPath);
      stream.pipe(res);
      stream.on("close", cleanup);
      stream.on("error", () => {
        cleanup();
        if (!res.headersSent) res.status(500).json({ error: "Streaming failed" });
      });
    } catch (err) {
      console.error("ffmpeg processing error:", err);
      cleanup();
      if (!res.headersSent) res.status(500).json({ error: "Video processing failed" });
    }
  });

  const isProd = process.env.NODE_ENV === "production" || process.argv[1]?.endsWith('server.cjs');

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} (ffmpeg: ${ffmpegPath})`);
  });
}

startServer();
