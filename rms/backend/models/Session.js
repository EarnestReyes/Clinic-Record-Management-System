import mongoose from 'mongoose';
const schema = new mongoose.Schema({ _id: String, userId: { type: String, ref: 'User', required: true }, csrf: { type: String, required: true }, version: { type: Number, required: true }, expiresAt: { type: Date, required: true } }, { timestamps: true, strict: 'throw' });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); schema.index({ userId: 1 });
export default mongoose.model('Session', schema);
