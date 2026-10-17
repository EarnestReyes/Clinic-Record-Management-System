import mongoose from 'mongoose';

export async function connectDatabase(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 });
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
}
