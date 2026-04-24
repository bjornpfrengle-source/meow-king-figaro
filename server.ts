import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// Configure multer for temporary file storage (limit to 50MB)
const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure uploads and chunks directories exist
  if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
  }
  if (!fs.existsSync("chunks")) {
    fs.mkdirSync("chunks");
  }

  // Serve uploads directory statically so the frontend can access the videos
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Chunked upload endpoint
  app.post("/api/upload-chunk", upload.single("chunk"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No chunk provided" });
      }

      const { fileId, chunkIndex } = req.body;
      if (!fileId || chunkIndex === undefined) {
        return res.status(400).json({ error: "Missing fileId or chunkIndex" });
      }

      const chunkPath = path.join(process.cwd(), "chunks", `${fileId}_${chunkIndex}`);
      fs.renameSync(req.file.path, chunkPath);

      res.json({ success: true });
    } catch (err: any) {
      console.error("Error in /api/upload-chunk:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Process assembled video endpoint
  app.post("/api/process-video", express.json(), (req, res) => {
    try {
      const { fileId, totalChunks, originalName } = req.body;
      
      if (!fileId || !totalChunks) {
        return res.status(400).json({ error: "Missing fileId or totalChunks" });
      }

      // Assemble chunks
      const ext = path.extname(originalName || ".mp4");
      const assembledPath = path.join(process.cwd(), "uploads", `${fileId}${ext}`);
      
      const writeStream = fs.createWriteStream(assembledPath);
      
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(process.cwd(), "chunks", `${fileId}_${i}`);
        if (!fs.existsSync(chunkPath)) {
          return res.status(400).json({ error: `Missing chunk ${i}` });
        }
        const data = fs.readFileSync(chunkPath);
        writeStream.write(data);
        fs.unlinkSync(chunkPath); // Delete chunk after reading
      }
      
      writeStream.end();

      writeStream.on("finish", () => {
        console.log(`Assembled video: ${assembledPath}`);
        
        // Now probe and trim
        ffmpeg.ffprobe(assembledPath, (err, metadata) => {
          try {
            if (err) {
              console.error("FFprobe error:", err);
              return res.json({ url: `/uploads/${path.basename(assembledPath)}` });
            }
            
            const duration = metadata?.format?.duration;
            console.log(`Video duration: ${duration}s`);
            
            if (duration !== undefined && duration <= 15.5) {
              console.log(`Video is <= 15s. Skipping trim.`);
              return res.json({ url: `/uploads/${path.basename(assembledPath)}` });
            }

            console.log(`Video is > 15s. Trimming...`);
            const outputPath = path.join(process.cwd(), "uploads", `${fileId}_trimmed.mp4`);
            
            ffmpeg(assembledPath)
              .setDuration(15)
              .outputOptions([
                '-preset ultrafast',
                '-vf scale=-2:720', // Scale to 720p
                '-threads 4',
                '-y'
              ])
              .output(outputPath)
              .on("end", () => {
                console.log("Trimming complete.");
                fs.unlink(assembledPath, () => {}); // Delete original
                res.json({ url: `/uploads/${path.basename(outputPath)}` });
              })
              .on("error", (err) => {
                console.error("FFmpeg error:", err);
                fs.unlink(assembledPath, () => {});
                if (!res.headersSent) {
                  res.status(500).json({ error: `Failed to trim video: ${err.message}` });
                }
              })
              .run();
          } catch (innerErr: any) {
            console.error("Inner error:", innerErr);
            if (!res.headersSent) res.status(500).json({ error: innerErr.message });
          }
        });
      });
      
      writeStream.on("error", (err) => {
        console.error("WriteStream error:", err);
        res.status(500).json({ error: `Failed to assemble video: ${err.message}` });
      });

    } catch (err: any) {
      console.error("Error in /api/process-video:", err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });

  // Fast, direct upload endpoint with built-in trimming (kept for backward compatibility or small files)
  app.post("/api/upload", (req, res, next) => {
    upload.single("video")(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      next();
    });
  }, (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video file provided" });
      }

      const inputPath = req.file.path;
      
      console.log(`Probing video: ${inputPath}`);
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        try {
          if (err) {
            console.error("FFprobe error:", err);
            // Fallback: just rename and use it if probe fails
            const newPath = inputPath + ".mp4";
            fs.renameSync(inputPath, newPath);
            return res.json({ url: `/uploads/${path.basename(newPath)}` });
          }
          
          const duration = metadata?.format?.duration;
          console.log(`Video duration: ${duration}s`);
          
          // If video is 15 seconds or shorter, skip trimming
          if (duration !== undefined && duration <= 15.5) {
            console.log(`Video is <= 15s. Skipping trim.`);
            const newPath = inputPath + ".mp4";
            fs.renameSync(inputPath, newPath);
            return res.json({ url: `/uploads/${path.basename(newPath)}` });
          }

          console.log(`Video is > 15s. Trimming...`);
          const outputPath = inputPath + "_trimmed.mp4";
          
          ffmpeg(inputPath)
            .setDuration(15)
            .outputOptions([
              '-preset ultrafast',
              '-vf scale=-2:720', // Scale to 720p for speed and size
              '-threads 4',
              '-y'
            ])
            .output(outputPath)
            .on("end", () => {
              console.log("Trimming complete.");
              fs.unlink(inputPath, () => {}); // Delete original
              res.json({ url: `/uploads/${path.basename(outputPath)}` });
            })
            .on("error", (err) => {
              console.error("FFmpeg error:", err);
              fs.unlink(inputPath, () => {});
              if (!res.headersSent) {
                res.status(500).json({ error: `Failed to trim video: ${err.message}` });
              }
            })
            .run();
        } catch (innerErr: any) {
          console.error("Inner error:", innerErr);
          if (!res.headersSent) res.status(500).json({ error: innerErr.message });
        }
      });
    } catch (err: any) {
      console.error("Error in /api/upload:", err);
      if (!res.headersSent) res.status(500).json({ error: `Failed to save video: ${err.message}` });
    }
  });

  // Clear data endpoint
  app.post("/api/clear-data", (req, res) => {
    try {
      if (fs.existsSync("uploads")) {
        fs.readdirSync("uploads").forEach(file => {
          fs.unlinkSync(path.join("uploads", file));
        });
      }
      if (fs.existsSync("chunks")) {
        fs.readdirSync("chunks").forEach(file => {
          fs.unlinkSync(path.join("chunks", file));
        });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error clearing data:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Cleanup old files in uploads directory
  setInterval(() => {
    fs.readdir("uploads", (err, files) => {
      if (err) return;
      for (const file of files) {
        fs.unlink(path.join("uploads", file), (err) => {});
      }
    });
  }, 1000 * 60 * 60); // Every hour

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global error handler to ensure JSON responses for API errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global error:", err);
    if (req.path.startsWith('/api/')) {
      res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
    } else {
      next(err);
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
