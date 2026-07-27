import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

export function hashCredential(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function keyedHash(secret: string, purpose: string, value: string): string {
  return createHmac("sha256", secret).update(`${purpose}\0${value}`, "utf8").digest("hex");
}

export function newOpaqueCredential(): string {
  return randomBytes(32).toString("base64url");
}

export function newCorrelationId(): string {
  return randomUUID();
}
