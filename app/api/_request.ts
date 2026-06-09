import { ApiAccessError } from "@/app/api/_guards";

export function assertContentLengthLimit(request: Request, maxBytes: number) {
  const contentLength = request.headers.get("content-length");
  const parsedLength = contentLength ? Number(contentLength) : 0;

  if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
    throw new ApiAccessError("Payload too large", 413);
  }
}

export async function readTextWithLimit(request: Request, maxBytes: number) {
  assertContentLengthLimit(request, maxBytes);

  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;
    if (!value) continue;

    receivedBytes += value.byteLength;

    if (receivedBytes > maxBytes) {
      throw new ApiAccessError("Payload too large", 413);
    }

    chunks.push(value);
  }

  const body = new Uint8Array(receivedBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

export async function readJsonWithLimit<T>(request: Request, maxBytes: number) {
  const text = await readTextWithLimit(request, maxBytes);

  if (!text.trim()) {
    throw new ApiAccessError("Invalid JSON", 400);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiAccessError("Invalid JSON", 400);
  }
}
