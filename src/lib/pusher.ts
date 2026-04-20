import PusherServer from "pusher";
import PusherClient from "pusher-js";
import { env } from "./env";

const isClientConfigured = !!(
  env.NEXT_PUBLIC_PUSHER_KEY &&
  env.NEXT_PUBLIC_PUSHER_CLUSTER
);

export const pusherServer = (() => {
  if (typeof window !== "undefined") return null;

  const isServerConfigured = !!(
    env.PUSHER_APP_ID &&
    env.NEXT_PUBLIC_PUSHER_KEY &&
    env.PUSHER_SECRET &&
    env.NEXT_PUBLIC_PUSHER_CLUSTER
  );

  if (!isServerConfigured) {
    if (process.env.NODE_ENV === "development") {
      console.log("🛠️ [PUSHER] Server provider: MOCK (Keys missing)");
      return {
        trigger: async () => { /* No-Op */ },
      } as unknown as PusherServer;
    }
    return null;
  }

  return new PusherServer({
    appId: env.PUSHER_APP_ID!,
    key: env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: env.PUSHER_SECRET!,
    cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
  });
})();

export const pusherClient = (() => {
  if (typeof window === "undefined") return null;

  if (!isClientConfigured) {
    if (process.env.NODE_ENV === "development") {
      console.log("🛠️ [PUSHER] Client provider: MOCK (Keys missing)");
      return {
        subscribe: () => ({ bind: () => { } }),
        unsubscribe: () => { },
        bind: () => { },
        unbind: () => { },
      } as unknown as PusherClient;
    }
    return null;
  }

  try {
    return new PusherClient(env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  } catch (error) {
    console.error("Failed to instantiate Pusher client:", error);
    return null;
  }
})();
