import { findUserById, publicUser } from '../services/userRepository.js';
import { verifyAuthToken } from '../services/tokenService.js';

export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentification requise.' });
    }

    const token = authHeader.slice(7);

    try {
        const payload = verifyAuthToken(token);
        const user = findUserById(payload.sub);
        if (!user) {
            return res.status(401).json({ message: 'Session invalide.' });
        }

        req.user = publicUser(user);
        return next();
    } catch {
        return res.status(401).json({ message: 'Token invalide ou expiré.' });
    }
}
