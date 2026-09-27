'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'catalog.db');
const SESSION_COOKIE = 'catalog_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PHOTO_MAX_BYTES = 6 * 1024 * 1024;
const BODY_MAX_BYTES = 10 * 1024 * 1024;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    pass_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cans (
    id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    number INTEGER NOT NULL,
    brand TEXT NOT NULL,
    flavor TEXT NOT NULL,
    country TEXT NOT NULL,
    volume TEXT,
    date TEXT,
    notes TEXT,
    color TEXT,
    rating INTEGER,
    photo BLOB,
    photo_mime TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, id)
  );
  CREATE INDEX IF NOT EXISTS idx_cans_user ON cans(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
`);

function loadSeedCans() {
  try {
    const src = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
    const fakeWindow = {};
    new Function('window', src)(fakeWindow);
    const list = fakeWindow.CAN_COLLECTION;
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

const seedCans = loadSeedCans();

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 64).toString('hex');
}

function seedCansForUser(userId) {
  if (!seedCans.length) return;
  const insert = db.prepare(
    'INSERT OR IGNORE INTO cans (id, user_id, number, brand, flavor, country, volume, date, notes, color, rating, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)'
  );
  const now = Date.now();
  seedCans.forEach((c, i) => {
    insert.run(
      String(c.id),
      userId,
      Number(c.number) || i + 1,
      String(c.brand || 'Без бренда').slice(0, 200),
      String(c.flavor || 'Без вкуса').slice(0, 200),
      String(c.country || '—').slice(0, 200),
      c.volume ? String(c.volume).slice(0, 60) : null,
      c.date ? String(c.date).slice(0, 10) : null,
      c.notes ? String(c.notes).slice(0, 4000) : null,
      c.color ? String(c.color).slice(0, 20) : null,
      now + i
    );
  });
}

function createSession(userId) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, Date.now() + SESSION_TTL_MS);
  return token;
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) {
      try {
        out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
      } catch (e) {}
    }
  });
  return out;
}

function getUserFromReq(req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const row = db.prepare(
    'SELECT s.token, s.expires_at, s.user_id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
  ).get(token);
  if (!row) return null;
  if (Number(row.expires_at) < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return { id: Number(row.user_id), username: String(row.username) };
}

function isSecure(req) {
  return String(req.headers['x-forwarded-proto'] || '') === 'https';
}

function setSessionCookie(req, res, token) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];
  if (isSecure(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req, res) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isSecure(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_MAX_BYTES) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function clientCan(row) {
  return {
    id: String(row.id),
    number: Number(row.number),
    brand: row.brand,
    flavor: row.flavor,
    country: row.country,
    volume: row.volume || null,
    date: row.date || null,
    notes: row.notes || null,
    color: row.color || null,
    rating: row.rating == null ? null : Number(row.rating),
    photoUrl: row.photo_mime ? '/api/photos/' + encodeURIComponent(String(row.id)) : null
  };
}

function getCanRow(userId, id) {
  return db.prepare('SELECT * FROM cans WHERE user_id = ? AND id = ?').get(userId, String(id));
}

function nextNumberForUser(userId) {
  const row = db.prepare('SELECT MAX(number) AS m FROM cans WHERE user_id = ?').get(userId);
  return (row && row.m ? Number(row.m) : 0) + 1;
}

function parsePhotoDataUrl(dataUrl) {
  if (!dataUrl) return null;
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl));
  if (!m) return { error: 'Некорректный формат изображения' };
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) return { error: 'Пустое изображение' };
  if (buf.length > PHOTO_MAX_BYTES) return { error: 'Изображение слишком большое (максимум 6 МБ)' };
  return { mime: m[1].toLowerCase(), buffer: buf };
}

async function handleApi(req, res, pathname) {
  const method = req.method;

  if (method === 'GET' && pathname === '/api/health') {
    return json(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/register') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
      return json(res, 400, { error: 'Имя: 3–32 символа, латиница, цифры, «_» и «-»' });
    }
    if (password.length < 6 || password.length > 128) {
      return json(res, 400, { error: 'Пароль: от 6 до 128 символов' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return json(res, 409, { error: 'Это имя уже занято' });
    const salt = crypto.randomBytes(16).toString('hex');
    const info = db.prepare('INSERT INTO users (username, pass_hash, salt, created_at) VALUES (?, ?, ?, ?)')
      .run(username, hashPassword(password, salt), salt, Date.now());
    const userId = Number(info.lastInsertRowid);
    seedCansForUser(userId);
    setSessionCookie(req, res, createSession(userId));
    return json(res, 200, { username });
  }

  if (method === 'POST' && pathname === '/api/login') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return json(res, 401, { error: 'Неверное имя или пароль' });
    let ok = false;
    try {
      ok = crypto.timingSafeEqual(
        Buffer.from(user.pass_hash, 'hex'),
        Buffer.from(hashPassword(password, user.salt), 'hex')
      );
    } catch (e) {
      ok = false;
    }
    if (!ok) return json(res, 401, { error: 'Неверное имя или пароль' });
    setSessionCookie(req, res, createSession(Number(user.id)));
    return json(res, 200, { username: String(user.username) });
  }

  if (method === 'POST' && pathname === '/api/logout') {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    clearSessionCookie(req, res);
    return json(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/me') {
    const me = getUserFromReq(req);
    if (!me) return json(res, 401, { error: 'Требуется вход' });
    return json(res, 200, { username: me.username });
  }

  if (method === 'GET' && pathname === '/api/cans') {
    const me = getUserFromReq(req);
    if (!me) return json(res, 401, { error: 'Требуется вход' });
    const rows = db.prepare('SELECT * FROM cans WHERE user_id = ? ORDER BY number ASC').all(me.id);
    return json(res, 200, { cans: rows.map(clientCan) });
  }

  let m;

  if (method === 'POST' && pathname === '/api/cans') {
    const me = getUserFromReq(req);
    if (!me) return json(res, 401, { error: 'Требуется вход' });
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const brand = String(body.brand || '').trim().slice(0, 200);
    const flavor = String(body.flavor || '').trim().slice(0, 200);
    const country = String(body.country || '').trim().slice(0, 200);
    if (!brand || !flavor || !country) {
      return json(res, 400, { error: 'Заполните бренд, вкус и страну' });
    }
    let number = Number(body.number);
    if (!Number.isInteger(number) || number < 1 || number > 999999) number = nextNumberForUser(me.id);
    let photo = null;
    let photoMime = null;
    if (body.photo) {
      const parsed = parsePhotoDataUrl(body.photo);
      if (parsed.error) return json(res, 400, { error: parsed.error });
      photo = parsed.buffer;
      photoMime = parsed.mime;
    }
    const id = 'c-' + crypto.randomBytes(6).toString('hex');
    db.prepare(
      'INSERT INTO cans (id, user_id, number, brand, flavor, country, volume, date, notes, color, rating, photo, photo_mime, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)'
    ).run(
      id,
      me.id,
      number,
      brand,
      flavor,
      country,
      body.volume ? String(body.volume).trim().slice(0, 60) || null : null,
      body.date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.date)) ? String(body.date) : null,
      body.notes ? String(body.notes).slice(0, 4000) || null : null,
      body.color && /^#[0-9a-fA-F]{3,8}$/.test(String(body.color)) ? String(body.color) : null,
      photo,
      photoMime,
      Date.now()
    );
    return json(res, 200, clientCan(getCanRow(me.id, id)));
  }

  m = /^\/api\/cans\/([^/]+)\/rating$/.exec(pathname);
  if (method === 'PATCH' && m) {
    const me = getUserFromReq(req);
    if (!me) return json(res, 401, { error: 'Требуется вход' });
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      return json(res, 400, { error: 'Оценка должна быть числом от 0 до 5' });
    }
    const info = db.prepare('UPDATE cans SET rating = ? WHERE user_id = ? AND id = ?')
      .run(rating === 0 ? null : rating, me.id, decodeURIComponent(m[1]));
    if (!info.changes) return json(res, 404, { error: 'Банка не найдена' });
    return json(res, 200, clientCan(getCanRow(me.id, decodeURIComponent(m[1]))));
  }

  m = /^\/api\/cans\/([^/]+)$/.exec(pathname);
  if (method === 'DELETE' && m) {
    const me = getUserFromReq(req);
    if (!me) return json(res, 401, { error: 'Требуется вход' });
    const info = db.prepare('DELETE FROM cans WHERE user_id = ? AND id = ?')
      .run(me.id, decodeURIComponent(m[1]));
    if (!info.changes) return json(res, 404, { error: 'Банка не найдена' });
    return json(res, 200, { ok: true });
  }

  m = /^\/api\/photos\/([^/]+)$/.exec(pathname);
  if (method === 'GET' && m) {
    const me = getUserFromReq(req);
    if (!me) return json(res, 401, { error: 'Требуется вход' });
    const row = getCanRow(me.id, decodeURIComponent(m[1]));
    if (!row || !row.photo) return json(res, 404, { error: 'Фото не найдено' });
    const buf = Buffer.from(row.photo);
    res.writeHead(200, {
      'Content-Type': String(row.photo_mime || 'image/jpeg'),
      'Content-Length': buf.length,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.end(buf);
  }

  return json(res, 404, { error: 'Не найдено' });
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return json(res, 405, { error: 'Метод не поддерживается' });
  }
  let rel = pathname === '/' ? '/index.html' : pathname;
  try {
    rel = decodeURIComponent(rel);
  } catch (e) {}
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return json(res, 403, { error: 'Запрещено' });
  }
  fs.readFile(filePath, (err, data) => {
    if (err) return json(res, 404, { error: 'Не найдено' });
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch (e) {
    return json(res, 400, { error: 'Некорректный запрос' });
  }
  const promise = pathname.startsWith('/api/')
    ? handleApi(req, res, pathname)
    : Promise.resolve(serveStatic(req, res, pathname));
  promise.catch((err) => {
    if (err && err.message === 'body_too_large') {
      return json(res, 413, { error: 'Слишком большой запрос' });
    }
    console.error('Request error:', err);
    if (!res.headersSent) json(res, 500, { error: 'Внутренняя ошибка сервера' });
    else res.end();
  });
});

server.listen(PORT, () => {
  console.log('Catalog server listening on port ' + PORT);
  console.log('Seed cans loaded: ' + seedCans.length);
});
