import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { environment } from '../config/environment.js';
import { connectDatabase } from '../config/database.js';
import { email, password, text } from '../middleware/validation.js';
import User from '../models/User.js';

try {
    const address = email(process.env.ADMIN_EMAIL);
    const name = text(
        process.env.ADMIN_NAME,
        'Administrator name', { required: true, max: 120 }
    );

    const validatedPassword = password(process.env.ADMIN_PASSWORD);
    const hash = await bcrypt.hash(validatedPassword, 12);

    await connectDatabase(environment().mongoUri);

    // Prevent duplicate email addresses, not multiple administrators.
    if (await User.exists({ email: address })) {
        throw new Error(
            `A user with email ${address} already exists. Use a different email.`
        );
    }

    const id = 'U-' + randomUUID();

    await User.create({
        _id: id,
        id,
        name,
        email: address,
        passwordHash: hash,
        role: 'Administrator',
        active: true
    });

    console.info(`Administrator created successfully: ${address}`);
} catch (error) {
    console.error('Administrator creation failed:', error.message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect().catch(() => {});
}