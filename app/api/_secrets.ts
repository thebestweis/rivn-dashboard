import { timingSafeEqual } from "node:crypto";

function toSecretBuffer(value: string) {
  return Buffer.from(value, "utf8");
}

export function safeEqualSecret(
  received: string | null | undefined,
  expected: string | null | undefined
) {
  if (!received || !expected) return false;

  const receivedBuffer = toSecretBuffer(received);
  const expectedBuffer = toSecretBuffer(expected);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function matchesAnySecret(
  received: Array<string | null | undefined>,
  expected: string[]
) {
  return received.some((candidate) =>
    expected.some((secret) => safeEqualSecret(candidate, secret))
  );
}
