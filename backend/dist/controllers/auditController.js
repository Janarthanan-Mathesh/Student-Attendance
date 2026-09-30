"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = getAuditLogs;
const database_1 = require("../db/database");
async function getAuditLogs(req, res) {
    try {
        const logs = await (0, database_1.allAsync)(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100`);
        return res.json({ success: true, logs });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
