import dotenv from 'dotenv';

dotenv.config();

const required = ['AUTH_JWT_SECRET'];
for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}

export const config = {
    port: Number(process.env.AUTH_PORT || 4000),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.AUTH_JWT_SECRET,
    jwtExpiresIn: process.env.AUTH_JWT_EXPIRES_IN || '7d',
    frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
    authBaseUrl: process.env.AUTH_BASE_URL || 'http://localhost:4000',
    brevoApiKey: process.env.BREVO_API_KEY || '',
    brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || '',
    brevoSenderName: process.env.BREVO_SENDER_NAME || 'KulturDB',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    googleCallbackUrl:
        process.env.GOOGLE_CALLBACK_URL ||
        `${process.env.AUTH_BASE_URL || 'http://localhost:4000'}/api/auth/oauth/google/callback`,
    githubClientId: process.env.GITHUB_CLIENT_ID || '',
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    githubCallbackUrl:
        process.env.GITHUB_CALLBACK_URL ||
        `${process.env.AUTH_BASE_URL || 'http://localhost:4000'}/api/auth/oauth/github/callback`,
    sessionSecret: process.env.AUTH_SESSION_SECRET || process.env.AUTH_JWT_SECRET,
    adminEmail: process.env.ADMIN_EMAIL || 'admin@kulturdb.local',
    adminPassword: process.env.ADMIN_PASSWORD || 'Admin123!',
    adminDisplayName: process.env.ADMIN_DISPLAY_NAME || 'Admin KulturDB',
};
