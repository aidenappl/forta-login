import {
    AuthResponseData,
    ExchangeCodeRequest,
    IssueCodeRequest,
    IssueCodeResponse,
    LoginGoogleRequest,
    LoginLocalRequest,
    OAuthCompleteRequest,
    OAuthCompleteResponse,
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

export const reqLoginGoogle = (body: LoginGoogleRequest) =>
    fetchApi<AuthResponseData>({
        method: "POST",
        url: "/auth/google",
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
