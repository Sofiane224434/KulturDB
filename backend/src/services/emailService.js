import Brevo from '@getbrevo/brevo';
import { config } from '../utils/config.js';

const hasBrevo =
    Boolean(config.brevoApiKey) && Boolean(config.brevoSenderEmail);

let apiInstance = null;
if (hasBrevo) {
    apiInstance = new Brevo.TransactionalEmailsApi();
    const apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = config.brevoApiKey;
}

export async function sendVerificationEmail({ toEmail, displayName, verifyUrl }) {
    if (!hasBrevo) {
        console.warn('Brevo not configured. Verification email not sent. URL:', verifyUrl);
        return;
    }

    const sender = {
        email: config.brevoSenderEmail,
        name: config.brevoSenderName,
    };

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
            Vérifier mon email
          </a>
        </p>
        <p>Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur:</p>
        <p style="word-break:break-all;">${verifyUrl}</p>
        <p>Ce lien expire dans 24 heures.</p>
      </div>
    `,
    });
}
