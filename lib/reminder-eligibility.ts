import { paymentLifecycle } from "@/lib/payment-lifecycle";

export type ReminderType =
  | "UPCOMING_REMINDER"
  | "DUE_TODAY_REMINDER"
  | "OVERDUE_REMINDER"
  | "OVERDUE_FOLLOWUP";

export type ReminderCandidate = {
  paymentId: number;
  reminderType: ReminderType;
  scheduledFor: string;
  reason: string;
  recipient: string;
};

const setting = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
};

const dateAtKolkata = (now: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

export class ReminderEligibilityService {
  getEligibleReminders(
    payment: { id: number; dueDate: string; status: string; email: string | null },
    now = new Date()
  ): ReminderCandidate[] {
    const status = paymentLifecycle.getPaymentStatus(payment, now);
    if (!payment.email || !["UPCOMING", "DUE_TODAY", "OVERDUE"].includes(status)) {
      return [];
    }

    const days = paymentLifecycle.getDaysUntilDue(payment, now);
    const today = dateAtKolkata(now);
    const upcoming = setting("REMINDER_UPCOMING_DAYS", 3);
    const overdue = setting("REMINDER_OVERDUE_DAYS", 1);
    const followup = setting("REMINDER_FOLLOWUP_DAYS", 3);

    let type: ReminderType | undefined;

    if (status === "UPCOMING" && days === upcoming) {
      type = "UPCOMING_REMINDER";
    } else if (status === "DUE_TODAY") {
      type = "DUE_TODAY_REMINDER";
    } else if (status === "OVERDUE") {
      // Fix LOG-01: For overdue payments, `days` is negative (-1, -2, -4, etc.)
      const overdueDays = -days;
      if (overdueDays === overdue) {
        type = "OVERDUE_REMINDER";
      } else if (overdueDays > overdue && (overdueDays - overdue) % followup === 0) {
        type = "OVERDUE_FOLLOWUP";
      }
    }

    return type
      ? [
          {
            paymentId: payment.id,
            reminderType: type,
            scheduledFor: today,
            reason: paymentLifecycle.getAttentionReason(payment, now),
            recipient: payment.email,
          },
        ]
      : [];
  }
}

export const reminderEligibility = new ReminderEligibilityService();
