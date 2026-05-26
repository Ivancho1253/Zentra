import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const runIfEmulator = emulatorHost ? describe : describe.skip;

runIfEmulator("Firestore rules emulator", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, port] = String(emulatorHost).split(":");
    testEnv = await initializeTestEnvironment({
      projectId: "zentra-rules-test",
      firestore: {
        host,
        port: Number(port || 8080),
        rules: fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it("allows an owner to read and write a valid alert", async () => {
    const db = testEnv.authenticatedContext("user-a", { email: "a@test.com" }).firestore();
    const alertRef = doc(db, "users/user-a/alerts/NVDA-above");

    await assertSucceeds(setDoc(alertRef, {
      symbol: "NVDA",
      type: "stock",
      condition: "above",
      targetPrice: 500,
      status: "active",
      createdAt: new Date().toISOString(),
    }));
    await assertSucceeds(getDoc(alertRef));
  });

  it("blocks users from reading another user portfolio", async () => {
    const ownerDb = testEnv.authenticatedContext("owner", { email: "owner@test.com" }).firestore();
    const otherDb = testEnv.authenticatedContext("other", { email: "other@test.com" }).firestore();
    const assetRef = doc(ownerDb, "users/owner/assets/BTC");

    await assertSucceeds(setDoc(assetRef, {
      symbol: "BTC",
      type: "crypto",
      averagePrice: 50000,
      totalQuantity: 0.25,
    }));

    await assertFails(getDoc(doc(otherDb, "users/owner/assets/BTC")));
  });

  it("prevents clients from creating server-generated notifications", async () => {
    const db = testEnv.authenticatedContext("user-a", { email: "a@test.com" }).firestore();

    await assertFails(setDoc(doc(db, "users/user-a/notifications/test"), {
      type: "price_alert",
      symbol: "NVDA",
      title: "Alert",
      message: "Triggered",
      status: "unread",
      createdAt: new Date().toISOString(),
    }));
  });

  it("allows only notification status updates", async () => {
    const db = testEnv.authenticatedContext("user-a", { email: "a@test.com" }).firestore();
    const notificationRef = doc(db, "users/user-a/notifications/server-test");

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/user-a/notifications/server-test"), {
        type: "price_alert",
        symbol: "NVDA",
        title: "Alert",
        message: "Triggered",
        status: "unread",
        createdAt: new Date().toISOString(),
      });
    });

    await assertSucceeds(updateDoc(notificationRef, { status: "read" }));
    await assertFails(updateDoc(notificationRef, { message: "edited" }));
  });
});

if (!emulatorHost) {
  describe("Firestore rules emulator", () => {
    it("is skipped until FIRESTORE_EMULATOR_HOST is set", () => {
      expect(emulatorHost).toBeUndefined();
    });
  });
}
