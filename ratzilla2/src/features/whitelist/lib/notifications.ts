/**
 * Email notification extension point.
 *
 * Blackwater Labs ratzilla2 has no email provider configured.
 * Wire this module when adding Resend, SendGrid, Cloudflare Email, etc.
 */

export interface NotificationPreferences {
  instantConfirmations: boolean;
  dailySummary: boolean;
  importCompletion: boolean;
  reviewRequired: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  instantConfirmations: false,
  dailySummary: false,
  importCompletion: true,
  reviewRequired: true,
};

export async function sendConfirmationAlert(_payload: {
  walletAddress: string;
  confirmedAt: string;
}): Promise<void> {
  // Extension point — implement when email provider is available.
}

export async function sendImportCompletionAlert(_payload: {
  batchName: string;
  imported: number;
  skipped: number;
}): Promise<void> {
  // Extension point — implement when email provider is available.
}

export async function sendDailySummary(_payload: {
  confirmedToday: number;
  pendingReview: number;
}): Promise<void> {
  // Extension point — implement when email provider is available.
}
