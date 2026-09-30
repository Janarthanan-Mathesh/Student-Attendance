"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.runAsync = runAsync;
exports.getAsync = getAsync;
exports.allAsync = allAsync;
exports.initDatabase = initDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
console.log('[DEBUG] Database.ts loading...');
const dbPath = path_1.default.resolve(__dirname, '../../attendance.db');
console.log('[DEBUG] Database path:', dbPath);
exports.db = new sqlite3_1.default.Database(dbPath);
console.log('[DEBUG] SQLite connection established');
function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        exports.db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}
function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        exports.db.get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
}
function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        exports.db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
}
async function initDatabase() {
    await runAsync(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      migration_key TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
    await runAsync(`
    CREATE TABLE IF NOT EXISTS students (
      student_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      register_no TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      parent_id TEXT NOT NULL,
      parent_name TEXT NOT NULL,
      parent_phone TEXT NOT NULL,
      parent_email TEXT NOT NULL,
      department TEXT NOT NULL,
      section TEXT NOT NULL,
      mentor_name TEXT NOT NULL
    );
  `);
    await runAsync(`
    CREATE TABLE IF NOT EXISTS courses (
      course_code TEXT PRIMARY KEY,
      course_name TEXT NOT NULL,
      credits INTEGER NOT NULL,
      total_hours INTEGER NOT NULL,
      faculty_name TEXT NOT NULL
    );
  `);
    await runAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      register_no TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'STUDENT',
      department TEXT NOT NULL,
      section TEXT DEFAULT 'A',
      parent_name TEXT,
      parent_phone TEXT,
      parent_email TEXT,
      mentor_name TEXT,
      password_hash TEXT NOT NULL DEFAULT 'password123',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
    await runAsync(`
    CREATE TABLE IF NOT EXISTS attendance_deficiency_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      course_code TEXT NOT NULL,
      total_conducted INTEGER NOT NULL,
      total_attended INTEGER NOT NULL,
      current_percentage REAL NOT NULL,
      projected_percentage REAL,
      classes_required_for_75 INTEGER DEFAULT 0,
      deficiency_status TEXT NOT NULL,
      last_evaluated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, course_code)
    );
  `);
    await runAsync(`
    CREATE TABLE IF NOT EXISTS communication_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      parent_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      warning_level TEXT NOT NULL,
      message_payload TEXT NOT NULL,
      delivery_status TEXT DEFAULT 'QUEUED',
      gateway_response_id TEXT,
      is_acknowledged INTEGER DEFAULT 0,
      acknowledged_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
    await runAsync(`
    CREATE TABLE IF NOT EXISTS leave_od_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      course_code TEXT NOT NULL,
      request_type TEXT NOT NULL,
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      hours_applied INTEGER NOT NULL,
      reason TEXT NOT NULL,
      document_name TEXT,
      status TEXT DEFAULT 'PENDING',
      approved_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
    await runAsync(`
    CREATE TABLE IF NOT EXISTS counseling_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      mentor_name TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT NOT NULL,
      action_taken TEXT NOT NULL,
      status TEXT DEFAULT 'OPEN',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
    await runAsync(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT NOT NULL,
      ip_address TEXT DEFAULT '127.0.0.1',
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
    console.log("Database initialized successfully.");
}
