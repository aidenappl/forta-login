import {
    AuthResponseData,
    ExchangeCodeRequest,
    IssueCodeRequest,
    IssueCodeResponse,
    LoginLocalRequest,
    OAuthCompleteRequest,
    OAuthCompleteResponse,
    RefreshTokenResponse,
    RegisterLocalRequest,
    UserPublic,
} from "@/types";
import { fetchApi } from "./api.service";

export const reqRegister = (body: RegisterLocalRequest) =>
    fetchApi<AuthResponseData>({
        method: "POST",
        url: "/auth/register",
        data: body,
    });

export const reqLoginLocal = (body: LoginLocalRequest) =>
    fetchApi<AuthResponseData>({
        method: "POST",
        url: "/auth/login",
        data: body,
    });

export const reqGetSelf = () =>
    fetchApi<UserPublic>({
        method: "GET",
        url: "/auth/self",
    });

export const reqIssueCode = (body: IssueCodeRequest) =>
    fetchApi<IssueCodeResponse>({
        method: "POST",
        url: "/auth/code",
        data: body,
    });

export const reqExchangeCode = (body: ExchangeCodeRequest) =>
    fetchApi<AuthResponseData>({
        method: "POST",
        url: "/auth/exchange",
        data: body,
    });

export const reqOAuthComplete = (body: OAuthCompleteRequest) =>
    fetchApi<OAuthCompleteResponse>({
        method: "POST",
        url: "/oauth/complete",
        data: body,
    });

export const reqRefreshToken = () =>
    fetchApi<RefreshTokenResponse>({
        method: "POST",
        url: "/auth/refresh",
    });

export const reqLogout = () =>
    fetchApi<void>({
        method: "POST",
        url: "/auth/logout",
    });


/** Which application an oauth_request_token is for (display only). */
export const reqOAuthRequestInfo = (oauthRequestToken: string) =>
    fetchApi<{ name: string; is_first_party: boolean; icon_url: string | null }>({
        method: "GET",
        url: "/oauth/request-info",
        params: { oauth_request_token: oauthRequestToken },
    });

export type SignupMode = "open" | "approval" | "closed";

/** Public: whether this Forta lets people create accounts, and how. */
export const reqSignupMode = () =>
    fetchApi<{ signup_mode: SignupMode }>({
        method: "GET",
        url: "/auth/signup-mode",
    });
