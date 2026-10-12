import { environment } from '../config/environment.js';
import { connectDatabase } from '../config/database.js';
import '../models/Patient.js';
import '../models/Appointment.js';
import mongoose from 'mongoose';
try {await connectDatabase(environment().mongoUri);await mongoose.connection.db.admin().ping();console.info('MongoDB connection and record indexes verified.');}catch{console.error('MongoDB check failed. Verify backend/.env and that MongoDB is reachable.');process.exitCode=1;}finally{await mongoose.disconnect();}
