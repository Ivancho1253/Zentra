import axios from "axios";
import type admin from "firebase-admin";

type AlertNotificationInput = {
  userId: string;
  email?: string;
  pushTokens?: string[];
  symbol: string;
  type: string;
  condition: "above" | "below";
  targetPrice: number;
  currentPrice: number;
};

const formatAlertSubject = (input: AlertNotificationInput) =>
  `ZENTRA alert: ${input.symbol} ${input.condition} ${input.targetPrice}`;

const formatAlertBody = (input: AlertNotificationInput) =>
  [
    `Your ${input.symbol} alert was triggered.`,
    `Condition: price ${input.condition} ${input.targetPrice}`,
    `Current price: ${input.currentPrice}`,
    "",
    "This is market context, not financial advice.",
  ].join("\n");

export async function createInAppNotification(
  firestore: admin.firestore.Firestore,
  input: AlertNotificationInput,
) {
  const notificationRef = firestore
    .collection("users")
    .doc(input.userId)
    .collection("notifications")
    .doc();

  await notificationRef.set({
    type: "price_alert",
    symbol: input.symbol,
    assetType: input.type,
    title: formatAlertSubject(input),
    message: formatAlertBody(input),
    status: "unread",
    createdAt: new Date().toISOString(),
    targetPrice: input.targetPrice,
    currentPrice: input.currentPrice,
  });
}

export async function sendAlertEmail(input: AlertNotificationInput) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.SUPPORT_FROM_EMAIL || "ZENTRA Alerts <onboarding@resend.dev>";

  if (!resendApiKey || !input.email) {
    return { sent: false, reason: "email_not_configured" };
  }

  await axios.post("https://api.resend.com/emails", {
    from: fromEmail,
    to: input.email,
    subject: formatAlertSubject(input),
    text: formatAlertBody(input),
  }, {
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 12000,
  });

  return { sent: true };
}

export async function sendAlertPush(firebaseAdmin: typeof admin, input: AlertNotificationInput) {
  const tokens = (input.pushTokens || []).filter(Boolean);
  if (tokens.length === 0) {
    return { sent: false, reason: "push_not_configured" };
  }

  await firebaseAdmin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: formatAlertSubject(input),
      body: `${input.symbol} is now ${input.currentPrice}`,
    },
    data: {
      type: "price_alert",
      symbol: input.symbol,
      currentPrice: String(input.currentPrice),
      targetPrice: String(input.targetPrice),
    },
  });

  return { sent: true };
}
