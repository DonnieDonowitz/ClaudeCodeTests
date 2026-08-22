const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'featureplanner.db');

let db = null;

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function init() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_FILE, (err) => {
      if (err) return reject(err);
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS features (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          epic_link TEXT DEFAULT '',
          story_points REAL NOT NULL DEFAULT 0,
          progress INTEGER NOT NULL DEFAULT 0,
          priority TEXT NOT NULL DEFAULT 'media',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`, (err2) => {
          if (err2) return reject(err2);
          resolve();
        });
      });
    });
  });
}

module.exports = { init, run, get, all };
