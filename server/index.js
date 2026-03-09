import "dotenv/config";
import express from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const app = express();
app.use(express.json());

const port = Number(process.env.PORT) || 3501;
const bucket = process.env.R2_BUCKET_NAME;
const publicUrlBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

const sanitize = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

app.post("/api/dlpc/upload", async (req, res) => {
  try {
    const { fileName } = req.body;
    if (!fileName || typeof fileName !== "string") {
      return res.status(400).json({ error: "fileName is required" });
    }
    if (!bucket || !publicUrlBase) {
      return res
        .status(500)
        .json({ error: "R2_BUCKET_NAME and R2_PUBLIC_URL must be set" });
    }

    const key = `landing-assets/${randomUUID()}-${sanitize(fileName)}`;
    const signedUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: 3600 }
    );
    const url = `${publicUrlBase}/${key}`;

    res.json({
      data: {
        signedUrl,
        bucket,
        key,
        url,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message ?? "Upload setup failed" });
  }
});

app.listen(port, () => {
  console.log(`Upload server listening on http://localhost:${port}`);
});
