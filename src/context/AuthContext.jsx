import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/authApi';
import { pullAndHydrateUserSyncData } from '../services/userSync';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            setLoading(false);
            return;
        }

        authApi
            .me()
            .then((data) => setUser(data.user))
            .catch(() => {
                localStorage.removeItem('authToken');
                setUser(null);
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!user?.id) {
            return;
        }

        pullAndHydrateUserSyncData();
    }, [user?.id]);

    const loginFromPayload = (payload) => {
        localStorage.setItem('authToken', payload.token);
        setUser(payload.user);
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        setUser(null);
    };

    const value = useMemo(
        () => ({
            user,
            loading,
            isAuthenticated: Boolean(user),
            isAdmin: user?.role === 'admin',
            loginFromPayload,
            logout,
            setUser,
        }),
        [user, loading],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
