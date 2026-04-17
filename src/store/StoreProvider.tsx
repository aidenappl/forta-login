"use client";

import { Provider } from "react-redux";
import { makeStore, AppStore } from "./index";
import Cookies from "js-cookie";
import {
  setIsLoading,
  setIsLogged,
  setUser,
  clearAuth,
} from "./slices/authSlice";
import { useEffect } from "react";
import { reqGetSelf } from "../services/auth.service";

interface StoreProviderProps {
  children: React.ReactNode;
}

let store: AppStore | null = null;

const getStore = () => {
  if (!store) {
    store = makeStore();
  }
  return store;
};

const getLoggedInCookie = () => {
  return Cookies.get("logged_in") || null;
};

const clearLoggedInCookie = () => {
  Cookies.set("logged_in", "0", {
    domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    path: "/",
    expires: 365,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
};

const StoreProvider = ({ children }: StoreProviderProps) => {
  const storeInstance = getStore();

  useEffect(() => {
    const initAuth = async () => {
      if (getLoggedInCookie() !== "1") {
        storeInstance.dispatch(setIsLoading(false));
        return;
      }

      const res = await reqGetSelf();
      if (res.success) {
        storeInstance.dispatch(setIsLogged(true));
        storeInstance.dispatch(setUser(res.data));
      } else {
        // Token invalid/expired - clear auth state and cookie
        storeInstance.dispatch(clearAuth());
        clearLoggedInCookie();
      }
      storeInstance.dispatch(setIsLoading(false));
    };

    initAuth();
  }, [storeInstance]);

  return <Provider store={storeInstance}>{children}</Provider>;
};

export default StoreProvider;
