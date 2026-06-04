import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../utils/config.js';

export function generateEmailVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

export function getVerificationExpiryDate() {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    return expiry.toISOString();
}

export function signAuthToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            displayName: user.display_name,
            emailVerified: !!user.email_verified,
            provider: user.provider,
            role: user.role || 'user',
        },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn },
    );
}

export function verifyAuthToken(token) {
    return jwt.verify(token, config.jwtSecret);
}
