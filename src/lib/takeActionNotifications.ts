import { getStoredSession } from "@/application/auth/session";
import { supabaseFunctionRequest } from "@/infrastructure/supabase/client";

export type TakeActionNotificationInput = {
  recipients: string[];
  actionTypeLabel: string;
  message: string;
  requestedBy: string;
  contextName: string;
  contextUrl: string;
  urgency?: string;
};

type TakeActionNotificationResponse = {
  sent?: boolean;
  reason?: string;
};

function uniqueEmails(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean)));
}

export async function sendTakeActionNotification(input: TakeActionNotificationInput): Promise<boolean> {
  const recipients = uniqueEmails(input.recipients);
  if (recipients.length === 0) return false;

  const session = getStoredSession();
  const response = await supabaseFunctionRequest<TakeActionNotificationResponse>(
    "send-take-action-email",
    {
      recipients,
      actionTypeLabel: input.actionTypeLabel,
      message: input.message,
      requestedBy: input.requestedBy,
      contextName: input.contextName,
      contextUrl: input.contextUrl,
      urgency: input.urgency ?? "normal",
    },
    session?.accessToken,
  );

  if (!response.sent && response.reason) {
    console.warn(`Take Action email was not sent: ${response.reason}`);
  }

  return Boolean(response.sent);
}
