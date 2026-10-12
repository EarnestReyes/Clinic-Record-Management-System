import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { environment } from '../config/environment.js';
import { connectDatabase } from '../config/database.js';
import { email, password, text } from '../middleware/validation.js';
import User from '../models/User.js';
try {
  const address=email(process.env.ADMIN_EMAIL),name=text(process.env.ADMIN_NAME,'Administrator name',{required:true,max:120});
  const hash=await bcrypt.hash(password(process.env.ADMIN_PASSWORD),12);
  await connectDatabase(environment().mongoUri);
  if(await User.exists({role:'Administrator'}))throw new Error('An administrator already exists. Use User Management to create more accounts.');
  const id='U-'+randomUUID();await User.create({_id:id,id,name,email:address,passwordHash:hash,role:'Administrator',active:true});
  console.info('Initial administrator created. Remove ADMIN_PASSWORD from the environment after use.');
} catch { console.error('Administrator creation failed. Verify configuration, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, MongoDB, and that no administrator exists.');process.exitCode=1; }
finally { await mongoose.disconnect(); }
