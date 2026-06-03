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

    updateDisplayName: (displayName) =>
        request('/auth/me/display-name', {
            method: 'PATCH',
            body: JSON.stringify({ displayName }),
        }),

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

    getFriends: () => request('/auth/friends'),

    searchUsers: (query) => request(`/auth/users/search?query=${encodeURIComponent(query || '')}`),

    sendFriendRequest: (userId) =>
        request('/auth/friends/requests', {
            method: 'POST',
            body: JSON.stringify({ userId }),
        }),

    acceptFriendRequest: (requestId) =>
        request(`/auth/friends/requests/${requestId}/accept`, {
            method: 'POST',
        }),

    removeFriend: (userId) =>
        request(`/auth/friends/${userId}`, {
            method: 'DELETE',
        }),

    getGoogleOAuthUrl: (redirectPath = '/') =>
        `${API_BASE}/auth/oauth/google?redirect=${encodeURIComponent(redirectPath)}`,
    getGithubOAuthUrl: (redirectPath = '/') =>
        `${API_BASE}/auth/oauth/github?redirect=${encodeURIComponent(redirectPath)}`,
};
