import Brevo from '@getbrevo/brevo';
import { config } from '../utils/config.js';

const missingConfig = [];

if (!config.brevoApiKey) {
    missingConfig.push('BREVO_API_KEY');
}
if (!config.brevoSenderEmail) {
    missingConfig.push('BREVO_SENDER_EMAIL');
}

const hasBrevo = missingConfig.length === 0;

export const emailServiceStatus = {
    configured: hasBrevo,
    missingConfig,
};

let apiInstance = null;
if (hasBrevo) {
    apiInstance = new Brevo.TransactionalEmailsApi();
    const apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = config.brevoApiKey;
}

export async function sendVerificationEmail({ toEmail, displayName, verifyUrl }) {
    if (!hasBrevo) {
        const error = new Error('Email provider is not configured.');
        error.code = 'EMAIL_NOT_CONFIGURED';
        error.missingConfig = missingConfig;
        throw error;
    }

    const sender = {
        email: config.brevoSenderEmail,
        name: config.brevoSenderName,
    };

    try {
        await apiInstance.sendTransacEmail({
            sender,
            to: [{ email: toEmail, name: displayName }],
            subject: 'Confirme ton adresse email - KulturDB',
            htmlContent: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:600px;margin:auto">
        <h2 style="margin-bottom:8px;">Bienvenue sur KulturDB ${displayName ? `, ${displayName}` : ''}</h2>
        <p>Confirme ton adresse email pour activer ton compte.</p>
        <p style="margin:20px 0;">
          <a href="${verifyUrl}" style="background:#111827;color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px;display:inline-block;">
            Verifier mon email
          </a>
        </p>
        <p>Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur:</p>
        <p style="word-break:break-all;">${verifyUrl}</p>
        <p>Ce lien expire dans 24 heures.</p>
      </div>
    `,
        });
    } catch (sendError) {
        const error = new Error('Failed to send verification email.');
        error.code = 'EMAIL_SEND_FAILED';
        error.cause = sendError;
        throw error;
    }
}
