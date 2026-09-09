#!/usr/bin/env node
/**
 * 从本机 DSH 凭据铸造 web GUI 的会话 cookie。
 * 用法: node mint-cookie.cjs  →  stdout 输出 "name=value"
 * 原理: dsh web 的浏览器鉴权 cookie = v1.<base64url(payload)>.<base64url(hmac-sha256(secret, body))>
 *       secret 存于 ~/.dsh/.credentials.yaml 的 client-connection/browser-session 记录。
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const credPath = path.join(os.homedir(), '.dsh', '.credentials.yaml');
const yaml = fs.readFileSync(credPath, 'utf8');
const m = yaml.match(/client-connection\/browser-session:[\s\S]*?secret:\s*(\S+)/);
if (!m) throw new Error('credentials: client-connection/browser-session secret not found');
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const secret = (() => { let s = m[1].replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64'); })();

const host = process.argv[2] || '127.0.0.1:3080';
const issuedAt = Date.now();
const expiresAt = issuedAt + 2 * 3600 * 1000;
const payload = { version: 1, authority: host, issuedAt, expiresAt };
const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
const name = 'dsh-auth-' + b64url(crypto.createHash('sha256').update(host).digest());
process.stdout.write(`${name}=${'v1'}.${body}.${sig}`);
