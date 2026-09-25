import { paymentLifecycle } from "@/lib/payment-lifecycle";
import { reminderEligibility } from "@/lib/reminder-eligibility";

export type Action = {
  id: string;
  type: string;
  paymentId: number;
  client: string;
  service: string;
  amount: number;
  dueDate: string;
  paymentStatus: string;
  nextAction: string;
  reason: string;
  recommendedAction: string;
  context: string;
};

export class ActionIntelligenceService {
  actions(
    payments: Array<{
      id: number;
      client: string;
      service: string;
      expectedAmount: number;
      dueDate: string;
      status: string;
      email?: string | null;
    }>,
    now = new Date()
  ) {
    const result: Action[] = [];
    for (const p of payments) {
      const view = paymentLifecycle.present(p, now);
      let type: string | undefined;
      let context = "";
      const recommended = view.nextAction;

      if (view.status === "OVERDUE") {
        type = "PAYMENT_OVERDUE";
        context = "Payment overdue";
      } else if (view.status === "DUE_TODAY") {
        type = "PAYMENT_DUE";
        context = "Payment due today";
      } else if (view.status === "PROOF_UPLOADED") {
        type = "PAYMENT_PROOF_REVIEW";
        context = "Payment proof uploaded";
      } else if (view.status === "MANUAL_REVIEW") {
        type = "PAYMENT_MANUAL_REVIEW";
        context = "Manual accounts review required";
      } else if (view.status === "MISMATCH") {
        type = "PAYMENT_MISMATCH";
        context = "Payment mismatch";
      } else if (view.status === "VERIFIED") {
        type = "PAYMENT_VERIFIED_CONFIRMATION";
        context = "Payment verified";
      }

      if (type) {
        result.push({
          id: `${p.id}:${type}`,
          type,
          paymentId: p.id,
          client: p.client,
          service: p.service,
          amount: p.expectedAmount,
          dueDate: p.dueDate,
          paymentStatus: view.status,
          nextAction: view.nextAction,
          reason: view.attentionReason,
          recommendedAction: recommended,
          context,
        });
      }

      if (
        p.email &&
        reminderEligibility.getEligibleReminders({ ...p, email: p.email }, now).length &&
        ["UPCOMING", "DUE_TODAY", "OVERDUE"].includes(view.status)
      ) {
        result.push({
          id: `${p.id}:REMINDER_REQUIRED`,
          type: "REMINDER_REQUIRED",
          paymentId: p.id,
          client: p.client,
          service: p.service,
          amount: p.expectedAmount,
          dueDate: p.dueDate,
          paymentStatus: view.status,
          nextAction: "Send Reminder",
          reason: "A payment reminder is eligible.",
          recommendedAction: "Send Reminder",
          context: "Reminder eligible",
        });
      }
    }

    const order: Record<string, number> = {
      PAYMENT_OVERDUE: 0,
      PAYMENT_DUE: 1,
      PAYMENT_MISMATCH: 2,
      PAYMENT_MANUAL_REVIEW: 2,
      PAYMENT_PROOF_REVIEW: 3,
      PAYMENT_VERIFIED_CONFIRMATION: 4,
      REMINDER_REQUIRED: 5,
    };

    return result.sort((a, b) => (order[a.type] ?? 99) - (order[b.type] ?? 99));
  }
}

export const actionIntelligence = new ActionIntelligenceService();
