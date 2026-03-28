
import { UserPublic } from "@/types";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  is_logged: boolean;
  is_loading: boolean;
  user: UserPublic | null;
}

const initialState: AuthState = {
  is_logged: false,
  is_loading: true,
  user: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setIsLogged(state, action: PayloadAction<boolean>) {
      state.is_logged = action.payload;
    },
    setUser(state, action: PayloadAction<UserPublic | null>) {
      state.user = action.payload;
    },
    setIsLoading(state, action: PayloadAction<boolean>) {
      state.is_loading = action.payload;
    },
    setCredentials(state, action: PayloadAction<{ user: UserPublic }>) {
      state.is_logged = true;
      state.user = action.payload.user;
      state.is_loading = false;
    },
    clearAuth(state) {
      state.is_logged = false;
      state.user = null;
      state.is_loading = false;
    },
  },
});

export const { setIsLogged, setUser, setIsLoading, setCredentials, clearAuth } = authSlice.actions;
export const selectIsLogged = (state: { auth: AuthState }) => state.auth.is_logged;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsLoading = (state: { auth: AuthState }) => state.auth.is_loading;
export default authSlice.reducer;
