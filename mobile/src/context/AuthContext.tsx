import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

type authContextType = {
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<authContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        SecureStore.getItemAsync(TOKEN_KEY).then((stored) => {
            setToken(stored);
            setIsLoading(false);
        });
    }, []);
    
    async function login(newToken: string) {
        await SecureStore.setItemAsync(TOKEN_KEY, newToken);
        setToken(newToken);
    }

    async function logout() {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setToken(null);
    }

    return (
        <AuthContext.Provider value={{ token, isAuthenticated: !!token, isLoading, login, logout }}>
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