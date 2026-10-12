import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { Platform } from "react-native";
import { auth } from "./auth";

export interface GoogleSignInResult {
  user: User;
  serverAuthCode: string | null;
}

if (Platform.OS !== "web") {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
    scopes: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    ],
  });
}

export async function signInWithGoogle(): Promise<GoogleSignInResult | null> {
  if (Platform.OS === "web") {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return { user: result.user, serverAuthCode: null };
  }

  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const result = await GoogleSignin.signIn();
  if (result.type === "cancelled") {
    return null;
  }
  if (!result.data.idToken) {
    throw new Error("Google tidak memberikan ID token.");
  }

  const credential = GoogleAuthProvider.credential(result.data.idToken);
  const firebaseResult = await signInWithCredential(auth, credential);
  return {
    user: firebaseResult.user,
    serverAuthCode: result.data.serverAuthCode,
  };
}

export async function signOutGoogle(): Promise<void> {
  await signOut(auth);
  if (Platform.OS !== "web") {
    await GoogleSignin.signOut();
  }
}
