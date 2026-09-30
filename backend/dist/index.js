"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
console.log('[DEBUG] Index.ts loaded');
console.log('[DEBUG] About to import apiRouter...');
const api_1 = __importDefault(require("./routes/api"));
console.log('[DEBUG] apiRouter imported');
const seed_1 = require("./db/seed");
console.log('[DEBUG] seedDatabase imported');
console.log('[DEBUG] Routes imported');
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5050;
console.log('[DEBUG] Express app initialized, PORT:', PORT);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Intelligent Attendance Backend API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});
// API Routes
app.use('/api', api_1.default);
// Start Server and Seed Database
async function startServer() {
    try {
        console.log('🔄 Seeding database...');
        const seedTimeout = setTimeout(() => {
            console.error('❌ Database seeding timeout after 30 seconds!');
            process.exit(1);
        }, 30000);
        await (0, seed_1.seedDatabase)();
        clearTimeout(seedTimeout);
        console.log('✅ Database seeding complete.');
        console.log('🚀 Starting server...');
        const server = app.listen(PORT, () => {
            console.log(`====================================================`);
            console.log(`✅ Backend API Server running at http://localhost:${PORT}`);
            console.log(`Health Check: http://localhost:${PORT}/health`);
            console.log(`API Base URL: http://localhost:${PORT}/api`);
            console.log(`====================================================`);
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is in use. Try these commands:`);
                console.error(`  netstat -ano | findstr :${PORT}`);
                console.error(`  taskkill /PID <PID> /F`);
                process.exit(1);
            }
            else {
                throw err;
            }
        });
    }
    catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}
// Defer startup to next event loop tick
setImmediate(() => startServer());
