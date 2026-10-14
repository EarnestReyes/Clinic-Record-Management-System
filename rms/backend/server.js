import { environment } from './config/environment.js';
import { connectDatabase } from './config/database.js';
import { createApp } from './app.js';
import { startAppointmentScheduler } from './jobs/appointmentScheduler.js';
import mongoose from 'mongoose';

let schedulerTimer = null;

try {
    const config = environment();

    await connectDatabase(config.mongoUri);

    schedulerTimer = startAppointmentScheduler(config);

    const server = createApp(config).listen(
        config.port,
        () => console.info(
            `Careline API listening on port ${config.port}. MongoDB connected.`
        )
    );

    const shutdown = () => {
        if (schedulerTimer) {
            clearInterval(schedulerTimer);
            schedulerTimer = null;
        }

        server.close(async() => {
            await mongoose.disconnect();
            process.exit(0);
        });

        setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
} catch (error) {
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
    }

    console.error(
        error.message.startsWith('Configure ') ||
        error.message.startsWith('JWT_SECRET') ||
        error.message.startsWith('CLIENT_URL') ||
        error.message.startsWith('Production CLIENT_URL') ?
        error.message :
        'Backend startup failed. Verify dependencies, MongoDB availability, and backend/.env.'
    );

    process.exitCode = 1;
}