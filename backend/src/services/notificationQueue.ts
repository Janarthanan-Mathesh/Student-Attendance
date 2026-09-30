import { runAsync, getAsync } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export interface DispatchJobPayload {
  student_id: string;
  parent_id: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PUSH';
  warning_level: 'ADVISORY' | 'MODERATE' | 'CRITICAL';
  message_payload: string;
}

export class NotificationQueueRunner {
  private queue: DispatchJobPayload[] = [];
  private isProcessing = false;

  public async addJob(payload: DispatchJobPayload) {
    this.queue.push(payload);
    // Create QUEUED record in DB immediately
    const res = await runAsync(
      `INSERT INTO communication_logs (student_id, parent_id, channel, warning_level, message_payload, delivery_status, gateway_response_id)
       VALUES (?, ?, ?, ?, ?, 'QUEUED', ?)`,
      [payload.student_id, payload.parent_id, payload.channel, payload.warning_level, payload.message_payload, `GW_${uuidv4().slice(0, 8)}`]
    );

    this.processQueue();
    return res.lastID;
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      try {
        // Simulate gateway network transmission delay
        await new Promise((r) => setTimeout(r, 600));

        // Simulate multi-channel gateway response
        const gatewayId = job.channel === 'WHATSAPP' 
          ? `wamid.${uuidv4()}`
          : job.channel === 'SMS' 
          ? `SM${uuidv4().replace(/-/g, '').slice(0, 14)}` 
          : `MSG_EML_${uuidv4().slice(0, 8)}`;

        const status = Math.random() > 0.05 ? (job.channel === 'WHATSAPP' ? 'DELIVERED' : 'SENT') : 'FAILED';

        // Update DB log
        await runAsync(
          `UPDATE communication_logs 
           SET delivery_status = ?, gateway_response_id = ? 
           WHERE student_id = ? AND message_payload = ? AND delivery_status = 'QUEUED'`,
          [status, gatewayId, job.student_id, job.message_payload]
        );
      } catch (err) {
        console.error('Failed to process notification job:', err);
      }
    }

    this.isProcessing = false;
  }
}

export const notificationQueue = new NotificationQueueRunner();
