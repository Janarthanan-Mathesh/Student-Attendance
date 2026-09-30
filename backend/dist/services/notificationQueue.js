"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationQueue = exports.NotificationQueueRunner = void 0;
const database_1 = require("../db/database");
const uuid_1 = require("uuid");
class NotificationQueueRunner {
    queue = [];
    isProcessing = false;
    async addJob(payload) {
        this.queue.push(payload);
        // Create QUEUED record in DB immediately
        const res = await (0, database_1.runAsync)(`INSERT INTO communication_logs (student_id, parent_id, channel, warning_level, message_payload, delivery_status, gateway_response_id)
       VALUES (?, ?, ?, ?, ?, 'QUEUED', ?)`, [payload.student_id, payload.parent_id, payload.channel, payload.warning_level, payload.message_payload, `GW_${(0, uuid_1.v4)().slice(0, 8)}`]);
        this.processQueue();
        return res.lastID;
    }
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0)
            return;
        this.isProcessing = true;
        while (this.queue.length > 0) {
            const job = this.queue.shift();
            if (!job)
                break;
            try {
                // Simulate gateway network transmission delay
                await new Promise((r) => setTimeout(r, 600));
                // Simulate multi-channel gateway response
                const gatewayId = job.channel === 'WHATSAPP'
                    ? `wamid.${(0, uuid_1.v4)()}`
                    : job.channel === 'SMS'
                        ? `SM${(0, uuid_1.v4)().replace(/-/g, '').slice(0, 14)}`
                        : `MSG_EML_${(0, uuid_1.v4)().slice(0, 8)}`;
                const status = Math.random() > 0.05 ? (job.channel === 'WHATSAPP' ? 'DELIVERED' : 'SENT') : 'FAILED';
                // Update DB log
                await (0, database_1.runAsync)(`UPDATE communication_logs 
           SET delivery_status = ?, gateway_response_id = ? 
           WHERE student_id = ? AND message_payload = ? AND delivery_status = 'QUEUED'`, [status, gatewayId, job.student_id, job.message_payload]);
            }
            catch (err) {
                console.error('Failed to process notification job:', err);
            }
        }
        this.isProcessing = false;
    }
}
exports.NotificationQueueRunner = NotificationQueueRunner;
exports.notificationQueue = new NotificationQueueRunner();
