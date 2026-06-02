const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, options = {}) {
    const token = localStorage.getItem('authToken');
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'Erreur serveur');
    }

    return data;
}

export const authApi = {
    register: (payload) =>
        request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    login: (payload) =>
        request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    me: () => request('/auth/me'),

    resendVerification: (email) =>
        request('/auth/resend-verification', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),

    verifyEmail: (token) =>
        request('/auth/verify-email', {
            method: 'POST',
            body: JSON.stringify({ token }),
        }),

    oauthProviders: () => request('/auth/oauth/providers'),

    getGoogleOAuthUrl: (redirectPath = '/') =>
        `${API_BASE}/auth/oauth/google?redirect=${encodeURIComponent(redirectPath)}`,
    getGithubOAuthUrl: (redirectPath = '/') =>
        `${API_BASE}/auth/oauth/github?redirect=${encodeURIComponent(redirectPath)}`,
};
