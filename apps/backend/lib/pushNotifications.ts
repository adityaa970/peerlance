import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Send push notifications via the Expo Push API.
 * Accepts an array of Expo push tokens and a notification payload.
 * Batches requests (max 100 per call) as recommended by Expo.
 *
 * Returns ticket IDs so receipts can be checked later.
 */
interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

interface ExpoPushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export async function sendPushNotifications(
  pushTokens: string[],
  payload: PushPayload
) {
  // Filter out empty/null tokens
  const validTokens = pushTokens.filter(
    (t) => t && t.startsWith('ExponentPushToken')
  );

  if (validTokens.length === 0) return;

  const messages = validTokens.map((token) => ({
    to: token,
    sound: 'default' as const,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  }));

  // Batch into chunks of 100
  const chunks: typeof messages[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  const allTicketIds: string[] = [];
  const tokenToTicketIndex: Map<number, string> = new Map();
  let globalIndex = 0;

  for (const chunk of chunks) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();
      const tickets: ExpoPushTicket[] = result.data || [];

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const token = chunk[i]?.to;

        // If sending itself failed with DeviceNotRegistered, clean up immediately
        if (
          ticket.status === 'error' &&
          ticket.details?.error === 'DeviceNotRegistered'
        ) {
          await removeDeadToken(token);
        }

        // Collect ticket IDs for receipt checking later
        if (ticket.status === 'ok' && ticket.id) {
          allTicketIds.push(ticket.id);
          tokenToTicketIndex.set(allTicketIds.length - 1, token);
        }

        globalIndex++;
      }
    } catch (error) {
      console.error('Error sending push notification batch:', error);
    }
  }

  // Schedule receipt check after 15 seconds (Expo recommends waiting 15+ seconds)
  if (allTicketIds.length > 0) {
    setTimeout(() => {
      checkReceipts(allTicketIds, tokenToTicketIndex).catch((err) =>
        console.error('Receipt check failed:', err)
      );
    }, 20000);
  }
}

/**
 * Check push notification delivery receipts from Expo.
 * If any token is reported as DeviceNotRegistered, remove it from the database.
 */
async function checkReceipts(
  ticketIds: string[],
  tokenMap: Map<number, string>
) {
  // Batch receipt requests (max 1000 per call)
  const chunks: string[][] = [];
  for (let i = 0; i < ticketIds.length; i += 1000) {
    chunks.push(ticketIds.slice(i, i + 1000));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch(
        'https://exp.host/--/api/v2/push/getReceipts',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ids: chunk }),
        }
      );

      const result = await response.json();
      const receipts = result.data || {};

      for (const [ticketId, receipt] of Object.entries(receipts)) {
        const r = receipt as any;
        if (
          r.status === 'error' &&
          r.details?.error === 'DeviceNotRegistered'
        ) {
          // Find the token that corresponds to this ticket
          const ticketIndex = ticketIds.indexOf(ticketId);
          const deadToken = tokenMap.get(ticketIndex);
          if (deadToken) {
            await removeDeadToken(deadToken);
          }
        }
      }
    } catch (error) {
      console.error('Error checking push receipts:', error);
    }
  }
}

/**
 * Remove a dead/unregistered push token from the database.
 * This prevents Expo from rate-limiting us for sending to invalid tokens.
 */
async function removeDeadToken(token: string) {
  try {
    const { error } = await supabase
      .from('User')
      .update({ pushToken: null, updatedAt: new Date().toISOString() })
      .eq('pushToken', token);

    if (error) {
      console.error('Failed to remove dead token:', error);
    } else {
      console.log(`Removed dead push token: ${token.substring(0, 20)}...`);
    }
  } catch (err) {
    console.error('Error removing dead token:', err);
  }
}
/**
 * Find all admins and send them a notification.
 */
export async function notifyAdmins(payload: PushPayload) {
  try {
    // 1. Fetch all admins with push tokens and notifications enabled
    const { data: admins, error } = await supabase
      .from('User')
      .select('pushToken')
      .eq('role', 'admin')
      .neq('pushToken', null)
      .eq('pushNotificationsEnabled', true);

    if (error) throw error;
    if (!admins || admins.length === 0) return;

    // 2. Extract tokens
    const tokens = admins.map((a) => a.pushToken as string);

    // 3. Send notifications
    await sendPushNotifications(tokens, payload);
    console.log(`Sent notification to ${admins.length} admins: ${payload.title}`);
  } catch (error) {
    console.error('Failed to notify admins:', error);
  }
}

/**
 * Find a specific user and send them a notification.
 */
export async function notifyUser(userId: string, payload: PushPayload) {
  try {
    // 1. Fetch user's push token and status
    const { data: user, error } = await supabase
      .from('User')
      .select('pushToken, pushNotificationsEnabled')
      .eq('id', userId)
      .single();

    if (error) throw error;
    if (!user || !user.pushToken || !user.pushNotificationsEnabled) return;

    // 2. Send notification
    await sendPushNotifications([user.pushToken], payload);
    console.log(`Sent notification to user ${userId}: ${payload.title}`);
  } catch (error) {
    console.error(`Failed to notify user ${userId}:`, error);
  }
}
