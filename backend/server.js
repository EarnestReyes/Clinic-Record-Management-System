import { environment } from './config/environment.js';
import { connectDatabase } from './config/database.js';
import { createApp } from './app.js';
import { startAppointmentScheduler } from './jobs/appointmentScheduler.js';
import mongoose from 'mongoose';
import dns from 'node:dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

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

    console.error("=== BACKEND STARTUP ERROR ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code || "N/A");
    console.error("=============================");

    process.exitCode = 1;
}