import {auth} from "./auth";

const baseUrl = process.env.EXPO_PUBLIC_WORKER_URL?.replace(/\/$/, "");

export async function workerRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  if (!baseUrl) throw new Error("Alamat Cloudflare Worker belum diisi pada EXPO_PUBLIC_WORKER_URL.");
  const user = auth.currentUser;
  if (!user) throw new Error("Masuk terlebih dahulu.");
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(body === undefined ? {} : {"Content-Type": "application/json"}),
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  const result = await response.json() as T & {error?: string};
  if (!response.ok) throw new Error(result.error || `Worker gagal (${response.status}).`);
  return result;
}
