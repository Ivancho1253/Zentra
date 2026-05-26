import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rules = fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf8");

describe("Firestore rules contract", () => {
  it("keeps user-owned collections scoped by uid", () => {
    expect(rules).toContain("function isOwner(userId)");
    expect(rules).toContain("request.auth.uid == userId");
    expect(rules).toContain("match /users/{userId}");
  });

  it("validates portfolio alerts before writes", () => {
    expect(rules).toContain("function isValidAlert(data)");
    expect(rules).toContain("data.condition in ['above', 'below']");
    expect(rules).toContain("data.status in ['active', 'paused', 'triggered']");
    expect(rules).toContain("match /alerts/{alertId}");
  });

  it("prevents clients from creating server-generated notifications", () => {
    expect(rules).toContain("match /notifications/{notificationId}");
    expect(rules).toContain("allow create: if false;");
    expect(rules).toContain("affectedKeys().hasOnly(['status'])");
  });
});
