export type StoredFile = {
  key: string;
  contentType: string;
  body: ReadableStream<Uint8Array> | null;
  size: number;
};

export interface StorageProvider {
  put(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile>;
  delete(key: string): Promise<void>;
}

/** In-memory private storage for development, testing, and standard Vercel/Node deployments */
export class LocalStorageProvider implements StorageProvider {
  private static files = new Map<string, { body: ArrayBuffer; contentType: string }>();

  async put(key: string, body: ArrayBuffer, contentType: string) {
    LocalStorageProvider.files.set(key, { body: body.slice(0), contentType });
  }

  async get(key: string): Promise<StoredFile> {
    const file = LocalStorageProvider.files.get(key);
    if (!file) throw new Error("PROOF_NOT_FOUND");
    return {
      key,
      contentType: file.contentType,
      size: file.body.byteLength,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(file.body));
          controller.close();
        },
      }),
    };
  }

  async delete(key: string) {
    LocalStorageProvider.files.delete(key);
  }
}

/** Private Cloudflare R2 storage when deployed on Cloudflare Workers */
export class ProductionStorageProvider implements StorageProvider {
  constructor(private readonly bucket: {
    put: (key: string, body: ArrayBuffer, options?: any) => Promise<any>;
    get: (key: string) => Promise<any>;
    delete: (key: string) => Promise<any>;
  }) {}

  async put(key: string, body: ArrayBuffer, contentType: string) {
    await this.bucket.put(key, body, { httpMetadata: { contentType } });
  }

  async get(key: string): Promise<StoredFile> {
    const object = await this.bucket.get(key);
    if (!object) throw new Error("PROOF_NOT_FOUND");
    return {
      key,
      contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
      size: object.size,
      body: object.body,
    };
  }

  async delete(key: string) {
    await this.bucket.delete(key);
  }
}

export function getStorageProvider(): StorageProvider {
  // If running on Vercel, Node.js, or local development without R2
  if (process.env.STORAGE_PROVIDER !== "r2") {
    return new LocalStorageProvider();
  }

  // Safe runtime access for Cloudflare Workers if configured
  try {
    const cfGlobal = (globalThis as any).env || (globalThis as any).__env;
    if (cfGlobal?.BUCKET) {
      return new ProductionStorageProvider(cfGlobal.BUCKET);
    }
  } catch {}

  return new LocalStorageProvider();
}
