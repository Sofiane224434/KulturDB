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

    getSyncData: () => request('/auth/sync-data'),

    updateSyncData: (payload) =>
        request('/auth/sync-data', {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),

    updateProfileSettings: (payload) =>
        request('/auth/me/settings', {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),

    updateDisplayName: (displayName) =>
        request('/auth/me/settings', {
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

    getSubscriptions: () => request('/auth/subscriptions'),

    searchUsers: (query) => request(`/auth/users/search?query=${encodeURIComponent(query || '')}`),

    getUserProfile: (userId) => request(`/auth/users/${encodeURIComponent(userId)}`),

    getMediaCatalogOverrides: () => request('/auth/media-catalog'),

    getMediaOverride: (mediaType, mediaRefId) =>
        request(`/auth/media-overrides/${encodeURIComponent(mediaType)}/${encodeURIComponent(mediaRefId)}`),

    listAdminMediaEntries: () => request('/auth/admin/media-entries'),

    createAdminMediaEntry: (payload) =>
        request('/auth/admin/media-entries', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    updateAdminMediaEntry: (entryId, payload) =>
        request(`/auth/admin/media-entries/${entryId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),

    deleteAdminMediaEntry: (entryId) =>
        request(`/auth/admin/media-entries/${entryId}`, {
            method: 'DELETE',
        }),

    followUser: (userId) =>
        request(`/auth/subscriptions/${userId}`, {
            method: 'POST',
        }),

    acceptFollowRequest: (userId) =>
        request(`/auth/subscriptions/${userId}/accept`, {
            method: 'POST',
        }),

    unfollowUser: (userId) =>
        request(`/auth/subscriptions/${userId}`, {
            method: 'DELETE',
        }),

    getProfileComments: (userId) => request(`/auth/users/${encodeURIComponent(userId)}/profile-comments`),

    addProfileComment: (userId, content) =>
        request(`/auth/users/${encodeURIComponent(userId)}/profile-comments`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        }),

    deleteProfileComment: (userId, commentId) =>
        request(`/auth/users/${encodeURIComponent(userId)}/profile-comments/${encodeURIComponent(commentId)}`, {
            method: 'DELETE',
        }),

    // Compatibilite temporaire pour les anciens appels
    getFriends: () => request('/auth/subscriptions'),
    sendFriendRequest: (userId) => request(`/auth/subscriptions/${userId}`, { method: 'POST' }),
    acceptFriendRequest: (userId) => request(`/auth/subscriptions/${userId}/accept`, { method: 'POST' }),
    removeFriend: (userId) => request(`/auth/subscriptions/${userId}`, { method: 'DELETE' }),

    getGoogleOAuthUrl: (redirectPath = '/') =>
        `${API_BASE}/auth/oauth/google?redirect=${encodeURIComponent(redirectPath)}`,
    getGithubOAuthUrl: (redirectPath = '/') =>
        `${API_BASE}/auth/oauth/github?redirect=${encodeURIComponent(redirectPath)}`,
};
