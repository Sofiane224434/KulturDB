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
