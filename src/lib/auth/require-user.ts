import { AsyncLocalStorage } from "async_hooks";

export const honoUserStorage = new AsyncLocalStorage<{ user: any; session: any }>();

export const getSession = async () => {
    const store = honoUserStorage.getStore();
    if (store) {
        return { user: store.user, session: store.session };
    }
    return null;
};

export const requireUser = async () => {
    const store = honoUserStorage.getStore();
    if (store?.user) {
        return store.user;
    }
    throw new Error("Unauthorized: No user session found in request context.");
};
