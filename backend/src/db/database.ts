import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

console.log('[DEBUG] Database.ts loading...');

const dbPath = path.resolve(__dirname, '../../attendance.db');

console.log('[DEBUG] Database path:', dbPath);

export const db = new sqlite3.Database(dbPath);

console.log('[DEBUG] SQLite connection established');

export function runAsync(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function getAsync<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export function allAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export async function initDatabase() {
  await runAsync(`
    CREATE TABLE IF NOT EXISTS email_otp_challenges (
      challenge_id TEXT PRIMARY KEY,
      purpose TEXT NOT NULL,
      user_id TEXT,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);

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
