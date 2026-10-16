export function environment(source = process.env) {
    if (!source.MONGODB_URI || !/^mongodb(?:\+srv)?:\/\//.test(source.MONGODB_URI)) throw new Error('Configure MONGODB_URI in backend/.env');
    if (!source.JWT_SECRET || Buffer.byteLength(source.JWT_SECRET) < 32) throw new Error('JWT_SECRET must contain at least 32 bytes');
    const clients = (source.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim());
    if (clients.some(s => { try { return s.includes('*') || new URL(s).origin !== s || !/^https?:/.test(s); } catch { return true; } })) throw new Error('CLIENT_URL must contain exact HTTP(S) origins');
    const production = source.NODE_ENV === 'production';
    if (production && clients.some(s => !s.startsWith('https://'))) throw new Error('Production CLIENT_URL must use HTTPS');
    const port = Number(source.PORT || 5000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
    return {
        mongoUri: source.MONGODB_URI,
        jwtSecret: source.JWT_SECRET,
        port,
        clients,
        production,

        appointmentScheduler: {
            enabled: source.APPOINTMENT_SCHEDULER_ENABLED !== 'false',
            intervalMs: 60_000
        }
    };
}