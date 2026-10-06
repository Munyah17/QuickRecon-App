import "server-only";

/**
 * WhatsApp delivery abstraction. The system depends ONLY on this interface;
 * swap the concrete provider (Meta Cloud API, Twilio, etc.) by implementing
 * it here — callers and delivery-history tracking stay untouched.
 */
export interface WhatsAppProvider {
  sendText(to: string, body: string): Promise<ProviderResult>;
  sendDocument(
    to: string,
    document: { buffer: Buffer; fileName: string; caption?: string }
  ): Promise<ProviderResult>;
  sendTemplate(
    to: string,
    template: string,
    params: Record<string, string>
  ): Promise<ProviderResult>;
}

export interface ProviderResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

class UnconfiguredProvider implements WhatsAppProvider {
  private fail(): ProviderResult {
    return { ok: false, error: "WhatsApp provider not configured" };
  }
  async sendText() {
    return this.fail();
  }
  async sendDocument() {
    return this.fail();
  }
  async sendTemplate() {
    return this.fail();
  }
}

class MetaCloudProvider implements WhatsAppProvider {
  constructor(
    private token: string,
    private senderId: string
  ) {}

  private async call(payload: object): Promise<ProviderResult> {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${this.senderId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      const body = await res.json();
      if (!res.ok) return { ok: false, error: body?.error?.message ?? "provider error" };
      return { ok: true, providerMessageId: body?.messages?.[0]?.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "network error" };
    }
  }

  /** Upload binary media to Meta's resumable upload endpoint; returns the
   * media_id needed to attach the file to a document message. */
  private async uploadMedia(
    buffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{ ok: boolean; mediaId?: string; error?: string }> {
    try {
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${this.senderId}/media`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.token}` },
          body: form,
        }
      );
      const body = await res.json();
      if (!res.ok || !body?.id) {
        return { ok: false, error: body?.error?.message ?? "media upload failed" };
      }
      return { ok: true, mediaId: body.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "network error" };
    }
  }

  sendText(to: string, body: string) {
    return this.call({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    });
  }

  async sendDocument(
    to: string,
    document: { buffer: Buffer; fileName: string; caption?: string }
  ): Promise<ProviderResult> {
    const mime = document.fileName.endsWith(".pdf")
      ? "application/pdf"
      : document.fileName.endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv";
    const up = await this.uploadMedia(document.buffer, document.fileName, mime);
    if (!up.ok) return { ok: false, error: up.error };
    return this.call({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: {
        id: up.mediaId,
        filename: document.fileName,
        caption: document.caption ?? "Reconciliation report attached.",
      },
    });
  }

  sendTemplate(to: string, template: string, params: Record<string, string>) {
    return this.call({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: Object.values(params).map((text) => ({ type: "text", text })),
          },
        ],
      },
    });
  }
}

export function getWhatsAppProvider(): WhatsAppProvider {
  const provider = process.env.WHATSAPP_PROVIDER;
  const key = process.env.WHATSAPP_API_KEY;
  const sender = process.env.WHATSAPP_SENDER_ID;
  if (provider === "meta" && key && sender) {
    return new MetaCloudProvider(key, sender);
  }
  return new UnconfiguredProvider();
}
