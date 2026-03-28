export type UserStatus = "active" | "invited" | "suspended" | "disabled" | "deleted";

export type UserMetadataPublic = {
    username: string | null;
    phone: string | null;
    phone_verified: boolean;
};

export type UserPublic = {
    id: number;
    uuid: string;
    name: string | null;
    display_name: string | null;
    email: string;
    email_verified: boolean;
    status: UserStatus;
    profile_image_url: string | null;
    last_login_at: string | null;
    inserted_at: string;
    updated_at: string;
    metadata: UserMetadataPublic;
};