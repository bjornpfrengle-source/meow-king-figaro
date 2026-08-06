import express from "express";
import path from "path";
import os from "os";
import fs from "fs";
import { Readable } from "stream";
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

// --- Share video generation ---------------------------------------------
// Burns a confetti + "MEOW KING" overlay onto a winning clip so users can
// share an actual video to socials, instead of a link that makes people log
// in. Confetti piece math mirrors WinnerCelebrationModal.tsx's CONFETTI
// array (deterministic, not random — same shape every render) so the
// exported clip matches what people actually saw on the celebration screen.
// Capped at 36 pieces instead of the app's 55: each is a chained drawbox
// filter, and beyond ~36 render time climbed with no visible difference at
// video resolution.
const SHARE_VIDEO_SECONDS = 15;
const CONFETTI_COLORS = ["0xFF6B6B", "0xFFD93D", "0x6BCB77", "0x4D96FF", "0xFF6BD6", "0xFF9A3C"];
const SHARE_FONT_PATH = path.join(process.cwd(), "assets", "fonts", "DejaVuSans-Bold.ttf");

function buildConfettiFilter(): string {
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    left: (i * 2.9) % 100,
    color: CONFETTI_COLORS[i % 6],
    delay: (i * 0.09) % 3.2,
    duration: 2.4 + ((i * 0.07) % 2),
    size: 6 + ((i * 3) % 9),
  }));
  return pieces
    .map((p) => {
      const x = `iw*${(p.left / 100).toFixed(4)}`;
      const y =
        `if(lt(t,${p.delay.toFixed(3)}),-50,` +
        `-${p.size}+mod(t-${p.delay.toFixed(3)},${p.duration.toFixed(3)})/${p.duration.toFixed(3)}*(ih+${p.size * 2}))`;
      return `drawbox=x='${x}':y='${y}':w=${p.size}:h=${p.size}:color=${p.color}@0.9:t=fill`;
    })
    .join(",");
}

// User-supplied cat/theme names can contain characters that are meaningful
// to ffmpeg's filter parser (: ' \ %) — rather than trying to escape those
// correctly inline, strip anything that isn't plain printable ASCII. This
// also silently drops emoji the bundled font has no glyph for anyway.
function sanitizeForDrawtext(s: string, maxLen: number): string {
  const cleaned = s
    .replace(/'/g, "’")
    .replace(/[^\x20-\x7E’]/g, "")
    .replace(/[\\:%]/g, "")
    .trim();
  return (cleaned.slice(0, maxLen) || "Champion").replace(/"/g, "");
}

function buildTextFilter(catName: string, themeName: string, votes: number): string {
  const cat = sanitizeForDrawtext(catName, 20);
  const theme = sanitizeForDrawtext(themeName, 22);
  const voteLine = `won "${theme}" ${String.fromCharCode(183)} ${votes} vote${votes !== 1 ? "s" : ""}`;
  return [
    `drawtext=fontfile=${SHARE_FONT_PATH}:text='MEOW KING':fontsize=84:fontcolor=white:borderw=4:bordercolor=black@0.6:x=(w-text_w)/2:y=h*0.09`,
    `drawtext=fontfile=${SHARE_FONT_PATH}:text='${cat}':fontsize=44:fontcolor=0xFFD93D:borderw=3:bordercolor=black@0.6:x=(w-text_w)/2:y=h*0.09+110`,
    `drawtext=fontfile=${SHARE_FONT_PATH}:text='${voteLine}':fontsize=26:fontcolor=white@0.9:borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=h*0.09+165`,
  ].join(",");
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  // Uploaded originals are streamed to a temp file. The whole point of this
  // endpoint is that people shoot a long clip on their phone and we cut it down
  // for them — so this ceiling only exists to stop absurd payloads, not to make
  // users pre-trim anything.
  const MAX_UPLOAD_BYTES = 600 * 1024 * 1024;
  // Longest clip we will ever emit. The client enforces the per-tier limit
  // (15s free / 30s Catnip Club); this is the outer bound. It used to be 15s
  // flat, which silently truncated every premium 30s entry.
  const MAX_CLIP_SECONDS = 30;

  const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
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

    const sizeMb = ((req.file?.size || 0) / 1024 / 1024).toFixed(1);
    console.log(
      `[process-video] received ${sizeMb}MB, type=${req.file?.mimetype}, ` +
      `trimStart=${req.body.trimStart}, trimEnd=${req.body.trimEnd}`
    );

    const trimStart = Math.max(parseFloat(req.body.trimStart) || 0, 0);
    const trimEnd = parseFloat(req.body.trimEnd);
    const rawDuration = isNaN(trimEnd) ? MAX_CLIP_SECONDS : trimEnd - trimStart;
    const duration = Math.min(Math.max(rawDuration, 1), MAX_CLIP_SECONDS);
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
      console.error("[process-video] ffmpeg failed:", err);
      cleanup();
      if (!res.headersSent) {
        res.status(500).json({
          error: "processing_failed",
          message:
            "We couldn't read that video file. It may be an unusual format — " +
            "try recording or exporting it again.",
        });
      }
    }
  });

  // Renders the packaged share video: fetches the already-trimmed winning
  // clip from its public Storage URL (no auth needed, it's already public —
  // the same URL the app plays it from), loops it to a fixed 15s so short
  // clips still get the full confetti animation, burns in the overlay, and
  // streams the mp4 straight back. The client uploads the result to Storage
  // itself and stamps it on the cat doc — this endpoint has no Firebase
  // Admin credentials and isn't meant to.
  app.post("/api/generate-share-video", async (req, res) => {
    const { videoUrl, catName, themeName, votes } = req.body || {};
    if (!videoUrl || typeof videoUrl !== "string") {
      res.status(400).json({ error: "videoUrl required" });
      return;
    }

    const inputPath = path.join(os.tmpdir(), `sharesrc_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);
    const outputPath = path.join(os.tmpdir(), `share_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);
    const cleanup = () => {
      fs.unlink(inputPath, () => {});
      fs.unlink(outputPath, () => {});
    };

    try {
      const sourceRes = await fetch(videoUrl);
      if (!sourceRes.ok || !sourceRes.body) {
        res.status(400).json({ error: "fetch_failed", message: "Couldn't load the source clip." });
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const dest = fs.createWriteStream(inputPath);
        // @ts-ignore - Node's fetch body is a web ReadableStream here
        const nodeStream = Readable.fromWeb(sourceRes.body);
        nodeStream.pipe(dest);
        dest.on("finish", () => resolve());
        dest.on("error", reject);
        nodeStream.on("error", reject);
      });

      const vf = [
        "scale='min(720,iw)':-2",
        buildConfettiFilter(),
        buildTextFilter(String(catName || "Champion"), String(themeName || ""), Number(votes) || 0),
      ].join(",");

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .inputOptions(["-stream_loop", "-1"])
          .duration(SHARE_VIDEO_SECONDS)
          .videoFilters(vf)
          .videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions([
            "-preset veryfast",
            "-crf 23",
            "-profile:v main",
            "-level 4.0",
            "-pix_fmt yuv420p",
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
      console.error("[generate-share-video] failed:", err);
      cleanup();
      if (!res.headersSent) {
        res.status(500).json({ error: "render_failed", message: "Couldn't build the share video. Try again shortly." });
      }
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
    console.error("Global error:", err?.code || "", err);
    // Multer rejects oversize uploads before the route ever runs, so this is
    // the only place we can turn that into something a user can act on.
    if (err?.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: "file_too_large",
        message:
          "That video is too large to upload. Try a shorter recording, or lower " +
          "your camera quality in Settings → Camera → Record Video.",
      });
      return;
    }
    res.status(err.status || 500).json({
      error: "server_error",
      message: err.message || "Something went wrong on our end. Please try again.",
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} (ffmpeg: ${ffmpegPath})`);
  });
}

startServer();
