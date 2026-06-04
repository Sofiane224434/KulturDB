import bcrypt from 'bcryptjs';
import { db } from '../db.js';

function parseJsonSafe(value, fallback) {
    if (typeof value !== 'string') {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function normalizeSeasonBreakdown(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((entry) => ({
            seasonNumber: Number(entry?.seasonNumber),
            episodeCount: Number(entry?.episodeCount),
        }))
        .filter((entry) => Number.isFinite(entry.seasonNumber) && entry.seasonNumber > 0 && Number.isFinite(entry.episodeCount) && entry.episodeCount > 0);
}

function toAdminMediaEntry(row) {
    return {
        id: row.id,
        sourceType: row.source_type,
        mediaType: row.media_type,
        mediaRefId: row.media_ref_id,
        title: row.title || null,
        overview: row.overview || null,
        posterPath: row.poster_path || null,
        backdropPath: row.backdrop_path || null,
        releaseYear: Number.isFinite(row.release_year) ? row.release_year : null,
        seasonBreakdown: normalizeSeasonBreakdown(parseJsonSafe(row.seasons_json, [])),
        episodesTotal: Number.isFinite(row.episodes_total) ? row.episodes_total : null,
        isHidden: !!row.is_hidden,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function findUserByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
}

export function findUserById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function findPublicUserById(id) {
    return db
        .prepare(
            `SELECT id, display_name, provider, role, avatar_url, is_private, created_at
             FROM users
             WHERE id = ? AND email_verified = 1`,
        )
        .get(id);
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
    const result = stmt.run(String(email || '').toLowerCase(), displayName, passwordHash, emailVerified ? 1 : 0);
    return findUserById(result.lastInsertRowid);
}

export function createOAuthUser({ email, displayName, provider, oauthId, emailVerified }) {
    const stmt = db.prepare(
        `INSERT INTO users (email, display_name, provider, oauth_id, email_verified)
         VALUES (?, ?, ?, ?, ?)`,
    );
    const result = stmt.run(
        String(email || '').toLowerCase(),
        displayName,
        provider,
        oauthId,
        emailVerified ? 1 : 0,
    );
    return findUserById(result.lastInsertRowid);
}

export function updateUserVerification(userId, verified) {
    db.prepare("UPDATE users SET email_verified = ?, updated_at = datetime('now') WHERE id = ?").run(
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

export function updateUserProfileSettings(userId, patch = {}) {
    const current = findUserById(userId);
    if (!current) {
        return null;
    }

    const nextDisplayName = Object.prototype.hasOwnProperty.call(patch, 'displayName')
        ? String(patch.displayName || '').trim()
        : current.display_name;
    const nextAvatarUrl = Object.prototype.hasOwnProperty.call(patch, 'avatarUrl')
        ? (String(patch.avatarUrl || '').trim() || null)
        : (current.avatar_url || null);
    const nextPrivate = Object.prototype.hasOwnProperty.call(patch, 'isPrivate')
        ? (patch.isPrivate ? 1 : 0)
        : (current.is_private ? 1 : 0);

    db.prepare(
        `UPDATE users
         SET display_name = ?,
             avatar_url = ?,
             is_private = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
    ).run(nextDisplayName, nextAvatarUrl, nextPrivate, userId);

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
        .prepare("UPDATE email_verification_tokens SET used_at = datetime('now') WHERE token = ?")
        .run(token);
}

export function findPendingByEmail(email) {
    return db
        .prepare(
            `SELECT * FROM pending_registrations
             WHERE email = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')`,
        )
        .get(String(email || '').toLowerCase());
}

export function upsertPendingRegistration({ email, displayName, passwordHash, token, expiresAt }) {
    const normalizedEmail = String(email || '').toLowerCase();
    const existing = db
        .prepare('SELECT id FROM pending_registrations WHERE email = ?')
        .get(normalizedEmail);

    if (existing) {
        db.prepare(
            `UPDATE pending_registrations
             SET display_name = ?, password_hash = ?, token = ?, expires_at = ?, used_at = NULL, updated_at = datetime('now')
             WHERE email = ?`,
        ).run(displayName, passwordHash, token, expiresAt, normalizedEmail);
        return;
    }

    db.prepare(
        `INSERT INTO pending_registrations (email, display_name, password_hash, token, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
    ).run(normalizedEmail, displayName, passwordHash, token, expiresAt);
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
        avatarUrl: user.avatar_url || null,
        isPrivate: !!user.is_private,
        emailVerified: !!user.email_verified,
        provider: user.provider,
        role: user.role || 'user',
        createdAt: user.created_at,
    };
}

export function ensureConfiguredAdminUser({ email, password, displayName }) {
    const safeEmail = String(email || '').trim().toLowerCase();
    const safePassword = String(password || '').trim();
    const safeDisplayName = String(displayName || '').trim() || 'Admin KulturDB';

    if (!safeEmail || !safePassword) {
        return null;
    }

    const existing = findUserByEmail(safeEmail);
    const passwordHash = bcrypt.hashSync(safePassword, 10);

    if (!existing) {
        const result = db.prepare(
            `INSERT INTO users (email, display_name, password_hash, provider, email_verified, role)
             VALUES (?, ?, ?, 'local', 1, 'admin')`,
        ).run(safeEmail, safeDisplayName, passwordHash);

        return findUserById(result.lastInsertRowid);
    }

    db.prepare(
        `UPDATE users
         SET display_name = ?,
             password_hash = ?,
             email_verified = 1,
             role = 'admin',
             updated_at = datetime('now')
         WHERE id = ?`,
    ).run(safeDisplayName, passwordHash, existing.id);

    return findUserById(existing.id);
}

export function listAdminMediaEntries() {
    return db
        .prepare(
            `SELECT *
             FROM admin_media_entries
             ORDER BY datetime(updated_at) DESC`,
        )
        .all()
        .map(toAdminMediaEntry);
}

export function getAdminMediaEntryById(entryId) {
    const row = db
        .prepare('SELECT * FROM admin_media_entries WHERE id = ?')
        .get(entryId);

    return row ? toAdminMediaEntry(row) : null;
}

export function createAdminMediaEntry(payload = {}, createdBy = null) {
    const sourceType = String(payload.sourceType || 'tmdb').toLowerCase() === 'manual' ? 'manual' : 'tmdb';
    const mediaType = String(payload.mediaType || 'series').trim().toLowerCase();
    const mediaRefId = payload.mediaRefId != null ? String(payload.mediaRefId).trim() : null;
    const seasonBreakdown = normalizeSeasonBreakdown(payload.seasonBreakdown);

    const result = db
        .prepare(
            `INSERT INTO admin_media_entries (
                source_type,
                media_type,
                media_ref_id,
                title,
                overview,
                poster_path,
                backdrop_path,
                release_year,
                seasons_json,
                episodes_total,
                is_hidden,
                created_by,
                updated_at
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        )
        .run(
            sourceType,
            mediaType,
            mediaRefId || null,
            payload.title || null,
            payload.overview || null,
            payload.posterPath || null,
            payload.backdropPath || null,
            Number.isFinite(payload.releaseYear) ? payload.releaseYear : null,
            JSON.stringify(seasonBreakdown),
            Number.isFinite(payload.episodesTotal) ? payload.episodesTotal : null,
            payload.isHidden ? 1 : 0,
            createdBy,
        );

    return getAdminMediaEntryById(result.lastInsertRowid);
}

export function updateAdminMediaEntry(entryId, patch = {}) {
    const current = getAdminMediaEntryById(entryId);
    if (!current) {
        return null;
    }

    const next = {
        sourceType: patch.sourceType === 'manual' || patch.sourceType === 'tmdb' ? patch.sourceType : current.sourceType,
        mediaType: patch.mediaType ? String(patch.mediaType).trim().toLowerCase() : current.mediaType,
        mediaRefId: Object.prototype.hasOwnProperty.call(patch, 'mediaRefId')
            ? (patch.mediaRefId != null ? String(patch.mediaRefId).trim() : null)
            : current.mediaRefId,
        title: Object.prototype.hasOwnProperty.call(patch, 'title') ? (patch.title || null) : current.title,
        overview: Object.prototype.hasOwnProperty.call(patch, 'overview') ? (patch.overview || null) : current.overview,
        posterPath: Object.prototype.hasOwnProperty.call(patch, 'posterPath') ? (patch.posterPath || null) : current.posterPath,
        backdropPath: Object.prototype.hasOwnProperty.call(patch, 'backdropPath') ? (patch.backdropPath || null) : current.backdropPath,
        releaseYear: Object.prototype.hasOwnProperty.call(patch, 'releaseYear')
            ? (Number.isFinite(patch.releaseYear) ? patch.releaseYear : null)
            : current.releaseYear,
        seasonBreakdown: Array.isArray(patch.seasonBreakdown)
            ? normalizeSeasonBreakdown(patch.seasonBreakdown)
            : current.seasonBreakdown,
        episodesTotal: Object.prototype.hasOwnProperty.call(patch, 'episodesTotal')
            ? (Number.isFinite(patch.episodesTotal) ? patch.episodesTotal : null)
            : current.episodesTotal,
        isHidden: Object.prototype.hasOwnProperty.call(patch, 'isHidden')
            ? (patch.isHidden ? 1 : 0)
            : (current.isHidden ? 1 : 0),
    };

    db.prepare(
        `UPDATE admin_media_entries
         SET source_type = ?,
             media_type = ?,
             media_ref_id = ?,
             title = ?,
             overview = ?,
             poster_path = ?,
             backdrop_path = ?,
             release_year = ?,
             seasons_json = ?,
             episodes_total = ?,
             is_hidden = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
    ).run(
        next.sourceType,
        next.mediaType,
        next.mediaRefId,
        next.title,
        next.overview,
        next.posterPath,
        next.backdropPath,
        next.releaseYear,
        JSON.stringify(next.seasonBreakdown),
        next.episodesTotal,
        next.isHidden,
        entryId,
    );

    return getAdminMediaEntryById(entryId);
}

export function deleteAdminMediaEntry(entryId) {
    const result = db
        .prepare('DELETE FROM admin_media_entries WHERE id = ?')
        .run(entryId);

    return result.changes > 0;
}

export function getPublicMediaCatalog() {
    const entries = listAdminMediaEntries();

    const hiddenRefs = entries
        .filter((entry) => entry.sourceType === 'tmdb' && entry.isHidden && entry.mediaRefId)
        .map((entry) => ({
            mediaType: entry.mediaType,
            mediaRefId: entry.mediaRefId,
        }));

    const forcedEntries = entries
        .filter((entry) => entry.sourceType === 'tmdb' && !entry.isHidden && entry.mediaRefId)
        .map((entry) => ({
            mediaType: entry.mediaType,
            mediaRefId: entry.mediaRefId,
            title: entry.title,
            overview: entry.overview,
            posterPath: entry.posterPath,
            backdropPath: entry.backdropPath,
            releaseYear: entry.releaseYear,
            episodesTotal: entry.episodesTotal,
            seasonBreakdown: entry.seasonBreakdown,
        }));

    return { hiddenRefs, forcedEntries };
}

export function getPublicMediaOverride(mediaType, mediaRefId) {
    const row = db
        .prepare(
            `SELECT *
             FROM admin_media_entries
             WHERE source_type = 'tmdb'
               AND lower(media_type) = lower(?)
               AND media_ref_id = ?
             ORDER BY datetime(updated_at) DESC
             LIMIT 1`,
        )
        .get(String(mediaType || ''), String(mediaRefId || ''));

    return row ? toAdminMediaEntry(row) : null;
}

export function searchUsers(query, currentUserId, limit = 20) {
    const normalizedQuery = `%${String(query || '').trim().toLowerCase()}%`;
    return db
        .prepare(
            `SELECT
                u.id,
                u.display_name,
                                u.avatar_url,
                                u.is_private,
                u.provider,
                u.created_at,
                                outgoing.id AS outgoing_id,
                                outgoing.status AS outgoing_status,
                                incoming.id AS incoming_id,
                                incoming.status AS incoming_status
             FROM users u
                         LEFT JOIN friendships outgoing
                             ON outgoing.requester_id = @currentUserId
                            AND outgoing.addressee_id = u.id
                         LEFT JOIN friendships incoming
                             ON incoming.requester_id = u.id
                            AND incoming.addressee_id = @currentUserId
             WHERE u.id <> @currentUserId
               AND u.email_verified = 1
               AND (
                    lower(u.display_name) LIKE @query
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

export function findFollowRelation(followerId, followedId) {
    return db
        .prepare(
            `SELECT *
             FROM friendships
             WHERE requester_id = ? AND addressee_id = ?`,
        )
        .get(followerId, followedId);
}

export function createFollowRequest(followerId, followedId, status = 'accepted') {
    const result = db
        .prepare(
            `INSERT INTO friendships (requester_id, addressee_id, status)
             VALUES (?, ?, ?)`,
        )
        .run(followerId, followedId, status === 'pending' ? 'pending' : 'accepted');

    return db.prepare('SELECT * FROM friendships WHERE id = ?').get(result.lastInsertRowid);
}

export function updateFollowStatus(followerId, followedId, status = 'accepted') {
    db.prepare(
        `UPDATE friendships
         SET status = ?, updated_at = datetime('now')
         WHERE requester_id = ? AND addressee_id = ?`,
    ).run(status === 'pending' ? 'pending' : 'accepted', followerId, followedId);

    return findFollowRelation(followerId, followedId);
}

export function deleteFollowRelation(followerId, followedId) {
    return db
        .prepare(
            `DELETE FROM friendships
             WHERE requester_id = ? AND addressee_id = ?`,
        )
        .run(followerId, followedId);
}

export function getRelationshipBetweenUsers(currentUserId, targetUserId) {
    const outgoing = findFollowRelation(currentUserId, targetUserId);
    const incoming = findFollowRelation(targetUserId, currentUserId);
    const isFriend = outgoing?.status === 'accepted' && incoming?.status === 'accepted';

    return {
        outgoingStatus: outgoing?.status || 'none',
        incomingStatus: incoming?.status || 'none',
        isFriend,
    };
}

export function listFollowersForUser(userId, currentUserId = null) {
    const rows = db
        .prepare(
            `SELECT
                follower.id,
                follower.display_name,
                follower.avatar_url,
                relation.status AS relation_status,
                back.status AS back_status
             FROM friendships relation
             JOIN users follower ON follower.id = relation.requester_id
             LEFT JOIN friendships back
               ON back.requester_id = relation.addressee_id
              AND back.addressee_id = relation.requester_id
             WHERE relation.addressee_id = ?
               AND relation.status = 'accepted'
             ORDER BY datetime(relation.updated_at) DESC`,
        )
        .all(userId);

    return rows.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url || null,
        isFriend: row.relation_status === 'accepted' && row.back_status === 'accepted',
        isFollowedByCurrentUser: currentUserId ? !!findFollowRelation(currentUserId, row.id) : false,
    }));
}

export function listFollowingForUser(userId, currentUserId = null) {
    const rows = db
        .prepare(
            `SELECT
                followed.id,
                followed.display_name,
                followed.avatar_url,
                relation.status AS relation_status,
                back.status AS back_status
             FROM friendships relation
             JOIN users followed ON followed.id = relation.addressee_id
             LEFT JOIN friendships back
               ON back.requester_id = relation.addressee_id
              AND back.addressee_id = relation.requester_id
             WHERE relation.requester_id = ?
               AND relation.status = 'accepted'
             ORDER BY datetime(relation.updated_at) DESC`,
        )
        .all(userId);

    return rows.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url || null,
        isFriend: row.relation_status === 'accepted' && row.back_status === 'accepted',
        isFollowedByCurrentUser: currentUserId ? !!findFollowRelation(currentUserId, row.id) : false,
    }));
}

export function listIncomingFollowRequests(userId) {
    return db
        .prepare(
            `SELECT
                u.id,
                u.display_name,
                u.avatar_url,
                f.created_at
             FROM friendships f
             JOIN users u ON u.id = f.requester_id
             WHERE f.addressee_id = ?
               AND f.status = 'pending'
             ORDER BY datetime(f.created_at) DESC`,
        )
        .all(userId)
        .map((row) => ({
            id: row.id,
            displayName: row.display_name,
            avatarUrl: row.avatar_url || null,
            createdAt: row.created_at,
        }));
}

export function countFollowers(userId) {
    const row = db
        .prepare(
            `SELECT COUNT(*) AS total
             FROM friendships
             WHERE addressee_id = ?
               AND status = 'accepted'`,
        )
        .get(userId);

    return Number(row?.total || 0);
}

export function countFollowing(userId) {
    const row = db
        .prepare(
            `SELECT COUNT(*) AS total
             FROM friendships
             WHERE requester_id = ?
               AND status = 'accepted'`,
        )
        .get(userId);

    return Number(row?.total || 0);
}

export function listProfileComments(profileUserId, limit = 30) {
    return db
        .prepare(
            `SELECT
                c.id,
                c.content,
                c.created_at,
                c.updated_at,
                u.id AS author_id,
                u.display_name AS author_display_name,
                u.avatar_url AS author_avatar_url
             FROM profile_comments c
             JOIN users u ON u.id = c.author_user_id
             WHERE c.profile_user_id = ?
             ORDER BY datetime(c.created_at) DESC
             LIMIT ?`,
        )
        .all(profileUserId, limit)
        .map((row) => ({
            id: row.id,
            content: row.content,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            author: {
                id: row.author_id,
                displayName: row.author_display_name,
                avatarUrl: row.author_avatar_url || null,
            },
        }));
}

export function createProfileComment(profileUserId, authorUserId, content) {
    const result = db
        .prepare(
            `INSERT INTO profile_comments (profile_user_id, author_user_id, content)
             VALUES (?, ?, ?)`,
        )
        .run(profileUserId, authorUserId, String(content || '').trim());

    const row = db
        .prepare('SELECT * FROM profile_comments WHERE id = ?')
        .get(result.lastInsertRowid);

    return row;
}

export function deleteProfileComment(commentId, requesterUserId) {
    const comment = db
        .prepare('SELECT * FROM profile_comments WHERE id = ?')
        .get(commentId);

    if (!comment) {
        return { deleted: false, reason: 'not_found' };
    }

    if (comment.author_user_id !== requesterUserId && comment.profile_user_id !== requesterUserId) {
        return { deleted: false, reason: 'forbidden' };
    }

    db
        .prepare('DELETE FROM profile_comments WHERE id = ?')
        .run(commentId);

    return { deleted: true };
}

export function getUserSyncData(userId) {
    const row = db
        .prepare(
            `SELECT user_id, library_json, top_picks_json, ratings_json, comments_json, watchlist_json, roadmap_json, updated_at
             FROM user_sync_data
             WHERE user_id = ?`,
        )
        .get(userId);

    if (!row) {
        return {
            userId,
            library: [],
            topPicks: [],
            ratings: {},
            comments: {},
            watchlist: [],
            roadmap: [],
            updatedAt: null,
        };
    }

    return {
        userId: row.user_id,
        library: parseJsonSafe(row.library_json, []),
        topPicks: parseJsonSafe(row.top_picks_json, []),
        ratings: parseJsonSafe(row.ratings_json, {}),
        comments: parseJsonSafe(row.comments_json, {}),
        watchlist: parseJsonSafe(row.watchlist_json, []),
        roadmap: parseJsonSafe(row.roadmap_json, []),
        updatedAt: row.updated_at,
    };
}

export function upsertUserSyncData(userId, patch = {}) {
    const current = getUserSyncData(userId);

    const next = {
        library: Array.isArray(patch.library) ? patch.library : current.library,
        topPicks: Array.isArray(patch.topPicks) ? patch.topPicks : current.topPicks,
        ratings: patch.ratings && typeof patch.ratings === 'object' && !Array.isArray(patch.ratings)
            ? patch.ratings
            : current.ratings,
        comments: patch.comments && typeof patch.comments === 'object' && !Array.isArray(patch.comments)
            ? patch.comments
            : current.comments,
        watchlist: Array.isArray(patch.watchlist) ? patch.watchlist : current.watchlist,
        roadmap: Array.isArray(patch.roadmap) ? patch.roadmap : current.roadmap,
    };

    db.prepare(
        `INSERT INTO user_sync_data (user_id, library_json, top_picks_json, ratings_json, comments_json, watchlist_json, roadmap_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
            library_json = excluded.library_json,
            top_picks_json = excluded.top_picks_json,
            ratings_json = excluded.ratings_json,
            comments_json = excluded.comments_json,
            watchlist_json = excluded.watchlist_json,
            roadmap_json = excluded.roadmap_json,
            updated_at = datetime('now')`,
    ).run(
        userId,
        JSON.stringify(next.library),
        JSON.stringify(next.topPicks),
        JSON.stringify(next.ratings),
        JSON.stringify(next.comments),
        JSON.stringify(next.watchlist),
        JSON.stringify(next.roadmap),
    );

    return getUserSyncData(userId);
}
