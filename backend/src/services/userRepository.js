import { db } from '../db.js';

export function findUserByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
}

export function findUserById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function findUserByOauth(provider, oauthId) {
    return db
        .prepare('SELECT * FROM users WHERE provider = ? AND oauth_id = ?')
        .get(provider, oauthId);
}

export function createLocalUser({ email, displayName, passwordHash, emailVerified = false }) {
    const stmt = db.prepare(
        `INSERT INTO users (email, display_name, password_hash, provider, email_verified)
     VALUES (?, ?, ?, 'local', ?)`,
    );
    const result = stmt.run(email.toLowerCase(), displayName, passwordHash, emailVerified ? 1 : 0);
    return findUserById(result.lastInsertRowid);
}

export function createOAuthUser({ email, displayName, provider, oauthId, emailVerified }) {
    const stmt = db.prepare(
        `INSERT INTO users (email, display_name, provider, oauth_id, email_verified)
     VALUES (?, ?, ?, ?, ?)`,
    );
    const result = stmt.run(
        email.toLowerCase(),
        displayName,
        provider,
        oauthId,
        emailVerified ? 1 : 0,
    );
    return findUserById(result.lastInsertRowid);
}

export function updateUserVerification(userId, verified) {
    db.prepare('UPDATE users SET email_verified = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
        verified ? 1 : 0,
        userId,
    );
}

export function updateUserDisplayName(userId, displayName) {
    db.prepare(
        `UPDATE users
         SET display_name = ?, updated_at = datetime('now')
         WHERE id = ?`,
    ).run(displayName, userId);

    return findUserById(userId);
}

export function storeVerificationToken({ userId, token, expiresAt }) {
    db.prepare(
        `INSERT INTO email_verification_tokens (user_id, token, expires_at)
     VALUES (?, ?, ?)`,
    ).run(userId, token, expiresAt);
}

export function getValidVerificationToken(token) {
    return db
        .prepare(
            `SELECT t.*, u.email, u.display_name
       FROM email_verification_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token = ? AND t.used_at IS NULL AND datetime(t.expires_at) > datetime('now')`,
        )
        .get(token);
}

export function markVerificationTokenUsed(token) {
    db
        .prepare('UPDATE email_verification_tokens SET used_at = datetime(\'now\') WHERE token = ?')
        .run(token);
}

export function findPendingByEmail(email) {
    return db
        .prepare(
            `SELECT * FROM pending_registrations
       WHERE email = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')`,
        )
        .get(email.toLowerCase());
}

export function upsertPendingRegistration({ email, displayName, passwordHash, token, expiresAt }) {
    const existing = db
        .prepare('SELECT id FROM pending_registrations WHERE email = ?')
        .get(email.toLowerCase());

    if (existing) {
        db.prepare(
            `UPDATE pending_registrations
       SET display_name = ?, password_hash = ?, token = ?, expires_at = ?, used_at = NULL, updated_at = datetime('now')
       WHERE email = ?`,
        ).run(displayName, passwordHash, token, expiresAt, email.toLowerCase());
        return;
    }

    db.prepare(
        `INSERT INTO pending_registrations (email, display_name, password_hash, token, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    ).run(email.toLowerCase(), displayName, passwordHash, token, expiresAt);
}

export function getValidPendingRegistrationToken(token) {
    return db
        .prepare(
            `SELECT * FROM pending_registrations
       WHERE token = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')`,
        )
        .get(token);
}

export function markPendingRegistrationUsed(token) {
    db.prepare(
        `UPDATE pending_registrations
     SET used_at = datetime('now'), updated_at = datetime('now')
     WHERE token = ?`,
    ).run(token);
}

export function publicUser(user) {
    return {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        emailVerified: !!user.email_verified,
        provider: user.provider,
        createdAt: user.created_at,
    };
}

export function searchUsers(query, currentUserId, limit = 20) {
    const normalizedQuery = `%${String(query || '').trim().toLowerCase()}%`;
    return db
        .prepare(
            `SELECT
                u.id,
                u.email,
                u.display_name,
                u.provider,
                u.created_at,
                f.id AS friendship_id,
                f.requester_id,
                f.addressee_id,
                f.status AS friendship_status
             FROM users u
             LEFT JOIN friendships f
               ON (
                    (f.requester_id = @currentUserId AND f.addressee_id = u.id)
                 OR (f.requester_id = u.id AND f.addressee_id = @currentUserId)
               )
             WHERE u.id <> @currentUserId
               AND u.email_verified = 1
               AND (
                    lower(u.display_name) LIKE @query
                 OR lower(u.email) LIKE @query
               )
             ORDER BY lower(u.display_name) ASC
             LIMIT @limit`,
        )
        .all({
            currentUserId,
            query: normalizedQuery,
            limit,
        });
}

export function findFriendshipBetweenUsers(userId, otherUserId) {
    return db
        .prepare(
            `SELECT *
             FROM friendships
             WHERE (requester_id = ? AND addressee_id = ?)
                OR (requester_id = ? AND addressee_id = ?)`,
        )
        .get(userId, otherUserId, otherUserId, userId);
}

export function createFriendRequest(requesterId, addresseeId) {
    const result = db
        .prepare(
            `INSERT INTO friendships (requester_id, addressee_id, status)
             VALUES (?, ?, 'pending')`,
        )
        .run(requesterId, addresseeId);

    return db.prepare('SELECT * FROM friendships WHERE id = ?').get(result.lastInsertRowid);
}

export function acceptFriendRequest(requestId, userId) {
    db.prepare(
        `UPDATE friendships
         SET status = 'accepted', updated_at = datetime('now')
         WHERE id = ? AND addressee_id = ? AND status = 'pending'`,
    ).run(requestId, userId);

    return db.prepare('SELECT * FROM friendships WHERE id = ?').get(requestId);
}

export function deleteFriendshipBetweenUsers(userId, otherUserId) {
    return db
        .prepare(
            `DELETE FROM friendships
             WHERE (requester_id = ? AND addressee_id = ?)
                OR (requester_id = ? AND addressee_id = ?)`,
        )
        .run(userId, otherUserId, otherUserId, userId);
}

export function listFriendsForUser(userId) {
    return db
        .prepare(
            `SELECT
                u.id,
                u.email,
                u.display_name,
                u.provider,
                u.created_at,
                f.id AS request_id,
                f.updated_at
             FROM friendships f
             JOIN users u
               ON u.id = CASE
                    WHEN f.requester_id = @userId THEN f.addressee_id
                    ELSE f.requester_id
               END
             WHERE (f.requester_id = @userId OR f.addressee_id = @userId)
               AND f.status = 'accepted'
             ORDER BY lower(u.display_name) ASC`,
        )
        .all({ userId });
}

export function listIncomingFriendRequests(userId) {
    return db
        .prepare(
            `SELECT
                f.id AS request_id,
                u.id,
                u.email,
                u.display_name,
                u.provider,
                f.created_at
             FROM friendships f
             JOIN users u ON u.id = f.requester_id
             WHERE f.addressee_id = ?
               AND f.status = 'pending'
             ORDER BY datetime(f.created_at) DESC`,
        )
        .all(userId);
}

export function listOutgoingFriendRequests(userId) {
    return db
        .prepare(
            `SELECT
                f.id AS request_id,
                u.id,
                u.email,
                u.display_name,
                u.provider,
                f.created_at
             FROM friendships f
             JOIN users u ON u.id = f.addressee_id
             WHERE f.requester_id = ?
               AND f.status = 'pending'
             ORDER BY datetime(f.created_at) DESC`,
        )
        .all(userId);
}
