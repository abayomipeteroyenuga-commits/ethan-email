const { Pool } = require('pg');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for Ethan Email Phase 3');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
});

async function initDb(){
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mailbox_settings (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      from_name TEXT NOT NULL DEFAULT '',
      from_address TEXT NOT NULL DEFAULT '',
      smtp_host TEXT NOT NULL DEFAULT '',
      smtp_port INTEGER NOT NULL DEFAULT 465,
      smtp_secure BOOLEAN NOT NULL DEFAULT TRUE,
      smtp_user TEXT NOT NULL DEFAULT '',
      smtp_pass_enc TEXT NOT NULL DEFAULT '',
      imap_host TEXT NOT NULL DEFAULT '',
      imap_port INTEGER NOT NULL DEFAULT 993,
      imap_secure BOOLEAN NOT NULL DEFAULT TRUE,
      imap_user TEXT NOT NULL DEFAULT '',
      imap_pass_enc TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS provisioned_mailboxes (
      user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      mailbox_id TEXT PRIMARY KEY,
      mailbox_address TEXT UNIQUE NOT NULL,
      provider TEXT NOT NULL DEFAULT 'spacemail',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at DESC);
    CREATE INDEX IF NOT EXISTS provisioned_mailboxes_address_idx ON provisioned_mailboxes(mailbox_address);
  `);
}

async function getUserByEmail(email){
  const r = await pool.query('SELECT id,email,password_hash,display_name,role,created_at FROM users WHERE email=$1 LIMIT 1',[email]);
  return r.rows[0] || null;
}
async function getUserById(id){
  const r = await pool.query('SELECT id,email,display_name,role,created_at FROM users WHERE id=$1 LIMIT 1',[id]);
  return r.rows[0] || null;
}
async function createUser({email,passwordHash,displayName,role='user'}){
  const r = await pool.query('INSERT INTO users(email,password_hash,display_name,role) VALUES($1,$2,$3,$4) RETURNING id,email,display_name,role,created_at',[email,passwordHash,displayName,role]);
  return r.rows[0];
}
async function listUsers(limit=100){
  const r = await pool.query('SELECT u.id,u.email,u.display_name,u.role,u.created_at,p.mailbox_id,p.mailbox_address,p.provider FROM users u LEFT JOIN provisioned_mailboxes p ON p.user_id=u.id ORDER BY u.created_at DESC LIMIT $1',[limit]);
  return r.rows;
}
async function getMailboxSettings(userId){
  const r = await pool.query('SELECT * FROM mailbox_settings WHERE user_id=$1 LIMIT 1',[userId]);
  return r.rows[0] || null;
}
async function upsertMailboxSettings(userId, s){
  const r = await pool.query(`
    INSERT INTO mailbox_settings(user_id,from_name,from_address,smtp_host,smtp_port,smtp_secure,smtp_user,smtp_pass_enc,imap_host,imap_port,imap_secure,imap_user,imap_pass_enc,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
    ON CONFLICT(user_id) DO UPDATE SET
      from_name=EXCLUDED.from_name,from_address=EXCLUDED.from_address,
      smtp_host=EXCLUDED.smtp_host,smtp_port=EXCLUDED.smtp_port,smtp_secure=EXCLUDED.smtp_secure,smtp_user=EXCLUDED.smtp_user,
      smtp_pass_enc=CASE WHEN EXCLUDED.smtp_pass_enc='' THEN mailbox_settings.smtp_pass_enc ELSE EXCLUDED.smtp_pass_enc END,
      imap_host=EXCLUDED.imap_host,imap_port=EXCLUDED.imap_port,imap_secure=EXCLUDED.imap_secure,imap_user=EXCLUDED.imap_user,
      imap_pass_enc=CASE WHEN EXCLUDED.imap_pass_enc='' THEN mailbox_settings.imap_pass_enc ELSE EXCLUDED.imap_pass_enc END,
      updated_at=NOW()
    RETURNING *`,[userId,s.fromName,s.fromAddress,s.smtpHost,s.smtpPort,s.smtpSecure,s.smtpUser,s.smtpPassEnc,s.imapHost,s.imapPort,s.imapSecure,s.imapUser,s.imapPassEnc]);
  return r.rows[0];
}

async function saveProvisionedMailbox({userId,mailboxId,address,provider='spacemail',status='active'}){
  const r=await pool.query(`INSERT INTO provisioned_mailboxes(user_id,mailbox_id,mailbox_address,provider,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(mailbox_id) DO UPDATE SET user_id=EXCLUDED.user_id,mailbox_address=EXCLUDED.mailbox_address,provider=EXCLUDED.provider,status=EXCLUDED.status,updated_at=NOW() RETURNING *`,[userId||null,mailboxId,address,provider,status]); return r.rows[0];
}
async function removeProvisionedMailbox(mailboxId){await pool.query('DELETE FROM provisioned_mailboxes WHERE mailbox_id=$1',[mailboxId]);}
async function listProvisionedMailboxes(limit=200){const r=await pool.query('SELECT * FROM provisioned_mailboxes ORDER BY created_at DESC LIMIT $1',[limit]);return r.rows;}
module.exports={pool,initDb,getUserByEmail,getUserById,createUser,listUsers,getMailboxSettings,upsertMailboxSettings,saveProvisionedMailbox,removeProvisionedMailbox,listProvisionedMailboxes};
