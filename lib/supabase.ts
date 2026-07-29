import {
  createClient,
  type SupabaseClient
} from "@supabase/supabase-js";
import { getFirebaseServices } from "@/lib/firebase";

export const PROFILE_IMAGES_BUCKET = "profile-images";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured || typeof window === "undefined") return null;
  if (client) return client;

  client = createClient(supabaseUrl!, supabasePublishableKey!, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    },
    accessToken: async () => {
      const firebaseUser = getFirebaseServices()?.auth.currentUser;
      return firebaseUser
        ? await firebaseUser.getIdToken(/* forceRefresh */ false)
        : null;
    }
  });
  return client;
}
