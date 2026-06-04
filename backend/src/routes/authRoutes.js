import express from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { config } from '../utils/config.js';
import { requireAdmin, requireAuth } from '../utils/authMiddleware.js';
import {
    createLocalUser,
    createFollowRequest,
    createProfileComment,
    deleteFollowRelation,
    deleteProfileComment,
    findFollowRelation,
    findPublicUserById,
    findUserByEmail,
    findUserById,
    findPendingByEmail,
    getValidPendingRegistrationToken,
    markPendingRegistrationUsed,
    getRelationshipBetweenUsers,
    getUserSyncData,
    countFollowers,
    countFollowing,
    listFollowersForUser,
    listFollowingForUser,
    listIncomingFollowRequests,
    listProfileComments,
    publicUser,
    searchUsers,
    storeVerificationToken,
    upsertPendingRegistration,
    getValidVerificationToken,
    markVerificationTokenUsed,
    getPublicMediaCatalog,
    getPublicMediaOverride,
    getAdminMediaEntryById,
    listAdminMediaEntries,
    createAdminMediaEntry,
    updateAdminMediaEntry,
    deleteAdminMediaEntry,
    updateUserVerification,
    updateUserProfileSettings,
    updateFollowStatus,
    upsertUserSyncData,
} from '../services/userRepository.js';
import {
    generateEmailVerificationToken,
    getVerificationExpiryDate,
    signAuthToken,
} from '../services/tokenService.js';
import { emailServiceStatus, sendVerificationEmail } from '../services/emailService.js';

const router = express.Router();

const isEmail = (value) => /.+@.+\..+/.test(value);
const hasGoogleOAuth = Boolean(config.googleClientId && config.googleClientSecret);
const hasGithubOAuth = Boolean(config.githubClientId && config.githubClientSecret);
const allowedMediaTypes = new Set(['movie', 'series', 'anime']);

function normalizeMediaType(value) {
    const mediaType = String(value || '').trim().toLowerCase();
    return allowedMediaTypes.has(mediaType) ? mediaType : null;
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

function parseAdminMediaPayload(body = {}, { partial = false } = {}) {
    const payload = {};

    if (Object.prototype.hasOwnProperty.call(body, 'mediaType')) {
        const mediaType = normalizeMediaType(body.mediaType);
        if (!mediaType) {
            return { error: 'Type invalide. Utilise movie, series ou anime.' };
        }
        payload.mediaType = mediaType;
    }

    if (!partial && !payload.mediaType) {
        return { error: 'Le type de fiche est obligatoire.' };
    }

    if (Object.prototype.hasOwnProperty.call(body, 'mediaRefId')) {
        const mediaRefId = String(body.mediaRefId || '').trim();
        if (!mediaRefId) {
            return { error: 'L identifiant de fiche (mediaRefId) est obligatoire.' };
        }
        payload.mediaRefId = mediaRefId;
    }

    if (!partial && !payload.mediaRefId) {
        return { error: 'L identifiant de fiche (mediaRefId) est obligatoire.' };
    }

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
        payload.title = body.title == null ? null : String(body.title).trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, 'overview')) {
        payload.overview = body.overview == null ? null : String(body.overview).trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, 'posterPath')) {
        payload.posterPath = body.posterPath == null ? null : String(body.posterPath).trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, 'backdropPath')) {
        payload.backdropPath = body.backdropPath == null ? null : String(body.backdropPath).trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, 'releaseYear')) {
        const releaseYear = Number(body.releaseYear);
        payload.releaseYear = Number.isFinite(releaseYear) ? releaseYear : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'episodesTotal')) {
        const episodesTotal = Number(body.episodesTotal);
        payload.episodesTotal = Number.isFinite(episodesTotal) && episodesTotal > 0
            ? Math.floor(episodesTotal)
            : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'seasonBreakdown')) {
        payload.seasonBreakdown = normalizeSeasonBreakdown(body.seasonBreakdown);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'isHidden')) {
        payload.isHidden = !!body.isHidden;
    }

    return { payload };
}

function getEmailSendErrorMessage(error) {
    if (error?.code === 'EMAIL_NOT_CONFIGURED') {
        const missing = (error?.missingConfig || emailServiceStatus.missingConfig || []).join(', ');
        return `Service email indisponible. Configuration manquante: ${missing}.`;
    }

    return 'Impossible d envoyer l email de verification pour le moment. Reessaie plus tard.';
}

function getSafeRedirectPath(value) {
    if (typeof value !== 'string' || !value.startsWith('/')) {
        return '/';
    }
    if (value.startsWith('//')) {
        return '/';
    }
    return value;
}

function toSubscriptionRelation(row) {
    const outgoingStatus = row.outgoing_status || 'none';
    const incomingStatus = row.incoming_status || 'none';
    const isFriend = outgoingStatus === 'accepted' && incomingStatus === 'accepted';

    return {
        id: row.id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url || null,
        provider: row.provider,
        isPrivate: !!row.is_private,
        createdAt: row.created_at,
        outgoingStatus,
        incomingStatus,
        isFriend,
    };
}

function buildPublicActivity(syncData) {
    const library = Array.isArray(syncData?.library) ? syncData.library : [];
    const topPicks = Array.isArray(syncData?.topPicks) ? syncData.topPicks : [];
    const watchlist = Array.isArray(syncData?.watchlist) ? syncData.watchlist : [];
    const roadmap = Array.isArray(syncData?.roadmap) ? syncData.roadmap : [];
    const ratings = syncData?.ratings && typeof syncData.ratings === 'object' ? syncData.ratings : {};
    const comments = syncData?.comments && typeof syncData.comments === 'object' ? syncData.comments : {};

    const isPublicComment = (entry) => entry?.visibility !== 'private';
    const roadmapCandidates = roadmap.filter((item) => item);

    const ratingsValues = Object.values(ratings)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);

    const commentsCount = Object.values(comments).reduce((total, entry) => {
        if (!Array.isArray(entry)) {
            return total;
        }
        return total + entry.filter(isPublicComment).length;
    }, 0);

    const completedLibraryCount = library.filter((item) => item?.status === 'done').length;
    const completedWatchlistCount = watchlist.filter((item) => item?.status === 'done').length;

    const itemMetaByItemId = new Map();
    [...library, ...watchlist, ...topPicks, ...roadmap].forEach((item) => {
        const key = String(item?.id || '');
        if (!key) {
            return;
        }
        if (!itemMetaByItemId.has(key)) {
            itemMetaByItemId.set(key, {
                title: item?.title || item?.name || 'Titre indisponible',
                type: item?.type || 'movie',
                posterPath: item?.poster_path || item?.posterPath || null,
            });
        }
    });

    const recentTopPicks = topPicks
        .slice(0, 6)
        .map((item) => ({
            id: item?.id,
            type: item?.type || 'movie',
            title: item?.title || item?.name || 'Titre indisponible',
            posterPath: item?.poster_path || item?.posterPath || null,
        }));

    const trackedDetails = library.slice(0, 8).map((item) => ({
        id: item?.id,
        type: item?.type || 'movie',
        title: item?.title || item?.name || 'Titre indisponible',
        status: item?.status || 'to_start',
        progressCurrent: Number.isFinite(item?.progressCurrent) ? item.progressCurrent : 0,
        progressTotal: Number.isFinite(item?.progressTotal) ? item.progressTotal : null,
        progressUnit: item?.progressUnit || 'element',
        posterPath: item?.poster_path || item?.posterPath || null,
    }));

    const roadmapDetails = roadmapCandidates.slice(0, 12).map((item) => ({
        id: item?.refId || item?.id,
        roadmapId: item?.id || null,
        type: item?.type || 'movie',
        title: item?.title || item?.name || 'Titre indisponible',
        status: item?.status || 'to_start',
        progressCurrent: Number.isFinite(item?.progressCurrent) ? item.progressCurrent : 0,
        progressTotal: Number.isFinite(item?.progressTotal) ? item.progressTotal : null,
        progressUnit: item?.progressUnit || 'element',
        posterPath: item?.poster_path || item?.posterPath || null,
    }));

    const completedDetails = [...library, ...watchlist]
        .filter((item) => item?.status === 'done')
        .slice(0, 8)
        .map((item) => ({
            id: item?.id,
            type: item?.type || 'movie',
            title: item?.title || item?.name || 'Titre indisponible',
            posterPath: item?.poster_path || item?.posterPath || null,
        }));

    const ratingDetails = Object.entries(ratings)
        .map(([itemId, value]) => {
            const itemMeta = itemMetaByItemId.get(String(itemId));
            return {
                itemId,
                value: Number(value),
                title: itemMeta?.title || `Element ${itemId}`,
                type: itemMeta?.type || 'movie',
                posterPath: itemMeta?.posterPath || null,
            };
        })
        .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
        .sort((left, right) => right.value - left.value)
        .slice(0, 8);

    const commentDetails = Object.entries(comments)
        .map(([itemId, list]) => {
            const publicList = Array.isArray(list) ? list.filter(isPublicComment) : [];
            const itemMeta = itemMetaByItemId.get(String(itemId));
            return {
                itemId,
                title: itemMeta?.title || `Element ${itemId}`,
                type: itemMeta?.type || 'movie',
                posterPath: itemMeta?.posterPath || null,
                count: publicList.length,
            };
        })
        .filter((entry) => entry.count > 0)
        .sort((left, right) => right.count - left.count)
        .slice(0, 8);

    return {
        syncedAt: syncData?.updatedAt || null,
        counts: {
            topPicks: topPicks.length,
            tracked: library.length,
            watchlist: watchlist.length,
            roadmap: roadmapCandidates.length,
            completed: completedLibraryCount + completedWatchlistCount,
            ratings: ratingsValues.length,
            comments: commentsCount,
        },
        ratingsAverage: ratingsValues.length
            ? Number((ratingsValues.reduce((sum, value) => sum + value, 0) / ratingsValues.length).toFixed(2))
            : null,
        recentTopPicks,
        details: {
            tracked: trackedDetails,
            roadmap: roadmapDetails,
            completed: completedDetails,
            ratings: ratingDetails,
            comments: commentDetails,
        },
    };
}

router.post('/register', async (req, res) => {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const rawPassword = String(req.body?.password || '');
    const rawDisplayName = String(req.body?.displayName || '').trim();

    if (!rawEmail || !rawPassword || !rawDisplayName) {
        return res.status(400).json({ message: 'Nom, email et mot de passe requis.' });
    }

    if (!isEmail(rawEmail)) {
        return res.status(400).json({ message: 'Email invalide.' });
    }

    if (rawPassword.length < 8) {
        return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères.' });
    }

    const existing = findUserByEmail(rawEmail);
    if (existing && existing.email_verified) {
        return res.status(409).json({ message: 'Un compte vérifié existe déjà avec cet email.' });
    }

    const token = generateEmailVerificationToken();
    const expiresAt = getVerificationExpiryDate();

    if (existing && !existing.email_verified) {
        storeVerificationToken({ userId: existing.id, token, expiresAt });
    } else {
        const passwordHash = await bcrypt.hash(rawPassword, 10);
        upsertPendingRegistration({
            email: rawEmail,
            displayName: rawDisplayName,
            passwordHash,
            token,
            expiresAt,
        });
    }

    const verifyUrl = `${config.frontendBaseUrl}/auth/verify-email?token=${token}`;
    try {
        await sendVerificationEmail({ toEmail: rawEmail, displayName: rawDisplayName, verifyUrl });
    } catch (error) {
        console.error('Register verification email failed:', error);
        return res.status(503).json({ message: getEmailSendErrorMessage(error) });
    }

    return res.status(201).json({
        message: 'Inscription en attente. Vérifie ton email pour finaliser la création du compte.',
    });
});

router.post('/login', async (req, res) => {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const rawPassword = String(req.body?.password || '');

    if (!rawEmail || !rawPassword) {
        return res.status(400).json({ message: 'Email et mot de passe requis.' });
    }

    const user = findUserByEmail(rawEmail);
    if (!user || !user.password_hash) {
        return res.status(401).json({ message: 'Identifiants invalides.' });
    }

    const ok = await bcrypt.compare(rawPassword, user.password_hash);
    if (!ok) {
        return res.status(401).json({ message: 'Identifiants invalides.' });
    }

    if (!user.email_verified) {
        return res.status(403).json({ message: 'Email non vérifié. Vérifie ton email avant de te connecter.' });
    }

    const authToken = signAuthToken(user);
    return res.json({ token: authToken, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
    return res.json({ user: req.user });
});

router.get('/sync-data', requireAuth, (req, res) => {
    const syncData = getUserSyncData(req.user.id);
    return res.json({ syncData });
});

router.get('/media-catalog', (req, res) => {
    const catalog = getPublicMediaCatalog();
    return res.json(catalog);
});

router.get('/media-overrides/:mediaType/:mediaRefId', (req, res) => {
    const mediaType = normalizeMediaType(req.params.mediaType);
    const mediaRefId = String(req.params.mediaRefId || '').trim();

    if (!mediaType || !mediaRefId) {
        return res.status(400).json({ message: 'Type ou identifiant de fiche invalide.' });
    }

    const override = getPublicMediaOverride(mediaType, mediaRefId);
    return res.json({ override });
});

router.get('/admin/media-entries', requireAuth, requireAdmin, (_req, res) => {
    return res.json({ entries: listAdminMediaEntries() });
});

router.post('/admin/media-entries', requireAuth, requireAdmin, (req, res) => {
    const { payload, error } = parseAdminMediaPayload(req.body, { partial: false });
    if (error) {
        return res.status(400).json({ message: error });
    }

    try {
        const entry = createAdminMediaEntry(
            {
                ...payload,
                sourceType: 'tmdb',
            },
            req.user.id,
        );

        return res.status(201).json({ entry });
    } catch (dbError) {
        if (String(dbError?.message || '').toLowerCase().includes('unique')) {
            return res.status(409).json({ message: 'Une fiche admin existe deja pour ce type et cet identifiant.' });
        }
        console.error('create admin media entry failed:', dbError);
        return res.status(500).json({ message: 'Impossible de creer la fiche admin.' });
    }
});

router.patch('/admin/media-entries/:entryId', requireAuth, requireAdmin, (req, res) => {
    const entryId = Number(req.params.entryId);
    if (!Number.isInteger(entryId) || entryId <= 0) {
        return res.status(400).json({ message: 'Entree invalide.' });
    }

    const { payload, error } = parseAdminMediaPayload(req.body, { partial: true });
    if (error) {
        return res.status(400).json({ message: error });
    }

    if (Object.keys(payload).length === 0) {
        return res.status(400).json({ message: 'Aucune modification fournie.' });
    }

    try {
        const entry = updateAdminMediaEntry(entryId, payload);
        if (!entry) {
            return res.status(404).json({ message: 'Entree introuvable.' });
        }
        return res.json({ entry });
    } catch (dbError) {
        if (String(dbError?.message || '').toLowerCase().includes('unique')) {
            return res.status(409).json({ message: 'Une fiche admin existe deja pour ce type et cet identifiant.' });
        }
        console.error('update admin media entry failed:', dbError);
        return res.status(500).json({ message: 'Impossible de modifier la fiche admin.' });
    }
});

router.delete('/admin/media-entries/:entryId', requireAuth, requireAdmin, (req, res) => {
    const entryId = Number(req.params.entryId);
    if (!Number.isInteger(entryId) || entryId <= 0) {
        return res.status(400).json({ message: 'Entree invalide.' });
    }

    const existing = getAdminMediaEntryById(entryId);
    if (!existing) {
        return res.status(404).json({ message: 'Entree introuvable.' });
    }

    const deleted = deleteAdminMediaEntry(entryId);
    if (!deleted) {
        return res.status(500).json({ message: 'Suppression impossible.' });
    }

    return res.json({ message: 'Fiche admin supprimee.' });
});

router.put('/sync-data', requireAuth, (req, res) => {
    const body = req.body || {};
    const payload = {};

    if (Object.prototype.hasOwnProperty.call(body, 'library') && Array.isArray(body.library)) {
        payload.library = body.library;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'topPicks') && Array.isArray(body.topPicks)) {
        payload.topPicks = body.topPicks;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'ratings') && body.ratings && typeof body.ratings === 'object' && !Array.isArray(body.ratings)) {
        payload.ratings = body.ratings;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'comments') && body.comments && typeof body.comments === 'object' && !Array.isArray(body.comments)) {
        payload.comments = body.comments;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'watchlist') && Array.isArray(body.watchlist)) {
        payload.watchlist = body.watchlist;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'roadmap') && Array.isArray(body.roadmap)) {
        payload.roadmap = body.roadmap;
    }

    if (Object.keys(payload).length === 0) {
        return res.status(400).json({ message: 'Aucune donnee de synchronisation valide fournie.' });
    }

    const syncData = upsertUserSyncData(req.user.id, payload);
    return res.json({
        message: 'Synchronisation mise a jour.',
        syncData,
    });
});

router.get('/users/search', requireAuth, (req, res) => {
    const query = String(req.query?.query || '').trim();
    if (query.length < 2) {
        return res.json({ users: [] });
    }

    const users = searchUsers(query, req.user.id).map((row) => toSubscriptionRelation(row));
    return res.json({ users });
});

router.get('/users/:userId', requireAuth, (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: 'Utilisateur invalide.' });
    }

    const user = findPublicUserById(userId);
    if (!user) {
        return res.status(404).json({ message: 'Profil introuvable.' });
    }

    const relationship = getRelationshipBetweenUsers(req.user.id, userId);
    const isOwner = req.user.id === userId;
    const canViewFull = isOwner || !user.is_private || relationship.outgoingStatus === 'accepted';

    const followersCount = countFollowers(userId);
    const followingCount = countFollowing(userId);

    const social = {
        followersCount,
        followingCount,
        followers: canViewFull ? listFollowersForUser(userId, req.user.id) : [],
        following: canViewFull ? listFollowingForUser(userId, req.user.id) : [],
    };

    const publicActivity = canViewFull ? buildPublicActivity(getUserSyncData(userId)) : null;

    return res.json({
        user: {
            id: user.id,
            displayName: user.display_name,
            avatarUrl: user.avatar_url || null,
            isPrivate: !!user.is_private,
            provider: user.provider,
            createdAt: user.created_at,
        },
        relationship,
        canViewFull,
        social,
        publicActivity,
    });
});

router.get('/subscriptions', requireAuth, (req, res) => {
    return res.json({
        followers: listFollowersForUser(req.user.id, req.user.id),
        following: listFollowingForUser(req.user.id, req.user.id),
        incomingRequests: listIncomingFollowRequests(req.user.id),
    });
});

router.post('/subscriptions/:userId', requireAuth, (req, res) => {
    const targetUserId = Number(req.params.userId);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ message: 'Utilisateur cible invalide.' });
    }

    if (targetUserId === req.user.id) {
        return res.status(400).json({ message: 'Tu ne peux pas t ajouter toi-meme.' });
    }

    const targetUser = findUserById(targetUserId);
    if (!targetUser || !targetUser.email_verified) {
        return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    const existing = findFollowRelation(req.user.id, targetUserId);
    if (existing?.status === 'accepted') {
        return res.status(409).json({ message: 'Tu es deja abonne.' });
    }

    if (existing?.status === 'pending') {
        return res.status(409).json({ message: 'Ta demande est deja en attente.' });
    }

    const status = targetUser.is_private ? 'pending' : 'accepted';
    createFollowRequest(req.user.id, targetUserId, status);

    return res.status(201).json({
        message: status === 'pending' ? 'Demande d abonnement envoyee.' : 'Abonnement actif.',
        status,
    });
});

router.post('/subscriptions/:userId/accept', requireAuth, (req, res) => {
    const requesterUserId = Number(req.params.userId);
    if (!Number.isInteger(requesterUserId) || requesterUserId <= 0) {
        return res.status(400).json({ message: 'Utilisateur invalide.' });
    }

    const pending = findFollowRelation(requesterUserId, req.user.id);
    if (!pending || pending.status !== 'pending') {
        return res.status(404).json({ message: 'Demande introuvable.' });
    }

    updateFollowStatus(requesterUserId, req.user.id, 'accepted');
    return res.json({ message: 'Demande acceptee.' });
});

router.delete('/subscriptions/:userId', requireAuth, (req, res) => {
    const targetUserId = Number(req.params.userId);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ message: 'Utilisateur invalide.' });
    }

    const result = deleteFollowRelation(req.user.id, targetUserId);
    if (!result.changes) {
        return res.status(404).json({ message: 'Abonnement introuvable.' });
    }

    return res.json({ message: 'Abonnement supprime.' });
});

router.get('/users/:userId/profile-comments', requireAuth, (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: 'Utilisateur invalide.' });
    }

    const user = findPublicUserById(userId);
    if (!user) {
        return res.status(404).json({ message: 'Profil introuvable.' });
    }

    const relationship = getRelationshipBetweenUsers(req.user.id, userId);
    const isOwner = req.user.id === userId;
    const canViewFull = isOwner || !user.is_private || relationship.outgoingStatus === 'accepted';
    if (!canViewFull) {
        return res.status(403).json({ message: 'Profil prive: abonnement accepte requis.' });
    }

    return res.json({ comments: listProfileComments(userId) });
});

router.post('/users/:userId/profile-comments', requireAuth, (req, res) => {
    const userId = Number(req.params.userId);
    const content = String(req.body?.content || '').trim();

    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: 'Utilisateur invalide.' });
    }

    if (content.length < 2 || content.length > 500) {
        return res.status(400).json({ message: 'Le commentaire doit contenir entre 2 et 500 caracteres.' });
    }

    const user = findPublicUserById(userId);
    if (!user) {
        return res.status(404).json({ message: 'Profil introuvable.' });
    }

    const relationship = getRelationshipBetweenUsers(req.user.id, userId);
    const isOwner = req.user.id === userId;
    const canViewFull = isOwner || !user.is_private || relationship.outgoingStatus === 'accepted';
    if (!canViewFull) {
        return res.status(403).json({ message: 'Profil prive: abonnement accepte requis.' });
    }

    createProfileComment(userId, req.user.id, content);
    return res.status(201).json({ message: 'Commentaire ajoute.', comments: listProfileComments(userId) });
});

router.delete('/users/:userId/profile-comments/:commentId', requireAuth, (req, res) => {
    const userId = Number(req.params.userId);
    const commentId = Number(req.params.commentId);

    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(commentId) || commentId <= 0) {
        return res.status(400).json({ message: 'Parametres invalides.' });
    }

    const result = deleteProfileComment(commentId, req.user.id);
    if (!result.deleted && result.reason === 'not_found') {
        return res.status(404).json({ message: 'Commentaire introuvable.' });
    }
    if (!result.deleted && result.reason === 'forbidden') {
        return res.status(403).json({ message: 'Suppression non autorisee.' });
    }

    return res.json({ message: 'Commentaire supprime.', comments: listProfileComments(userId) });
});

router.patch('/me/settings', requireAuth, (req, res) => {
    const rawDisplayName = String(req.body?.displayName || '').trim();
    const hasDisplayName = Object.prototype.hasOwnProperty.call(req.body || {}, 'displayName');
    const hasAvatarUrl = Object.prototype.hasOwnProperty.call(req.body || {}, 'avatarUrl');
    const hasIsPrivate = Object.prototype.hasOwnProperty.call(req.body || {}, 'isPrivate');

    if (!hasDisplayName && !hasAvatarUrl && !hasIsPrivate) {
        return res.status(400).json({ message: 'Aucune modification fournie.' });
    }

    if (hasDisplayName && !rawDisplayName) {
        return res.status(400).json({ message: 'Le pseudo est requis.' });
    }

    if (hasDisplayName && (rawDisplayName.length < 2 || rawDisplayName.length > 50)) {
        return res.status(400).json({ message: 'Le pseudo doit contenir entre 2 et 50 caracteres.' });
    }

    const rawAvatar = String(req.body?.avatarUrl || '').trim();
    if (hasAvatarUrl && rawAvatar.length > 500) {
        return res.status(400).json({ message: 'URL d avatar trop longue.' });
    }

    const updatedUser = updateUserProfileSettings(req.user.id, {
        ...(hasDisplayName ? { displayName: rawDisplayName } : {}),
        ...(hasAvatarUrl ? { avatarUrl: rawAvatar || null } : {}),
        ...(hasIsPrivate ? { isPrivate: !!req.body?.isPrivate } : {}),
    });

    return res.json({
        message: 'Profil mis a jour.',
        user: publicUser(updatedUser),
    });
});

router.post('/resend-verification', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
        return res.status(400).json({ message: 'Email requis.' });
    }

    const user = findUserByEmail(email);
    const pending = findPendingByEmail(email);

    if (!user && !pending) {
        return res.json({ message: 'Si ce compte existe, un email de vérification a été envoyé.' });
    }

    if (user && user.email_verified) {
        return res.json({ message: 'Ce compte est déjà vérifié.' });
    }

    const token = generateEmailVerificationToken();
    const expiresAt = getVerificationExpiryDate();

    if (pending) {
        upsertPendingRegistration({
            email,
            displayName: pending.display_name,
            passwordHash: pending.password_hash,
            token,
            expiresAt,
        });
    } else {
        storeVerificationToken({ userId: user.id, token, expiresAt });
    }

    const verifyUrl = `${config.frontendBaseUrl}/auth/verify-email?token=${token}`;
    try {
        await sendVerificationEmail({
            toEmail: (pending?.email || user.email).toLowerCase(),
            displayName: pending?.display_name || user.display_name,
            verifyUrl,
        });
    } catch (error) {
        console.error('Resend verification email failed:', error);
        return res.status(503).json({ message: getEmailSendErrorMessage(error) });
    }

    return res.json({ message: 'Email de vérification renvoyé.' });
});

router.post('/verify-email', (req, res) => {
    const rawToken = String(req.body?.token || '');
    const token = rawToken.trim().toLowerCase();

    if (!token) {
        return res.status(400).json({ message: 'Token requis.' });
    }

    const pending = getValidPendingRegistrationToken(token);
    let user;

    if (pending) {
        const existing = findUserByEmail(pending.email);
        if (existing) {
            if (!existing.email_verified) {
                updateUserVerification(existing.id, true);
            }
            user = findUserById(existing.id);
        } else {
            user = createLocalUser({
                email: pending.email,
                displayName: pending.display_name,
                passwordHash: pending.password_hash,
                emailVerified: true,
            });
        }
        markPendingRegistrationUsed(token);
    } else {
        const verification = getValidVerificationToken(token);
        if (!verification) {
            return res.status(400).json({ message: 'Token invalide ou expiré.' });
        }

        markVerificationTokenUsed(token);
        updateUserVerification(verification.user_id, true);
        user = findUserById(verification.user_id);
    }

    const authToken = signAuthToken(user);

    return res.json({
        message: 'Email vérifié avec succès.',
        token: authToken,
        user: publicUser(user),
    });
});

router.get('/oauth/providers', (_req, res) => {
    return res.json({
        google: hasGoogleOAuth,
        github: hasGithubOAuth,
    });
});

router.get('/oauth/google', (req, res, next) => {
    if (!hasGoogleOAuth) {
        return res.status(503).json({ message: 'OAuth Google non configuré.' });
    }

    const redirect = getSafeRedirectPath(req.query.redirect);
    return passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: redirect,
    })(req, res, next);
});

router.get(
    '/oauth/google/callback',
    (req, res, next) => {
        if (!hasGoogleOAuth) {
            return res.redirect(`${config.frontendBaseUrl}/login?error=oauth_not_configured`);
        }
        return next();
    },
    passport.authenticate('google', { session: false, failureRedirect: `${config.frontendBaseUrl}/login?error=oauth_failed` }),
    (req, res) => {
        const authToken = signAuthToken(req.user);
        const redirectTo = getSafeRedirectPath(req.query.state);
        res.redirect(`${config.frontendBaseUrl}/auth/oauth-success?token=${encodeURIComponent(authToken)}&redirect=${encodeURIComponent(redirectTo)}`);
    },
);

router.get('/oauth/github', (req, res, next) => {
    if (!hasGithubOAuth) {
        return res.status(503).json({ message: 'OAuth GitHub non configuré.' });
    }

    const redirect = getSafeRedirectPath(req.query.redirect);
    return passport.authenticate('github', {
        scope: ['user:email'],
        state: redirect,
    })(req, res, next);
});

router.get(
    '/oauth/github/callback',
    (req, res, next) => {
        if (!hasGithubOAuth) {
            return res.redirect(`${config.frontendBaseUrl}/login?error=oauth_not_configured`);
        }
        return next();
    },
    passport.authenticate('github', {
        session: false,
        failureRedirect: `${config.frontendBaseUrl}/login?error=oauth_failed`,
    }),
    (req, res) => {
        const authToken = signAuthToken(req.user);
        const redirectTo = getSafeRedirectPath(req.query.state);
        res.redirect(`${config.frontendBaseUrl}/auth/oauth-success?token=${encodeURIComponent(authToken)}&redirect=${encodeURIComponent(redirectTo)}`);
    },
);

export default router;
