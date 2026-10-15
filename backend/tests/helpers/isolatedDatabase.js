import { randomUUID } from 'node:crypto';

export const databaseTestsEnabled = (source = process.env) =>
    Boolean(source.MONGODB_TEST_URI) && source.CARELINE_ALLOW_ISOLATED_DB_TESTS === 'true';

// Never use the configured database itself: every suite owns a fresh database.
export function isolatedDatabase(source = process.env) {
    if (!databaseTestsEnabled(source)) throw new Error('Isolated database tests require explicit opt-in.');
    let uri;
    try {
        uri = new URL(source.MONGODB_TEST_URI);
        if (!['mongodb:', 'mongodb+srv:'].includes(uri.protocol)
            || !/^\/[a-zA-Z0-9_-]+_test$/.test(uri.pathname)) throw new Error();
    } catch {
        throw new Error('MONGODB_TEST_URI must explicitly name a disposable database ending in _test.');
    }
    const token = randomUUID();
    const name = `careline_${token.replaceAll('-', '')}_test`;
    uri.pathname = '/' + name;
    let owned = false;
    const marker = '_careline_test_owner';

    async function verifyOwner(connection) {
        if (!owned || connection.name !== name) throw new Error('Refusing access to an unowned test database.');
        const record = await connection.db.collection(marker).findOne({ _id: token });
        if (!record) throw new Error('Test database ownership marker is missing.');
    }

    return {
        name,
        async connect(mongoose, { reconnect = false } = {}) {
            // Disable model-created collections/indexes until ownership is checked.
            await mongoose.connect(uri.toString(), {
                dbName: name, autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 5000
            });
            if (mongoose.connection.name !== name) throw new Error('Unexpected test database connection.');
            if (reconnect) {
                await verifyOwner(mongoose.connection);
                return;
            }
            const collections = await mongoose.connection.db.listCollections().toArray();
            if (collections.length) throw new Error('Refusing to claim an existing test database.');
            await mongoose.connection.db.collection(marker).insertOne({ _id: token });
            owned = true;
            await Promise.all(Object.values(mongoose.models).map(model => model.createIndexes()));
        },
        async cleanup(mongoose) {
            try {
                if (mongoose.connection.readyState === 1 && owned) {
                    await verifyOwner(mongoose.connection);
                    await mongoose.connection.dropDatabase();
                }
            } finally {
                await mongoose.disconnect();
            }
        }
    };
}
