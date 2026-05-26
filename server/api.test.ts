import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../server";

describe("API endpoints", () => {
  it("rejects invalid market symbols", async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app)
      .get("/api/market/asset")
      .query({ symbol: "", type: "stock" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Symbol is required");
  });

  it("protects private AI endpoints with Firebase auth", async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app)
      .post("/api/ai/portfolio-briefing")
      .send({ language: "en", portfolio: [], metrics: {}, risk: {}, alerts: [], news: [] });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Authentication required");
  });

  it("protects support endpoint with Firebase auth before body validation", async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app)
      .post("/api/support")
      .send({ email: "invalid", message: "" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Authentication required");
  });

  it("protects account deletion with Firebase auth", async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app)
      .delete("/api/data/account");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Authentication required");
  });

  it("serves news through the extracted news route", async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app)
      .get("/api/news")
      .query({ q: "markets" });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.articles)).toBe(true);
  });
});
