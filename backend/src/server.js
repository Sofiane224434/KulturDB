import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cors from 'cors';
import passport from 'passport';
import { config } from './utils/config.js';
import './db.js';
import { initPassport } from './utils/passport.js';
import { ensureConfiguredAdminUser } from './services/userRepository.js';
import authRoutes from './routes/authRoutes.js';
import readingRoutes from './routes/readingRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');

const app = express();

app.use(
    cors({
        origin: [config.frontendBaseUrl],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: false,
    }),
);
app.use(express.json());

app.use(
    session({
        secret: config.sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false, sameSite: 'lax' },
    }),
);

initPassport();
app.use(passport.initialize());

const adminUser = ensureConfiguredAdminUser({
    email: config.adminEmail,
    password: config.adminPassword,
    displayName: config.adminDisplayName,
});

if (adminUser) {
    console.log(`Admin bootstrap actif pour ${adminUser.email}`);
}

app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'auth-api' });
});

app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/reading', readingRoutes);

app.listen(config.port, () => {
    console.log(`Auth API listening on http://localhost:${config.port}`);
});
