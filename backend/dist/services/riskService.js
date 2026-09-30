"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateStudentRisk = evaluateStudentRisk;
const database_1 = require("../db/database");
const http_1 = __importDefault(require("http"));
async function evaluateStudentRisk(student_id, course_code) {
    const record = await (0, database_1.getAsync)(`SELECT * FROM attendance_deficiency_records WHERE student_id = ? AND course_code = ?`, [student_id, course_code]);
    let total_conducted = record?.total_conducted || 40;
    let total_attended = record?.total_attended || 28;
    // Calculate current percentage
    const current_percentage = total_conducted > 0 ? Number(((total_attended / total_conducted) * 100).toFixed(2)) : 100.0;
    // Calculate required classes for 75%
    let classes_required_for_75 = 0;
    if (current_percentage < 75.0) {
        const raw_needed = (0.75 * total_conducted - total_attended) / 0.25;
        classes_required_for_75 = Math.max(0, Math.ceil(raw_needed));
    }
    // Attempt to call Python ML Microservice for predictive forecasting
    let projected_percentage = current_percentage;
    try {
        const mlResponse = await fetchMLPrediction(student_id, course_code, total_conducted, total_attended);
        if (mlResponse && mlResponse.projected_percentage !== undefined) {
            projected_percentage = mlResponse.projected_percentage;
        }
    }
    catch (err) {
        // Fallback predictive heuristic: velocity estimation
        const trendFactor = current_percentage >= 75 ? 0.5 : -1.5;
        projected_percentage = Math.max(0, Math.min(100, Number((current_percentage + trendFactor).toFixed(2))));
    }
    // Dynamic Risk Categorization
    let deficiency_status = 'SAFE';
    if (projected_percentage >= 80.0) {
        deficiency_status = 'SAFE';
    }
    else if (projected_percentage >= 75.0) {
        deficiency_status = 'AMBER_ALERT';
    }
    else if (projected_percentage >= 65.0) {
        deficiency_status = 'RED_DEFICIENT';
    }
    else {
        deficiency_status = 'CRITICAL_DETENTION';
    }
    // Upsert into DB
    await (0, database_1.runAsync)(`INSERT INTO attendance_deficiency_records 
     (student_id, course_code, total_conducted, total_attended, current_percentage, projected_percentage, classes_required_for_75, deficiency_status, last_evaluated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(student_id, course_code) DO UPDATE SET
       total_conducted = excluded.total_conducted,
       total_attended = excluded.total_attended,
       current_percentage = excluded.current_percentage,
       projected_percentage = excluded.projected_percentage,
       classes_required_for_75 = excluded.classes_required_for_75,
       deficiency_status = excluded.deficiency_status,
       last_evaluated_at = CURRENT_TIMESTAMP`, [student_id, course_code, total_conducted, total_attended, current_percentage, projected_percentage, classes_required_for_75, deficiency_status]);
    return {
        student_id,
        course_code,
        total_conducted,
        total_attended,
        current_percentage,
        projected_percentage,
        classes_required_for_75,
        deficiency_status
    };
}
async function fetchMLPrediction(student_id, course_code, total_conducted, total_attended) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            student_id,
            course_code,
            total_conducted,
            total_attended,
            weeks_elapsed: 8,
            recent_velocity: 0.0,
            approved_od_hours: 0
        });
        const req = http_1.default.request({
            hostname: '127.0.0.1',
            port: 8000,
            path: '/predict',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            },
            timeout: 1000
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                }
                catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', (e) => reject(e));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('ML request timeout'));
        });
        req.write(data);
        req.end();
    });
}
