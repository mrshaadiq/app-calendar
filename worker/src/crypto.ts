import {ApiError} from "./types";

function toBase64(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = fromBase64(secret);
  } catch {
    throw new ApiError(500, "Kunci enkripsi Worker tidak valid.");
  }
  if (bytes.length !== 32) {
    throw new ApiError(500, "Kunci enkripsi Worker harus 32 byte.");
  }
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptRefreshToken(
  token: string,
  uid: string,
  secret: string
): Promise<{ciphertext: string; iv: string}> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {name: "AES-GCM", iv, additionalData: new TextEncoder().encode(uid)},
    await encryptionKey(secret),
    new TextEncoder().encode(token)
  );
  return {
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    iv: toBase64(iv),
  };
}

export async function decryptRefreshToken(
  ciphertext: string,
  iv: string,
  uid: string,
  secret: string
): Promise<string> {
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: fromBase64(iv),
        additionalData: new TextEncoder().encode(uid),
      },
      await encryptionKey(secret),
      fromBase64(ciphertext)
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new ApiError(500, "Token Google tersimpan tidak dapat dibuka.");
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
