const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, 'eden.db');

let db = null;

function wrapRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function wrapGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function wrapAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function init() {
  return new Promise((resolve, reject) => {
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database(DB_FILE, (err) => {
      if (err) return reject(err);
      db.serialize(() => {
        wrapRun(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          surname TEXT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          phone TEXT,
          via TEXT,
          numero TEXT,
          cap TEXT,
          città TEXT,
          provincia TEXT,
          medical_certificate TEXT,
          role TEXT DEFAULT 'user',
          subscription_plan_id INTEGER,
          subscription_start TEXT,
          subscription_end TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`).then(() => {
          return wrapRun(`CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            time TEXT,
            day INTEGER DEFAULT 0
          )`);
        }).then(() => {
          return wrapRun(`CREATE TABLE IF NOT EXISTS user_courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            course_id INTEGER,
            enrolled_at TEXT DEFAULT (datetime('now'))
          )`);
        }).then(() => {
          return wrapRun(`CREATE TABLE IF NOT EXISTS closures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            year INTEGER
          )`);
        }).then(() => {
          return wrapRun(`CREATE TABLE IF NOT EXISTS subscription_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mensile REAL,
            trimestrale REAL,
            semestrale REAL,
            annuale REAL,
            description TEXT
          )`);
        }).then(() => {
          return wrapRun(`INSERT OR IGNORE INTO subscription_plans (name, mensile, trimestrale, semestrale, annuale, description) VALUES 
            ('Palestra', 60, 162, 306, 576, 'Accesso completo alla palestra'),
            ('Palestra + Corsi', 75, 203, 383, 720, 'Palestra + corsi illimitati'),
            ('Full Access', 95, 257, 485, 912, 'Palestra + corsi + piscina'),
            ('Eden Total', 120, 324, 612, 1152, 'Esperienza completa')`);
        }).then(() => {
          return wrapRun(`CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount REAL,
            method TEXT,
            plan_id INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
          )`);
}).then(() => {
          return wrapRun(`CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            time TEXT,
            day INTEGER DEFAULT 0,
            color TEXT
          )`);
        }).then(() => {
          resolve(db);
        }).catch(reject);
      });
    });
  });
}

module.exports = {
  init,
  get: wrapGet,
  all: wrapAll,
  run: wrapRun,
  _db: () => db
};