"use client";

import { Provider } from "react-redux";
import { makeStore, AppStore } from "./index";
import Cookies from "js-cookie";
import { setIsLoading, setIsLogged, setUser } from "./slices/authSlice";
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

const StoreProvider = ({ children }: StoreProviderProps) => {
  const storeInstance = getStore();

  useEffect(() => {
    if (getLoggedInCookie() !== "1") {
      storeInstance.dispatch(setIsLoading(false));
      return;
    }
    reqGetSelf().then((res) => {
      if (res.success) {
        storeInstance.dispatch(setIsLogged(true));
        storeInstance.dispatch(setUser(res.data));
      }
      storeInstance.dispatch(setIsLoading(false));
    });
  }, [storeInstance]);

  return <Provider store={storeInstance}>{children}</Provider>;
};

export default StoreProvider;
