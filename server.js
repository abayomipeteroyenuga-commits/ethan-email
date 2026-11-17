require('dotenv').config();
const path=require('path');
const express=require('express');
const helmet=require('helmet');
const rateLimit=require('express-rate-limit');
const session=require('express-session');
const bcrypt=require('bcryptjs');
const pgSession=require('connect-pg-simple')(session);
const {pool,initDb,getUserByEmail,getUserById,createUser,listUsers,getMailboxSettings,upsertMailboxSettings,saveProvisionedMailbox,removeProvisionedMailbox,listProvisionedMailboxes}=require('./db');
const {encrypt,decrypt}=require('./lib/crypto');
const {verifyServices,sendMail,listInbox,readMessage,smtpConfigured,imapConfigured}=require('./lib/mailbox');

if(!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters');
if(!process.env.MAIL_CREDENTIALS_KEY) throw new Error('MAIL_CREDENTIALS_KEY is required');
const app=express(); const PORT=Number(process.env.PORT||3000);
if(process.env.TRUST_PROXY==='1') app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'1mb'})); app.use(express.urlencoded({extended:false}));
app.use(session({
  store:new pgSession({pool,tableName:'user_sessions',createTableIfMissing:true}),
  name:'ethan.sid',secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:1000*60*60*8}
}));

const authLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false});
const registerLimiter=rateLimit({windowMs:60*60*1000,limit:5,standardHeaders:'draft-7',legacyHeaders:false});
function emailOk(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
function requireAuth(req,res,next){return req.session?.userId?next():res.status(401).json({error:'Authentication required'})}
async function requireAdmin(req,res,next){const u=await getUserById(req.session?.userId);return u?.role==='admin'?next():res.status(403).json({error:'Admin access required'})}
function safeUser(u){return u?{id:u.id,email:u.email,displayName:u.display_name,role:u.role,createdAt:u.created_at,mailboxId:u.mailbox_id||null,mailboxAddress:u.mailbox_address||null,mailboxProvider:u.provider||null}:null}
function domainAllowed(email){const domain=(process.env.EMAIL_DOMAIN||'').trim().toLowerCase();return !domain||email.endsWith(`@${domain}`)}
function registrationOpen(){return String(process.env.REGISTRATION_MODE||'open').toLowerCase()==='open'}

async function mailboxFor(userId){
  const s=await getMailboxSettings(userId); if(!s)return null;
  return {fromName:s.from_name,fromAddress:s.from_address,smtpHost:s.smtp_host,smtpPort:s.smtp_port,smtpSecure:s.smtp_secure,smtpUser:s.smtp_user,smtpPass:decrypt(s.smtp_pass_enc),imapHost:s.imap_host,imapPort:s.imap_port,imapSecure:s.imap_secure,imapUser:s.imap_user,imapPass:decrypt(s.imap_pass_enc)};
}

app.post('/api/auth/register',registerLimiter,async(req,res)=>{
  if(!registrationOpen())return res.status(403).json({error:'New registration is currently closed'});
  const email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||''), displayName=String(req.body.displayName||'').trim().slice(0,100);
  if(!emailOk(email))return res.status(400).json({error:'Enter a valid email address'});
  if(!domainAllowed(email))return res.status(400).json({error:`Use an @${process.env.EMAIL_DOMAIN} email address`});
  if(password.length<10)return res.status(400).json({error:'Password must contain at least 10 characters'});
  try{const existing=await getUserByEmail(email);if(existing)return res.status(409).json({error:'An account with this email already exists'});const count=(await listUsers(1)).length;const role=count===0?'admin':'user';const user=await createUser({email,passwordHash:await bcrypt.hash(password,12),displayName:displayName||email.split('@')[0],role});req.session.userId=user.id;res.status(201).json({ok:true,user:safeUser(user)});}catch(e){res.status(500).json({error:'Could not create account'});}
});
app.post('/api/auth/login',authLimiter,async(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
  const user=await getUserByEmail(email);if(!user||!await bcrypt.compare(password,user.password_hash))return res.status(401).json({error:'Invalid email or password'});
  req.session.regenerate(err=>{if(err)return res.status(500).json({error:'Could not start secure session'});req.session.userId=user.id;res.json({ok:true,user:safeUser(user)});});
});
app.post('/api/auth/logout',requireAuth,(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/auth/me',async(req,res)=>{const user=req.session?.userId?await getUserById(req.session.userId):null;res.json({authenticated:Boolean(user),user:safeUser(user),registrationOpen:registrationOpen(),emailDomain:process.env.EMAIL_DOMAIN||''})});

app.get('/api/status',requireAuth,async(req,res)=>{const c=await mailboxFor(req.session.userId);res.json({configured:{smtp:smtpConfigured(c),imap:imapConfigured(c)},from:c?.fromAddress||'',hasMailbox:Boolean(c)});});
app.get('/api/status/verify',requireAuth,async(req,res)=>{try{const c=await mailboxFor(req.session.userId);if(!c)return res.status(400).json({error:'Configure your mailbox first'});res.json(await verifyServices(c));}catch(e){res.status(400).json({error:e.message})}});
app.get('/api/settings/mailbox',requireAuth,async(req,res)=>{const s=await getMailboxSettings(req.session.userId);if(!s)return res.json({configured:false,preset:{smtpHost:'mail.spacemail.com',smtpPort:465,smtpSecure:true,imapHost:'mail.spacemail.com',imapPort:993,imapSecure:true}});res.json({configured:true,fromName:s.from_name,fromAddress:s.from_address,smtpHost:s.smtp_host,smtpPort:s.smtp_port,smtpSecure:s.smtp_secure,smtpUser:s.smtp_user,imapHost:s.imap_host,imapPort:s.imap_port,imapSecure:s.imap_secure,imapUser:s.imap_user,hasSmtpPassword:Boolean(s.smtp_pass_enc),hasImapPassword:Boolean(s.imap_pass_enc)});});
app.put('/api/settings/mailbox',requireAuth,async(req,res)=>{
  const b=req.body||{}; const smtpPort=Number(b.smtpPort||465),imapPort=Number(b.imapPort||993);
  if(!b.smtpHost||!b.smtpUser||!b.imapHost||!b.imapUser)return res.status(400).json({error:'SMTP and IMAP host/user fields are required'});
  if(!Number.isInteger(smtpPort)||smtpPort<1||smtpPort>65535||!Number.isInteger(imapPort)||imapPort<1||imapPort>65535)return res.status(400).json({error:'Enter valid mail server ports'});
  try{await upsertMailboxSettings(req.session.userId,{fromName:String(b.fromName||'Ethan Email').slice(0,100),fromAddress:String(b.fromAddress||b.smtpUser).trim().slice(0,254),smtpHost:String(b.smtpHost).trim().slice(0,255),smtpPort,smtpSecure:Boolean(b.smtpSecure),smtpUser:String(b.smtpUser).trim().slice(0,254),smtpPassEnc:b.smtpPass?encrypt(String(b.smtpPass)):'' ,imapHost:String(b.imapHost).trim().slice(0,255),imapPort,imapSecure:Boolean(b.imapSecure),imapUser:String(b.imapUser).trim().slice(0,254),imapPassEnc:b.imapPass?encrypt(String(b.imapPass)):''});res.json({ok:true});}catch(e){res.status(400).json({error:e.message})}
});

app.get('/api/mail/inbox',requireAuth,async(req,res)=>{try{const c=await mailboxFor(req.session.userId);if(!imapConfigured(c))return res.status(400).json({error:'Configure IMAP in Settings first'});res.json({messages:await listInbox(c,Math.min(Number(req.query.limit)||50,100))});}catch(e){res.status(502).json({error:'Could not load inbox',detail:e.message})}});
app.get('/api/mail/inbox/:uid',requireAuth,async(req,res)=>{try{const c=await mailboxFor(req.session.userId);const msg=await readMessage(c,Number(req.params.uid));if(!msg)return res.status(404).json({error:'Message not found'});res.json(msg);}catch(e){res.status(502).json({error:'Could not read message',detail:e.message})}});
app.post('/api/mail/send',requireAuth,async(req,res)=>{const to=String(req.body.to||'').trim(),subject=String(req.body.subject||'').slice(0,300),text=String(req.body.text||'').slice(0,100000);if(!emailOk(to))return res.status(400).json({error:'Enter a valid recipient email address'});try{const c=await mailboxFor(req.session.userId);if(!smtpConfigured(c))return res.status(400).json({error:'Configure SMTP in Settings first'});res.json({ok:true,result:await sendMail(c,{to,subject,text})});}catch(e){res.status(502).json({error:'Message could not be sent',detail:e.message})}});

app.get('/api/admin/users',requireAuth,requireAdmin,async(req,res)=>res.json({users:(await listUsers(100)).map(safeUser)}));

function localPartOk(v){return /^(?=[a-z0-9])(?=.*[a-z0-9]$)[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/.test(v) && v.length<=50}
app.get('/api/admin/provisioning/status',requireAuth,requireAdmin,(req,res)=>res.json({provider:'spacemail',configured:true,domain:process.env.EMAIL_DOMAIN||'',imapHost:'mail.spacemail.com',imapPort:993,smtpHost:'mail.spacemail.com',smtpPort:465}));
app.get('/api/admin/mailboxes',requireAuth,requireAdmin,async(req,res)=>{try{res.json({mailboxes:await listProvisionedMailboxes(200)});}catch(e){res.status(500).json({error:'Could not load mailbox directory'})}});
app.post('/api/admin/mailboxes',requireAuth,requireAdmin,async(req,res)=>{try{const localPart=String(req.body.localPart||'').trim().toLowerCase();const userId=req.body.userId?Number(req.body.userId):null;const domain=(process.env.EMAIL_DOMAIN||'ethandigitalacademy.org').trim().toLowerCase();if(!localPartOk(localPart))return res.status(400).json({error:'Use 1–50 lowercase letters, numbers, dots, underscores or hyphens'});if(userId&&!await getUserById(userId))return res.status(404).json({error:'Selected user was not found'});const address=`${localPart}@${domain}`;const mailboxId=`spacemail:${address}`;const box=await saveProvisionedMailbox({userId,mailboxId,address,provider:'spacemail',status:'active'});res.status(201).json({ok:true,mailbox:{id:box.mailbox_id,address:box.mailbox_address,status:box.status}});}catch(e){res.status(409).json({error:'Mailbox may already be registered in Ethan Email'})}});
app.delete('/api/admin/mailboxes/:id',requireAuth,requireAdmin,async(req,res)=>{try{await removeProvisionedMailbox(req.params.id);res.json({ok:true});}catch(e){res.status(500).json({error:'Could not remove mailbox from Ethan Email directory'})}});
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req, res) => {
  res.status(404).send('Not found');
});
initDb().then(()=>app.listen(PORT,()=>console.log(`Ethan Email Phase 4 running on port ${PORT}`))).catch(e=>{console.error('Database initialization failed:',e.message);process.exit(1)});
