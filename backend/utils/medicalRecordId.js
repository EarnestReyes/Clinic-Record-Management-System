import DailyCounter from '../models/DailyCounter.js';

export async function nextMedicalRecordId() {
    // Generate the current date using Philippine time.
    const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date()).replaceAll('-', '');

    // Atomically increment the counter for this specific date.
    const counter = await DailyCounter.findOneAndUpdate({ _id: `medical-record-${date}` }, { $inc: { value: 1 } }, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true

    });

    return `MR-${date}-${String(counter.value).padStart(4, '0')}`;
}