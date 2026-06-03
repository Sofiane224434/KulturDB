import express from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { config } from '../utils/config.js';
import { requireAuth } from '../utils/authMiddleware.js';
import {
    acceptFriendRequest,
    createLocalUser,
    createFriendRequest,
    deleteFriendshipBetweenUsers,
    findFriendshipBetweenUsers,
    findPublicUserById,
    findUserByEmail,
    findUserById,
    findPendingByEmail,
    getValidPendingRegistrationToken,
    markPendingRegistrationUsed,
    listFriendsForUser,
    listIncomingFriendRequests,
    listOutgoingFriendRequests,
    publicUser,
    searchUsers,
    storeVerificationToken,
    upsertPendingRegistration,
    getValidVerificationToken,
    markVerificationTokenUsed,
    updateUserVerification,
    updateUserDisplayName,
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

function toFriendRelation(currentUserId, row) {
    let relationship = 'none';

    if (row.friendship_id) {
        if (row.friendship_status === 'accepted') {
            relationship = 'friend';
        } else if (row.requester_id === currentUserId) {
            relationship = 'outgoing';
        } else {
            relationship = 'incoming';
        }
    }

    return {
        id: row.id,
        displayName: row.display_name,
        provider: row.provider,
        createdAt: row.created_at,
        relationship,
        relationStatus: relationship,
        requestId: row.friendship_id || null,
        friendshipId: row.friendship_id || null,
    };
}

function toFriendListItem(row) {
    return {
        id: row.id,
        displayName: row.display_name,
        provider: row.provider,
        createdAt: row.created_at,
        requestId: row.request_id || null,
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

router.get('/users/search', requireAuth, (req, res) => {
    const query = String(req.query?.query || '').trim();
    if (query.length < 2) {
        return res.json({ users: [] });
    }

    const users = searchUsers(query, req.user.id).map((row) => toFriendRelation(req.user.id, row));
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

    return res.json({
        user: {
            id: user.id,
            displayName: user.display_name,
            provider: user.provider,
            createdAt: user.created_at,
        },
    });
});

router.get('/friends', requireAuth, (req, res) => {
    return res.json({
        friends: listFriendsForUser(req.user.id).map(toFriendListItem),
        incomingRequests: listIncomingFriendRequests(req.user.id).map(toFriendListItem),
        outgoingRequests: listOutgoingFriendRequests(req.user.id).map(toFriendListItem),
    });
});

router.post('/friends/requests', requireAuth, (req, res) => {
    const targetUserId = Number(req.body?.userId);
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

    const existing = findFriendshipBetweenUsers(req.user.id, targetUserId);
    if (existing?.status === 'accepted') {
        return res.status(409).json({ message: 'Vous etes deja amis.' });
    }

    if (existing?.status === 'pending') {
        if (existing.requester_id === targetUserId && existing.addressee_id === req.user.id) {
            acceptFriendRequest(existing.id, req.user.id);
            return res.json({ message: 'Demande acceptee automatiquement.' });
        }

        return res.status(409).json({ message: 'Une demande est deja en cours.' });
    }

    createFriendRequest(req.user.id, targetUserId);
    return res.status(201).json({ message: 'Demande d ami envoyee.' });
});

router.post('/friends/requests/:requestId/accept', requireAuth, (req, res) => {
    const requestId = Number(req.params.requestId);
    if (!Number.isInteger(requestId) || requestId <= 0) {
        return res.status(400).json({ message: 'Demande invalide.' });
    }

    const accepted = acceptFriendRequest(requestId, req.user.id);
    if (!accepted || accepted.status !== 'accepted') {
        return res.status(404).json({ message: 'Demande introuvable.' });
    }

    return res.json({ message: 'Demande acceptee.' });
});

router.delete('/friends/:userId', requireAuth, (req, res) => {
    const targetUserId = Number(req.params.userId);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ message: 'Utilisateur invalide.' });
    }

    const result = deleteFriendshipBetweenUsers(req.user.id, targetUserId);
    if (!result.changes) {
        return res.status(404).json({ message: 'Relation introuvable.' });
    }

    return res.json({ message: 'Relation supprimee.' });
});

router.patch('/me/display-name', requireAuth, (req, res) => {
    const rawDisplayName = String(req.body?.displayName || '').trim();

    if (!rawDisplayName) {
        return res.status(400).json({ message: 'Le pseudo est requis.' });
    }

    if (rawDisplayName.length < 2 || rawDisplayName.length > 50) {
        return res.status(400).json({ message: 'Le pseudo doit contenir entre 2 et 50 caracteres.' });
    }

    const updatedUser = updateUserDisplayName(req.user.id, rawDisplayName);
    return res.json({
        message: 'Pseudo mis a jour.',
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
    const { token } = req.body || {};
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
