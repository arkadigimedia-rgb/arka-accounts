import type { ReminderType } from "@/lib/reminder-eligibility";
import { getEmailProvider } from "@/lib/email-provider";

export type ReminderMessage = {
  type: ReminderType;
  recipient: string;
  client: string;
  service: string;
  amount: number;
  dueDate: string;
  reference?: string | null;
  invoiceNumber?: string | null;
};

export interface ReminderDeliveryProvider {
  sendReminder(
    message: ReminderMessage
  ): Promise<{ ok: true } | { ok: false; code: "EMAIL_PROVIDER_NOT_CONFIGURED" | "DELIVERY_FAILED" }>;
}

export const reminderSubject = (message: ReminderMessage) =>
  message.type === "UPCOMING_REMINDER"
    ? `Payment Reminder: Upcoming Due Date for ${message.client}`
    : message.type === "DUE_TODAY_REMINDER"
    ? `Payment Due Today: ₹${message.amount.toLocaleString("en-IN")} for ${message.service}`
    : `Urgent: Payment Overdue for ${message.client} (${message.service})`;

export class EmailReminderProvider implements ReminderDeliveryProvider {
  async sendReminder(message: ReminderMessage): Promise<{ ok: true } | { ok: false; code: "EMAIL_PROVIDER_NOT_CONFIGURED" | "DELIVERY_FAILED" }> {
    const provider = getEmailProvider();
    if (!provider) {
      return { ok: false, code: "EMAIL_PROVIDER_NOT_CONFIGURED" };
    }

    const subject = reminderSubject(message);
    const bodyText = `Dear ${message.client},\n\nThis is a payment reminder from ARKA Finance Operations regarding ${message.service}.\nExpected Amount: ₹${message.amount.toLocaleString("en-IN")}\nDue Date: ${message.dueDate}\n${message.reference ? `Reference: ${message.reference}\n` : ""}\nPlease arrange for payment settlement at your earliest convenience.\n\nRegards,\nARKA Accounts Team`;

    const result = await provider.send({
      to: message.recipient,
      subject,
      text: bodyText,
    });

    if (result.ok) {
      return { ok: true };
    }
    return { ok: false, code: "DELIVERY_FAILED" };
  }
}
