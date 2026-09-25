export type EmailMessage = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64
    contentType: string;
  }>;
};

export type EmailSendResult =
  | { ok: true; id?: string }
  | { ok: false; code: "EMAIL_PROVIDER_NOT_CONFIGURED" | "DELIVERY_FAILED" | "INVALID_RECIPIENT"; error?: string };

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_PROVIDER && process.env.EMAIL_API_KEY);
}

export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!message.to || !message.to.includes("@")) {
      return { ok: false, code: "INVALID_RECIPIENT" };
    }

    try {
      const from = process.env.EMAIL_FROM || "ARKA Billing <billing@arka.operations>";
      const payload: Record<string, unknown> = {
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      };

      if (message.attachments?.length) {
        payload.attachments = message.attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
        }));
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { ok: false, code: "DELIVERY_FAILED", error: errText };
      }

      const data = (await res.json()) as { id?: string };
      return { ok: true, id: data.id };
    } catch (err) {
      return { ok: false, code: "DELIVERY_FAILED", error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export function getEmailProvider(): EmailProvider | null {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase();
  const apiKey = process.env.EMAIL_API_KEY;

  if (!provider || !apiKey) {
    return null;
  }

  if (provider === "resend") {
    return new ResendEmailProvider(apiKey);
  }

  return null;
}
