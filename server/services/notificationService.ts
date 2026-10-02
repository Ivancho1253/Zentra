import axios from 'axios';
import type admin from 'firebase-admin';
import { brand } from '../../shared/brand';

type AlertNotificationInput = {
  userId: string;
  email?: string;
  pushTokens?: string[];
  symbol: string;
  type: string;
  condition: import('../../shared/alerts').AlertCondition;
  targetPrice: number;
  currentPrice: number | null;
  message?: string;
  idempotencyKey?: string;
};

const formatAlertSubject = (input: AlertNotificationInput) =>
  `${brand.name} alert: ${input.symbol} ${input.condition} ${input.targetPrice}`;

const formatAlertBody = (input: AlertNotificationInput) =>
  [
    `Your ${input.symbol} alert was triggered.`,
    `Condition: ${input.condition} · threshold ${input.targetPrice}`,
    input.message || (input.currentPrice == null ? '' : `Current price: ${input.currentPrice}`),
    '',
    'This is market context, not financial advice.',
  ].join('\n');

export async function createInAppNotification(
  firestore: admin.firestore.Firestore,
  input: AlertNotificationInput,
) {
  const notificationRef = firestore
    .collection('users')
    .doc(input.userId)
    .collection('notifications')
    .doc();

  await notificationRef.set({
    type: 'price_alert',
    symbol: input.symbol,
    assetType: input.type,
    title: formatAlertSubject(input),
    message: formatAlertBody(input),
    status: 'unread',
    createdAt: new Date().toISOString(),
    targetPrice: input.targetPrice,
    currentPrice: input.currentPrice,
  });
}

export async function sendAlertEmail(input: AlertNotificationInput) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.SUPPORT_FROM_EMAIL || `${brand.name} Alerts <onboarding@resend.dev>`;

  if (!resendApiKey || !input.email) {
    return { sent: false, reason: 'email_not_configured' };
  }

  await axios.post(
    'https://api.resend.com/emails',
    {
      from: fromEmail,
      to: input.email,
      subject: formatAlertSubject(input),
      text: formatAlertBody(input),
    },
    {
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
      },
      timeout: 12000,
    },
  );

  return { sent: true };
}

export async function sendAlertPush(firebaseAdmin: typeof admin, input: AlertNotificationInput) {
  const tokens = (input.pushTokens || []).filter(Boolean);
  if (tokens.length === 0) {
    return { sent: false, reason: 'push_not_configured' };
  }

  const result = await firebaseAdmin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: formatAlertSubject(input),
      body: input.message || `${input.symbol} alert triggered`,
    },
    data: {
      type: 'price_alert',
      symbol: input.symbol,
      currentPrice: String(input.currentPrice),
      targetPrice: String(input.targetPrice),
    },
  });

  if (result.failureCount > 0) throw new Error('Some push deliveries failed');

  return { sent: true };
}
