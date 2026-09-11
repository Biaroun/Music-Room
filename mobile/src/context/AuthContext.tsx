import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '../config/storage';
import { apiFetch, loadApiUrl } from '../config/api';

const TOKEN_KEY = 'auth_token';

// juste ce qu'il faut pour savoir si l'app doit exiger la validation du mail
type Account = { email: string; emailisVerified: boolean };

type authContextType = {
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    // null tant qu'on ne sait pas (back injoignable) : on ne bloque pas dans ce cas
    account: Account | null;
    login: (token: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshAccount: () => Promise<Account | null>;
};

const AuthContext = createContext<authContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [account, setAccount] = useState<Account | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    async function clearSession() {
        await storage.removeItem(TOKEN_KEY);
        setAccount(null);
        setToken(null);
    }

    async function loadAccount(current: string | null): Promise<Account | null> {
        if (!current) {
            setAccount(null);
            return null;
        }
        try {
            const me = await apiFetch('/users/me', current);
            const next = { email: me.email, emailisVerified: !!me.emailisVerified };
            setAccount(next);
            return next;
        } catch (e: any) {
            // token expire ou revoque : retour au login plutot qu'une app vide
            if (e.status === 401)
                await clearSession();
            else
                setAccount(null);
            return null;
        }
    }

    useEffect(() => {
        // l'adresse du back d'abord : loadAccount tape deja l'api
        loadApiUrl()
            .then(() => storage.getItem(TOKEN_KEY))
            .then(async (stored) => {
                if (stored)
                    await loadAccount(stored);
                setToken(stored);
                setIsLoading(false);
            });
    }, []);

    // le compte est charge avant de poser le token, sinon l'accueil flashe
    // avant l'ecran de verification
    async function login(newToken: string) {
        await storage.setItem(TOKEN_KEY, newToken);
        await loadAccount(newToken);
        setToken(newToken);
    }

    // sujet v.6 : le back met le jwt en liste noire, un token vole ne sert plus.
    // pas attendu : on se deconnecte en local meme si le back ne repond pas
    async function logout() {
        if (token)
            apiFetch('/auth/logout', token, { method: 'POST' }).catch(() => {});
        await clearSession();
    }

    return (
        <AuthContext.Provider
            value={{
                token,
                isAuthenticated: !!token,
                isLoading,
                account,
                login,
                logout,
                refreshAccount: () => loadAccount(token),
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error('UseAuth must be used inside AuthProvider');
    return ctx;
};
