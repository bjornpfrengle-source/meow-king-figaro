import express from "express";
import path from "path";
import os from "os";
import fs from "fs";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { GoogleGenAI } from "@google/genai";

// Prefer the bundled static binary; fall back to system ffmpeg (installed via nixpacks)
let ffmpegPath: string = (ffmpegStatic as unknown as string) || "ffmpeg";
if (ffmpegPath !== "ffmpeg" && !fs.existsSync(ffmpegPath)) {
  ffmpegPath = "ffmpeg";
}
ffmpeg.setFfmpegPath(ffmpegPath);

// --- Content moderation -----------------------------------------------
// Every uploaded clip gets one frame checked against Gemini before it's
// allowed to publish. This is a still-frame check, not full-video scanning —
// cheap and fast, and it catches the obvious stuff (nudity, gore, weapons).
// It deliberately fails OPEN: if there's no API key configured, or the
// Gemini call itself errors (rate limit, outage), the upload is allowed
// through rather than blocking real users because of our infrastructure.
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
if (!genAI) {
  console.warn("GEMINI_API_KEY not set — upload content moderation is DISABLED.");
}

const MODERATION_PROMPT = `You are a content safety filter for a family-friendly pet video app where users upload short videos of their cats. This is a single frame extracted from an uploaded video.

Respond with ONLY this JSON, no other text: {"safe": boolean, "reason": string}

Mark safe:false ONLY if the image contains: nudity or sexual content, graphic violence or gore, real weapons used threateningly, or content clearly inappropriate for a general/family audience.

Cats and other pets behaving chaotically, playfully, or even looking silly or gross in a normal pet way (vomiting, play-fighting, a litter box, etc.) are always safe:true. Humans briefly in frame are fine unless the image itself is explicit or violent. If genuinely uncertain, default to safe:true — this filter should catch clear violations, not borderline cases.`;

async function moderateFrame(imagePath: string): Promise<{ safe: boolean; reason?: string }> {
  if (!genAI) return { safe: true };
  try {
    const base64 = fs.readFileSync(imagePath).toString("base64");
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: MODERATION_PROMPT }, { inlineData: { mimeType: "image/jpeg", data: base64 } }],
        },
      ],
      config: { responseMimeType: "application/json" },
    });
    const parsed = JSON.parse((response.text || "{}").trim());
    return { safe: parsed.safe !== false, reason: parsed.reason };
  } catch (err) {
    console.error("Moderation check failed, allowing upload through (fail-open):", err);
    return { safe: true };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

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

      // Grab one frame from the trimmed clip and run it past Gemini before
      // this video is allowed to go live to every user in the app.
      const thumbPath = path.join(os.tmpdir(), `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
      try {
        await new Promise<void>((resolve, reject) => {
          ffmpeg(outputPath)
            .seekInput(0.3)
            .frames(1)
            .output(thumbPath)
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .run();
        });
        const verdict = await moderateFrame(thumbPath);
        fs.unlink(thumbPath, () => {});
        if (!verdict.safe) {
          cleanup();
          res.status(422).json({
            error: "moderation_failed",
            message: verdict.reason || "This video doesn't meet our community guidelines.",
          });
          return;
        }
      } catch (modErr) {
        console.error("Thumbnail/moderation step failed, allowing upload through (fail-open):", modErr);
        fs.unlink(thumbPath, () => {});
      }

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
