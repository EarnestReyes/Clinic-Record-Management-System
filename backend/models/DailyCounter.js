import mongoose from 'mongoose';

const schema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    value: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    versionKey: false
});

export default mongoose.model('DailyCounter', schema);