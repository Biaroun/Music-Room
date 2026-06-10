export declare enum OAuthProvider {
    LOCAL = "local",
    GOOGLE = "google",
    FACEBOOK = "facebook"
}
export declare class User {
    id: number;
    username: string;
    name: string;
    email: string;
    emailisVerified: boolean;
    password: string;
    oAuthProvider: OAuthProvider;
    bio: string;
    musicpreferences: string[];
    visibilitySettings: {
        name: 'public' | 'friends-only' | 'private';
        bio: 'public' | 'friends-only' | 'private';
        musicPreferences: 'public' | 'friends-only' | 'private';
    };
    createdAt: Date;
    updatedAt: Date;
}
