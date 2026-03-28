import { UserPublic } from "./user.types";

// ── Request bodies ──────────────────────────────────────────────────────────

export type RegisterLocalRequest = {
    name: string;
    email: string;
    password: string;
};

export type LoginLocalRequest = {
    email: string;
    password: string;
};

export type LoginGoogleRequest = {
    id_token: string;
};

export type IssueCodeRequest = {
    client_id: string;
    redirect_uri: string;
};

export type ExchangeCodeRequest = {
    client_id: string;
    client_secret: string;
    code: string;
};

export type OAuthCompleteRequest = {
    oauth_request_token: string;
};

// ── Response payloads ───────────────────────────────────────────────────────

export type AuthTokenPair = {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    expires_at: string;
};

export type AuthResponseData = {
    user: UserPublic;
    authorization: AuthTokenPair;
    is_new_user: boolean;
};

export type IssueCodeResponse = {
    redirect_url: string;
    code: string;
};

export type OAuthCompleteResponse = {
    redirect_url: string;
};
