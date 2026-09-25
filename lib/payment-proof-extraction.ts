import { demoModeEnabled, demoPayments } from "@/lib/demo-mode";

export type ExtractedPaymentDetails = {
  amount: number | null;
  paymentDate: string | null;
  transactionId: string | null;
  utr: string | null;
  senderName: string | null;
  receiverName: string | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  rawText: string | null;
  confidence: "high" | "medium" | "low";
};

export interface PaymentProofExtractionProvider {
  extractPaymentDetails(input: {
    paymentId: number;
    fileBuffer?: ArrayBuffer;
    fileName?: string;
    fileType?: string;
    expectedAmount?: number;
    expectedClient?: string;
  }): Promise<ExtractedPaymentDetails>;
}

/**
 * Real Vision / OCR provider that parses receipts and bank transfer slips
 * when AI_PROVIDER and AI_API_KEY are configured in production.
 */
export class VisionPaymentProofExtractionProvider implements PaymentProofExtractionProvider {
  async extractPaymentDetails(input: {
    paymentId: number;
    fileBuffer?: ArrayBuffer;
    fileName?: string;
    fileType?: string;
    expectedAmount?: number;
    expectedClient?: string;
  }): Promise<ExtractedPaymentDetails> {
    const provider = process.env.AI_PROVIDER || process.env.OCR_PROVIDER;
    const apiKey = process.env.AI_API_KEY || process.env.OCR_API_KEY;

    if (!provider || !apiKey) {
      throw new Error("OCR_PROVIDER_NOT_CONFIGURED");
    }

    // When provider is OpenAI Vision
    if (provider.toLowerCase() === "openai" && input.fileBuffer) {
      try {
        const base64 = Buffer.from(input.fileBuffer).toString("base64");
        const mimeType = input.fileType || "image/png";
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You are an accounts verification assistant. Extract payment details from the attached receipt/slip as JSON with fields: amount (number), paymentDate (YYYY-MM-DD), transactionId (string), utr (string), senderName (string), receiverName (string), paymentMethod (string), referenceNumber (string), confidence ('high'|'medium'|'low'), rawSummary (string).",
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Extract payment verification fields from this proof." },
                  { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
                ],
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`OCR provider request failed with status ${response.status}`);
        }

        const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error("Empty response from OCR provider.");

        const parsed = JSON.parse(content) as Record<string, unknown>;
        return {
          amount: typeof parsed.amount === "number" ? parsed.amount : null,
          paymentDate: typeof parsed.paymentDate === "string" ? parsed.paymentDate : null,
          transactionId: typeof parsed.transactionId === "string" ? parsed.transactionId : null,
          utr: typeof parsed.utr === "string" ? parsed.utr : null,
          senderName: typeof parsed.senderName === "string" ? parsed.senderName : null,
          receiverName: typeof parsed.receiverName === "string" ? parsed.receiverName : null,
          paymentMethod: typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : null,
          referenceNumber: typeof parsed.referenceNumber === "string" ? parsed.referenceNumber : null,
          rawText: typeof parsed.rawSummary === "string" ? parsed.rawSummary : content,
          confidence:
            parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
              ? parsed.confidence
              : "medium",
        };
      } catch (err) {
        throw new Error(`OCR_EXTRACTION_FAILED: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    throw new Error(`UNSUPPORTED_OCR_PROVIDER: ${provider}`);
  }
}

/** Deliberately deterministic and unavailable outside local development demo mode. */
export class DemoPaymentProofExtractionProvider implements PaymentProofExtractionProvider {
  async extractPaymentDetails(input: { paymentId: number }): Promise<ExtractedPaymentDetails> {
    const payment = demoPayments().find((row) => row.id === input.paymentId);
    if (!demoModeEnabled() || !payment || payment.client !== "UrbanNest Interiors") {
      throw new Error("OCR_PROVIDER_NOT_CONFIGURED");
    }
    return {
      amount: 18000,
      paymentDate: payment.dueDate,
      transactionId: "DEMO-UTR-18000",
      utr: "DEMO-UTR-18000",
      senderName: "UrbanNest Interiors",
      receiverName: "ARKA Demo Account",
      paymentMethod: "DEMO",
      referenceNumber: "DEMO-UTR-18000",
      rawText: "DEMO EXTRACTION — no real payment verification is being performed.",
      confidence: "high",
    };
  }
}

export function getPaymentProofExtractionProvider(): PaymentProofExtractionProvider {
  if (demoModeEnabled()) return new DemoPaymentProofExtractionProvider();
  if (process.env.AI_PROVIDER && process.env.AI_API_KEY) {
    return new VisionPaymentProofExtractionProvider();
  }
  throw new Error("OCR_PROVIDER_NOT_CONFIGURED");
}
