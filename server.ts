import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

/**
 * =========
 * IBM IAM token helper (cached)
 * =========
 */
let cachedIamToken: { token: string; expiresAtMs: number } | null = null;

async function getIamAccessToken(): Promise<string> {
  // Reuse token if still valid (with 60s buffer)
  if (cachedIamToken && Date.now() < cachedIamToken.expiresAtMs - 60_000) {
    return cachedIamToken.token;
  }

  const apikey = process.env.IBM_API_KEY;
  if (!apikey) throw new Error("Missing IBM_API_KEY in .env");

  const form = new URLSearchParams();
  form.set("grant_type", "urn:ibm:params:oauth:grant-type:apikey");
  form.set("apikey", apikey);

  const resp = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  const data = (await resp.json()) as any;
  if (!resp.ok) {
    throw new Error(`IAM token error: ${resp.status} ${JSON.stringify(data)}`);
  }

  const token = data.access_token as string;
  const expiresInSec = Number(data.expires_in ?? 3600);

  cachedIamToken = { token, expiresAtMs: Date.now() + expiresInSec * 1000 };
  return token;
}

/**
 * =========
 * Matchmaking (text generation)
 * =========
 */
async function callWatsonxMatchmake(payload: {
  request: any;
  borrower: any;
  lenders: any[];
}) {
  const IBM_URL = process.env.IBM_URL || "https://us-south.ml.cloud.ibm.com";
  const PROJECT_ID = process.env.IBM_PROJECT_ID;
  const MODEL_ID = process.env.IBM_MODEL_ID || "ibm/granite-3-8b-instruct";

  if (!PROJECT_ID) throw new Error("Missing IBM_PROJECT_ID in .env");

  const token = await getIamAccessToken();

  const prompt = `
You are an Uber-style campus lending matcher for OSU.

GOAL:
Pick the best lender for the borrower request.

Borrower:
${JSON.stringify(payload.borrower, null, 2)}

Borrower request:
${JSON.stringify(payload.request, null, 2)}

Candidate lenders:
${JSON.stringify(payload.lenders, null, 2)}

RULES:
- Prioritize: distance (closest within maxDistance), category match, reliability_score, response_rate.
- Respect gender_preference if provided, but do NOT choose someone far away just for gender.
- Return STRICT JSON ONLY. No extra text.

FORMAT:
{
  "bestLenderId": "string",
  "ranked": [
    { "lenderId": "string", "aiScore": 0.0, "reason": "string" }
  ]
}

The ranked list must be best-first and include up to 5 lenders.
aiScore should be between 0 and 1.
`.trim();

  const resp = await fetch(`${IBM_URL}/ml/v1/text/generation?version=2023-05-29`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model_id: MODEL_ID,
      project_id: PROJECT_ID,
      input: prompt,
      parameters: { max_new_tokens: 300, temperature: 0.2 },
    }),
  });

  const data = (await resp.json()) as any;
  if (!resp.ok) {
    throw new Error(`watsonx error: ${resp.status} ${JSON.stringify(data)}`);
  }

  const text = data?.results?.[0]?.generated_text;
  if (!text) throw new Error(`No generated_text. Raw: ${JSON.stringify(data)}`);

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`Model did not return JSON. Text: ${text}`);

  return JSON.parse(text.slice(start, end + 1));
}

/**
 * =========
 * Image verification (vision chat)
 * Frontend sends imageDataUrl = "data:image/jpeg;base64,...."
 * =========
 */
function normalizeAssistantContent(content: any): string {
  // Some APIs return a string, others return an array of parts.
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    // join only text parts
    return content
      .map((p) => (typeof p === "string" ? p : p?.text ?? ""))
      .join("");
  }
  return "";
}

async function callWatsonxVerifyImage(payload: {
  itemName: string;
  category?: string;
  imageDataUrl: string;
}) {
  const IBM_URL = process.env.IBM_URL || "https://us-south.ml.cloud.ibm.com";
  const PROJECT_ID = process.env.IBM_PROJECT_ID;

  // Put this in .env if you want to control it:
  // IBM_VISION_MODEL_ID=meta-llama/llama-3-2-11b-vision-instruct
  const VISION_MODEL_ID =
    process.env.IBM_VISION_MODEL_ID || "meta-llama/llama-3-2-11b-vision-instruct";

  if (!PROJECT_ID) throw new Error("Missing IBM_PROJECT_ID in .env");

  const token = await getIamAccessToken();

  const system = `
You are an item verification assistant for a campus lending app (UniBazzar at OSU).
Your job: decide if the image matches the requested item.

Return STRICT JSON ONLY (no extra text).
Schema:
{
  "isMatch": boolean,
  "confidence": number,   // 0 to 100
  "reason": string
}
Rules:
- If unsure, set isMatch=false and confidence <= 60.
- Be practical: if it looks clearly like the item, isMatch=true.
`.trim();

  const userText = `
Requested item: ${payload.itemName}
Category (optional): ${payload.category ?? "N/A"}

Does the image show the requested item?
Return JSON only.
`.trim();

  const resp = await fetch(`${IBM_URL}/ml/v1/text/chat?version=2024-10-08`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model_id: VISION_MODEL_ID,
      project_id: PROJECT_ID,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: payload.imageDataUrl } },
          ],
        },
      ],
      max_tokens: 250,
      temperature: 0.2,
      time_limit: 1000,
    }),
  });

  const data = (await resp.json()) as any;
  if (!resp.ok) {
    throw new Error(`watsonx error: ${resp.status} ${JSON.stringify(data)}`);
  }

  const rawContent = data?.choices?.[0]?.message?.content;
  const text = normalizeAssistantContent(rawContent);

  if (!text) throw new Error(`No assistant content. Raw: ${JSON.stringify(data)}`);

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`Model did not return JSON. Text: ${text}`);

  return JSON.parse(text.slice(start, end + 1));
}

/**
 * =========
 * DB
 * =========
 */
const db = new Database("unibazzar.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    gender TEXT,
    reliability_score REAL DEFAULT 1.0,
    reliability_count INTEGER DEFAULT 0,
    response_rate REAL DEFAULT 1.0,
    available_mode INTEGER DEFAULT 0,
    lending_categories TEXT DEFAULT 'Electronics,Tools,Kitchen,Study Materials',
    lat REAL,
    lng REAL,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    borrower_id TEXT,
    item_name TEXT,
    category TEXT,
    duration_hours REAL,
    max_distance REAL,
    gender_preference TEXT,
    status TEXT DEFAULT 'searching',
    lender_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(borrower_id) REFERENCES users(id),
    FOREIGN KEY(lender_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    amount REAL,
    platform_fee REAL,
    lender_earnings REAL,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(request_id) REFERENCES requests(id)
  );
`);

const seedDummyData = () => {
  try {
    const dummyLenders = [
      { id: "lender1", name: "Brutus Buckeye", email: "brutus.1@osu.edu", lat: 40.0, lng: -83.0145, categories: "Electronics,Tools,Kitchen,Study Materials" },
      { id: "lender2", name: "Carmen Ohio", email: "carmen.2@osu.edu", lat: 40.001, lng: -83.015, categories: "Electronics,Study Materials" },
      { id: "lender3", name: "Oval Walker", email: "walker.3@osu.edu", lat: 39.999, lng: -83.014, categories: "Tools,Kitchen" },
      { id: "lender4", name: "High Street", email: "street.4@osu.edu", lat: 40.0005, lng: -83.013, categories: "Electronics,Kitchen" },
      { id: "lender5", name: "Mirror Lake", email: "lake.5@osu.edu", lat: 39.9985, lng: -83.016, categories: "Study Materials,Tools" },
    ];

    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, lat, lng, available_mode, lending_categories, reliability_score, response_rate)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);

    dummyLenders.forEach((l) => {
      insertUser.run(
        l.id,
        l.name,
        l.email,
        l.lat,
        l.lng,
        l.categories,
        0.9 + Math.random() * 0.1,
        0.8 + Math.random() * 0.2
      );
    });

    console.log("Dummy lenders seeded successfully.");
  } catch (err) {
    console.error("Error seeding dummy data:", err);
  }
};

seedDummyData();

/**
 * =========
 * Types
 * =========
 */
interface UserRow {
  id: string;
  email: string;
  name: string;
  gender: string | null;
  reliability_score: number;
  response_rate: number;
  available_mode: number;
  lending_categories: string;
  lat: number | null;
  lng: number | null;
}

interface RequestRow {
  id: string;
  borrower_id: string;
  item_name: string;
  category: string;
  duration_hours: number;
  max_distance: number;
  gender_preference: string;
  status: string;
  lender_id: string | null;
}

/**
 * =========
 * Server
 * =========
 */
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // --- API Routes ---

  app.post("/api/auth/login", (req, res) => {
    const { email, name } = req.body;
    if (!email?.endsWith("@osu.edu")) {
      return res.status(403).json({ error: "Only OSU students can access UniBazzar." });
    }

    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;

    if (!user) {
      const id = Math.random().toString(36).substring(7);
      db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(id, email, name);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
    }

    res.json(user);
  });

  app.post("/api/users/location", (req, res) => {
    const { userId, lat, lng, availableMode, lendingCategories } = req.body;

    db.prepare(
      "UPDATE users SET lat = ?, lng = ?, available_mode = ?, lending_categories = ?, last_active = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(
      lat,
      lng,
      availableMode ? 1 : 0,
      lendingCategories || "Electronics,Tools,Kitchen,Study Materials",
      userId
    );

    res.json({ success: true });
  });

  app.get("/api/users/:id", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as UserRow | undefined;
    res.json(user);
  });

  app.post("/api/requests", (req, res) => {
    const { borrowerId, itemName, category, durationHours, maxDistance, genderPreference } = req.body;
    const id = Math.random().toString(36).substring(7);

    db.prepare(`
      INSERT INTO requests (id, borrower_id, item_name, category, duration_hours, max_distance, gender_preference)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, borrowerId, itemName, category, durationHours, maxDistance, genderPreference);

    res.json({ requestId: id });
  });

  app.get("/api/requests/:id", (req, res) => {
    const request = db.prepare(`
      SELECT r.*, b.name as borrower_name, l.name as lender_name 
      FROM requests r
      JOIN users b ON r.borrower_id = b.id
      LEFT JOIN users l ON r.lender_id = l.id
      WHERE r.id = ?
    `).get(req.params.id);

    res.json(request);
  });

  /**
   * ✅ Image verification route (frontend should call this)
   * body: { requestId, imageDataUrl }
   */
  // ✅ Image verification route (frontend calls this)
app.post("/api/verify-image", async (req, res) => {
  try {
    const { requestId, itemName, category, imageDataUrl } = req.body as {
      requestId?: string;
      itemName?: string;
      category?: string;
      imageDataUrl?: string;
    };

    if (!imageDataUrl) {
      return res.status(400).json({ error: "imageDataUrl is required" });
    }

    // Try to pull the request from DB if requestId is real
    let dbRequest: RequestRow | undefined;
    if (requestId) {
      dbRequest = db
        .prepare("SELECT * FROM requests WHERE id = ?")
        .get(requestId) as RequestRow | undefined;
    }

    // Decide which itemName/category to use
    const finalItemName = dbRequest?.item_name ?? itemName;
    const finalCategory = dbRequest?.category ?? category;

    if (!finalItemName) {
      return res.status(400).json({
        error:
          "Could not determine itemName. Provide itemName (for mock requests) or a valid requestId.",
      });
    }

    const result = await callWatsonxVerifyImage({
      itemName: finalItemName,
      category: finalCategory,
      imageDataUrl,
    });

    // Only update DB status if this was a real DB request
    if (dbRequest?.id && result?.isMatch && Number(result?.confidence ?? 0) >= 80) {
      db.prepare("UPDATE requests SET status = 'verified' WHERE id = ?").run(dbRequest.id);
    }

    return res.json(result);
  } catch (err: any) {
    console.error("verify-image error:", err);
    return res.status(500).json({ error: err.message || "Verification failed" });
  }
});

  /**
   * Matchmaking endpoint
   */
  app.get("/api/requests/:id/matches", async (req, res) => {
    try {
      const request = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id) as RequestRow | undefined;
      if (!request) return res.status(404).json({ error: "Request not found" });

      const borrower = db.prepare("SELECT * FROM users WHERE id = ?").get(request.borrower_id) as UserRow | undefined;
      if (!borrower) return res.status(404).json({ error: "Borrower not found" });

      const lenders = db.prepare(`
        SELECT * FROM users 
        WHERE available_mode = 1 
        AND id != ? 
        AND lat IS NOT NULL 
        AND lng IS NOT NULL
        AND lending_categories LIKE ?
      `).all(request.borrower_id, `%${request.category}%`) as UserRow[];

      const candidates = lenders
        .map((lender) => {
          const R = 3958.8; // miles
          const dLat = ((lender.lat as number) - (borrower.lat as number)) * Math.PI / 180;
          const dLng = ((lender.lng as number) - (borrower.lng as number)) * Math.PI / 180;

          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((borrower.lat as number) * Math.PI / 180) *
              Math.cos((lender.lat as number) * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;

          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distanceMiles = R * c;

          return {
            id: lender.id,
            name: lender.name,
            email: lender.email,
            gender: lender.gender,
            reliability_score: lender.reliability_score,
            response_rate: lender.response_rate,
            distanceMiles,
            categories: lender.lending_categories,
          };
        })
        .filter((l) => l.distanceMiles <= request.max_distance);

      if (candidates.length === 0) return res.json([]);

      const hasIbm = !!process.env.IBM_API_KEY && !!process.env.IBM_PROJECT_ID && !!process.env.IBM_URL;

      if (!hasIbm) {
        const fallback = candidates
          .sort((a, b) => a.distanceMiles - b.distanceMiles)
          .map((l, idx) => ({ id: l.id, name: l.name, email: l.email, score: 1 - idx * 0.05, distance: l.distanceMiles }));
        return res.json(fallback);
      }

      const ai = await callWatsonxMatchmake({
        request: {
          item_name: request.item_name,
          category: request.category,
          duration_hours: request.duration_hours,
          max_distance: request.max_distance,
          gender_preference: request.gender_preference,
        },
        borrower: { id: borrower.id, name: borrower.name, gender: borrower.gender, lat: borrower.lat, lng: borrower.lng },
        lenders: candidates,
      });

      const ranked = (ai?.ranked ?? []) as { lenderId: string; aiScore: number; reason: string }[];
      const byId = new Map(candidates.map((c) => [c.id, c]));

      const output = ranked
        .map((r) => {
          const l = byId.get(r.lenderId);
          if (!l) return null;
          return { id: l.id, name: l.name, email: l.email, score: typeof r.aiScore === "number" ? r.aiScore : 0.5, distance: l.distanceMiles, reason: r.reason };
        })
        .filter(Boolean);

      return res.json(output);
    } catch (err: any) {
      console.error("AI matchmaking error:", err);
      return res.status(500).json({ error: err.message || "AI matchmaking failed" });
    }
  });

  app.post("/api/requests/:id/accept", (req, res) => {
    const { lenderId } = req.body;
    db.prepare("UPDATE requests SET lender_id = ?, status = 'matched' WHERE id = ?").run(lenderId, req.params.id);
    res.json({ success: true });
  });

  app.post("/api/requests/:id/pay", (req, res) => {
    const { amount, platformFee, lenderEarnings } = req.body;
    const transactionId = Math.random().toString(36).substring(7);

    db.prepare("INSERT INTO transactions (id, request_id, amount, platform_fee, lender_earnings, status) VALUES (?, ?, ?, ?, ?, 'escrow')")
      .run(transactionId, req.params.id, amount, platformFee, lenderEarnings);

    db.prepare("UPDATE requests SET status = 'paid' WHERE id = ?").run(req.params.id);

    res.json({ transactionId });
  });

  app.post("/api/requests/:id/complete", (req, res) => {
    db.prepare("UPDATE requests SET status = 'completed' WHERE id = ?").run(req.params.id);
    db.prepare("UPDATE transactions SET status = 'released' WHERE request_id = ?").run(req.params.id);
    res.json({ success: true });
  });

  /**
   * Helpful: list models available to your account
   */
  app.get("/api/ibm/models", async (req, res) => {
    try {
      const IBM_URL = process.env.IBM_URL || "https://us-south.ml.cloud.ibm.com";
      const token = await getIamAccessToken();

      const resp = await fetch(`${IBM_URL}/ml/v1/foundation_model_specs?version=2025-02-11`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });

      const data = (await resp.json()) as any;
      if (!resp.ok) return res.status(resp.status).json(data);

      const models = (data?.resources ?? []).map((m: any) => m?.model_id).filter(Boolean);
      res.json({ count: models.length, models });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development (keep AFTER API routes)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();