import {createRemoteJWKSet, jwtVerify, type JWTPayload} from "jose";
import {ApiError, type Env} from "./types";

const firebaseKeys = createRemoteJWKSet(new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
));
const googleKeys = createRemoteJWKSet(new URL(
  "https://www.googleapis.com/oauth2/v3/certs"
));

export interface FirebaseIdentity extends JWTPayload {
  sub: string;
  firebase?: {
    identities?: Record<string, string[]>;
    sign_in_provider?: string;
  };
}

export async function requireFirebaseIdentity(
  request: Request,
  env: Env
): Promise<FirebaseIdentity> {
  const bearer = /^Bearer (.+)$/i.exec(request.headers.get("Authorization") || "");
  if (!bearer || bearer[1].length > 5000) {
    throw new ApiError(401, "Silakan login terlebih dahulu.");
  }
  try {
    const {payload} = await jwtVerify(bearer[1], firebaseKeys, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
      algorithms: ["RS256"],
    });
    if (!payload.sub || typeof payload.sub !== "string" ||
        typeof payload.auth_time !== "number" ||
        payload.auth_time > Math.floor(Date.now() / 1000)) {
      throw new Error("Firebase claims invalid");
    }
    return payload as FirebaseIdentity;
  } catch {
    throw new ApiError(401, "Sesi login tidak valid atau sudah kedaluwarsa.");
  }
}

export async function googleAccountIdFromTokens(
  idToken: string | undefined,
  accessToken: string,
  clientId: string
): Promise<string> {
  if (idToken) {
    const {payload} = await jwtVerify(idToken, googleKeys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
      algorithms: ["RS256"],
    });
    if (payload.sub) return payload.sub;
  }
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {Authorization: `Bearer ${accessToken}`},
  });
  if (!response.ok) throw new ApiError(400, "Identitas akun Google gagal diverifikasi.");
  const data = await response.json() as {sub?: string};
  if (!data.sub) throw new ApiError(400, "Identitas akun Google tidak tersedia.");
  return data.sub;
}
