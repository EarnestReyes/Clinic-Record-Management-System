import { smtpEnvironment } from '../utils/email.js';

export function environment(source = process.env) {
    if (!source.MONGODB_URI || !/^mongodb(?:\+srv)?:\/\//.test(source.MONGODB_URI)) throw new Error('Configure MONGODB_URI in backend/.env');
    if (!source.JWT_SECRET || Buffer.byteLength(source.JWT_SECRET) < 32) throw new Error('JWT_SECRET must contain at least 32 bytes');
    const canonicalClients = (source.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim());
    const previews = source.TRUSTED_PREVIEW_ORIGINS?.trim() ? source.TRUSTED_PREVIEW_ORIGINS.split(',').map(s => s.trim()) : [];
    const exactOrigin = s => { try { return !s.includes('*') && new URL(s).origin === s && /^https?:/.test(s); } catch { return false; } };
    if (canonicalClients.some(s => !exactOrigin(s))) throw new Error('CLIENT_URL must contain exact HTTP(S) origins');
    if (previews.some(s => !exactOrigin(s) || !s.startsWith('https://'))) throw new Error('TRUSTED_PREVIEW_ORIGINS must contain exact HTTPS origins');
    const clients = [...new Set([...canonicalClients, ...previews])];
    const production = source.NODE_ENV === 'production';
    if (production && clients.some(s => !s.startsWith('https://'))) throw new Error('Production CLIENT_URL must use HTTPS');
    const port = Number(source.PORT || 5000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
    const webhookUrl = source.PASSWORD_RESET_EMAIL_WEBHOOK_URL || '';
    const webhookSecret = source.PASSWORD_RESET_EMAIL_WEBHOOK_SECRET || '';
    if (!!webhookUrl !== !!webhookSecret) throw new Error('Configure both password reset email webhook settings');
    if (webhookUrl) {
        const url = new URL(webhookUrl);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Password reset email webhook must use HTTPS without credentials or URL parameters');
        if (webhookSecret.length < 32 || /[\r\n]/.test(webhookSecret)) throw new Error('Password reset email webhook secret must contain at least 32 characters');
    }
    return {
        mongoUri: source.MONGODB_URI,
        jwtSecret: source.JWT_SECRET,
        port,
        clients,
        production,
        passwordReset: { webhookUrl, webhookSecret, clientOrigin: canonicalClients[0], smtp: smtpEnvironment(source) },

        appointmentScheduler: {
            enabled: source.APPOINTMENT_SCHEDULER_ENABLED !== 'false',
            intervalMs: 60_000
        }
    };
}
