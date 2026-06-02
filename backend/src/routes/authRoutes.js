import express from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { config } from '../utils/config.js';
import { requireAuth } from '../utils/authMiddleware.js';
import {
    createLocalUser,
    findUserByEmail,
    findUserById,
    publicUser,
    storeVerificationToken,
    getValidVerificationToken,
    markVerificationTokenUsed,
    updateUserVerification,
} from '../services/userRepository.js';
import {
    generateEmailVerificationToken,
    getVerificationExpiryDate,
    signAuthToken,
} from '../services/tokenService.js';
import { sendVerificationEmail } from '../services/emailService.js';

const router = express.Router();

const isEmail = (value) => /.+@.+\..+/.test(value);
const hasGoogleOAuth = Boolean(config.googleClientId && config.googleClientSecret);
const hasGithubOAuth = Boolean(config.githubClientId && config.githubClientSecret);

function getSafeRedirectPath(value) {
    if (typeof value !== 'string' || !value.startsWith('/')) {
        return '/';
    }
    if (value.startsWith('//')) {
        return '/';
    }
    return value;
}

router.post('/register', async (req, res) => {
    const { email, password, displayName } = req.body || {};

    if (!email || !password || !displayName) {
        return res.status(400).json({ message: 'Nom, email et mot de passe requis.' });
    }

    if (!isEmail(email)) {
        return res.status(400).json({ message: 'Email invalide.' });
    }

    if (password.length < 8) {
        return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères.' });
    }

    const existing = findUserByEmail(email);
    if (existing) {
        return res.status(409).json({ message: 'Un compte existe déjà avec cet email.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = createLocalUser({ email, displayName, passwordHash });

    const token = generateEmailVerificationToken();
    const expiresAt = getVerificationExpiryDate();
    storeVerificationToken({ userId: user.id, token, expiresAt });

    const verifyUrl = `${config.frontendBaseUrl}/auth/verify-email?token=${token}`;
    await sendVerificationEmail({ toEmail: user.email, displayName: user.display_name, verifyUrl });

    return res.status(201).json({
        message: 'Compte créé. Vérifie ton email pour activer ton compte.',
        user: publicUser(user),
    });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ message: 'Email et mot de passe requis.' });
    }

    const user = findUserByEmail(email);
    if (!user || !user.password_hash) {
        return res.status(401).json({ message: 'Identifiants invalides.' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
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

router.post('/resend-verification', async (req, res) => {
    const { email } = req.body || {};
    if (!email) {
        return res.status(400).json({ message: 'Email requis.' });
    }

    const user = findUserByEmail(email);
    if (!user) {
        return res.json({ message: 'Si ce compte existe, un email de vérification a été envoyé.' });
    }

    if (user.email_verified) {
        return res.json({ message: 'Ce compte est déjà vérifié.' });
    }

    const token = generateEmailVerificationToken();
    const expiresAt = getVerificationExpiryDate();
    storeVerificationToken({ userId: user.id, token, expiresAt });

    const verifyUrl = `${config.frontendBaseUrl}/auth/verify-email?token=${token}`;
    await sendVerificationEmail({ toEmail: user.email, displayName: user.display_name, verifyUrl });

    return res.json({ message: 'Email de vérification renvoyé.' });
});

router.post('/verify-email', (req, res) => {
    const { token } = req.body || {};
    if (!token) {
        return res.status(400).json({ message: 'Token requis.' });
    }

    const verification = getValidVerificationToken(token);
    if (!verification) {
        return res.status(400).json({ message: 'Token invalide ou expiré.' });
    }

    markVerificationTokenUsed(token);
    updateUserVerification(verification.user_id, true);
    const user = findUserById(verification.user_id);

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
