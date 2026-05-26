import type express from "express";
import { createPartFromBase64, GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";
import readXlsxFile from "read-excel-file/node";
import { z } from "zod";

type ImportedAsset = {
  symbol?: string;
  name?: string;
  type?: string;
  quantity?: unknown;
  averagePrice?: unknown;
  price?: unknown;
  buyPrice?: unknown;
  entryPrice?: unknown;
  confidence?: unknown;
  notes?: unknown;
};

type RegisterAiImportRoutesOptions = {
  parseLooseNumber: (value: unknown) => number | null;
  extractJsonObject: (rawText: string) => unknown;
  heuristicPortfolioExtract: (text: string) => ImportedAsset[];
};

const importFileRequestSchema = z.object({
  fileBase64: z.string().optional(),
  imageBase64: z.string().optional(),
  mimeType: z.string().trim().min(3).max(120),
  fileName: z.string().trim().min(1).max(220),
}).refine((data) => Boolean(data.fileBase64 || data.imageBase64), {
  message: "fileBase64 or imageBase64 is required",
});

export function registerAiImportRoutes(app: express.Express, options: RegisterAiImportRoutesOptions) {
  app.post("/api/ai/import-file", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const parsedImport = importFileRequestSchema.safeParse(req.body || {});

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is required for AI import" });
    }

    if (!parsedImport.success) {
      return res.status(400).json({ error: "A valid file is required" });
    }

    const fileBase64 = parsedImport.data.fileBase64 || parsedImport.data.imageBase64 || "";
    const mimeType = parsedImport.data.mimeType;
    const fileName = parsedImport.data.fileName;

    try {
      const buffer = Buffer.from(fileBase64, "base64");
      const lowerName = fileName.toLowerCase();
      let extractedText = "";
      const isImage = mimeType.startsWith("image/");

      if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || lowerName.endsWith(".xlsx")) {
        if (lowerName.endsWith(".xls") && !lowerName.endsWith(".xlsx")) {
          return res.status(400).json({ error: "Legacy .xls files are not supported. Export as .xlsx, CSV or TXT." });
        }

        const sheets = await readXlsxFile(buffer);
        const sheetText = sheets.slice(0, 5).map((sheet: any) => {
          const rows = sheet.data.slice(0, 120)
            .map((row: unknown[]) => row.map((cell) => cell == null ? "" : String(cell)));
          const previewRows = rows.map((row: string[]) => row.map((cell) => cell.trim()).join(" | ")).join("\n");
          const csv = rows.map((row: string[]) => row.map((cell) => {
            const safeCell = cell.replace(/"/g, '""');
            return /[",\n]/.test(safeCell) ? `"${safeCell}"` : safeCell;
          }).join(",")).join("\n");
          return `Sheet: ${sheet.sheet}\nTable preview:\n${previewRows}\n\nCSV:\n${csv}`;
        });
        extractedText = sheetText.join("\n\n").slice(0, 60000);
      } else if (mimeType.includes("wordprocessingml") || lowerName.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value.slice(0, 60000);
      } else if (mimeType.startsWith("text/") || lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
        extractedText = buffer.toString("utf8").slice(0, 60000);
      } else if (!isImage) {
        return res.status(400).json({ error: "Supported files: images, CSV, TXT, XLSX and DOCX" });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an investment portfolio extraction engine. Read the provided ${isImage ? "screenshot/image with OCR" : "document text/table"} and detect visible portfolio positions, orders, transactions, or holdings.

Return only valid JSON, no markdown, no commentary.

Schema:
{
  "assets": [
    {
      "symbol": "NVDA",
      "name": "NVIDIA Corporation",
      "type": "stock",
      "quantity": 2.5,
      "averagePrice": 123.45,
      "confidence": 0.86,
      "notes": "short reason"
    }
  ]
}

Rules:
- Detect both stocks and crypto.
- type must be "stock" or "crypto".
- quantity must be numeric. Use null if not visible.
- averagePrice must be numeric purchase price, cost basis, entry price, or average buy price. Use null if not visible.
- Prefer ticker symbols over company names.
- Common column names can be Symbol, Ticker, Asset, Coin, Crypto, Stock, Quantity, Qty, Units, Shares, Amount, Average Price, Avg Price, Buy Price, Entry, Cost Basis, Precio, Cantidad, Compra.
- Spanish and Portuguese documents are common. Understand "cantidad", "precio promedio", "precio de compra", "ativo", "carteira", "acao", and "cripto".
- If the file only shows current value but not quantity or buy price, include the asset with null fields.
- Do not invent missing quantities or prices.
- If unsure, still return the symbol with null quantity or averagePrice and a low confidence note.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
        },
        contents: isImage
          ? [prompt, createPartFromBase64(fileBase64, mimeType)]
          : `${prompt}\n\nFile name: ${fileName}\n\nExtracted content:\n${extractedText}`,
      });

      const rawText = response.text || "";
      let parsed: any = { assets: [] };
      try {
        parsed = options.extractJsonObject(rawText);
      } catch (parseError) {
        console.error("AI import JSON parse failed:", parseError, rawText.slice(0, 500));
      }
      const aiAssets = Array.isArray(parsed?.assets) ? parsed.assets : [];
      const fallbackAssets = !isImage && extractedText ? options.heuristicPortfolioExtract(extractedText) : [];
      const assets = aiAssets.length > 0 ? aiAssets : fallbackAssets;
      res.json({
        assets: assets.map((asset: ImportedAsset) => ({
          symbol: String(asset?.symbol || "").toUpperCase().replace(/[^A-Z0-9.-]/g, ""),
          name: typeof asset?.name === "string" ? asset.name : "",
          type: asset?.type === "crypto" ? "crypto" : "stock",
          quantity: options.parseLooseNumber(asset?.quantity),
          averagePrice: options.parseLooseNumber(asset?.averagePrice ?? asset?.price ?? asset?.buyPrice ?? asset?.entryPrice),
          confidence: Number.isFinite(Number(asset?.confidence)) ? Math.min(Math.max(Number(asset.confidence), 0), 1) : null,
          notes: typeof asset?.notes === "string" ? asset.notes : "",
        })).filter((asset: { symbol: string }) => asset.symbol),
        source: aiAssets.length > 0 ? "gemini" : "fallback-parser",
      });
    } catch (error) {
      console.error("AI import failed:", error);
      res.status(500).json({ error: "Could not extract portfolio positions from that file" });
    }
  });
}
