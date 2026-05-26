import type express from "express";
import axios from "axios";
import { z } from "zod";

const supportRequestSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  email: z.email().max(180),
  subject: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().min(5).max(4000),
});

export function registerSupportRoutes(app: express.Express) {
  app.post("/api/support", async (req, res) => {
    const supportEmail = "ivangonzalo1253@gmail.com";
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.SUPPORT_FROM_EMAIL || "ZENTRA Support <onboarding@resend.dev>";
    const parsedSupport = supportRequestSchema.safeParse(req.body || {});

    if (!parsedSupport.success) {
      return res.status(400).json({ error: "A valid email and message are required" });
    }

    const { name, email, subject, message } = parsedSupport.data;

    if (!resendApiKey) {
      console.log("Support message received without RESEND_API_KEY configured:", {
        hasName: Boolean(name),
        emailDomain: email.includes("@") ? email.split("@").pop() : "invalid",
        hasSubject: Boolean(subject),
        messageLength: message.length,
      });
      return res.json({ fallback: true, ok: true, message: "Support message received locally. Configure RESEND_API_KEY to send email." });
    }

    try {
      await axios.post("https://api.resend.com/emails", {
        from: fromEmail,
        to: supportEmail,
        reply_to: email,
        subject: subject || "ZENTRA support request",
        text: `Name: ${name || "Not provided"}\nEmail: ${email}\n\n${message}`,
      }, {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 12000,
      });

      res.json({ ok: true });
    } catch (error) {
      console.error("Support email failed:", error);
      res.status(500).json({ error: "Could not send support message" });
    }
  });
}
