const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');

function bool(v, fallback=false){
  if(v === undefined || v === null) return fallback;
  if(typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true';
}
function smtpConfigured(c){ return Boolean(c?.smtpHost && c?.smtpUser && c?.smtpPass); }
function imapConfigured(c){ return Boolean(c?.imapHost && c?.imapUser && c?.imapPass); }
function transporter(c){
  if(!smtpConfigured(c)) throw new Error('SMTP is not configured for this account');
  return nodemailer.createTransport({host:c.smtpHost,port:Number(c.smtpPort||465),secure:bool(c.smtpSecure,true),auth:{user:c.smtpUser,pass:c.smtpPass}});
}
function imapClient(c){
  if(!imapConfigured(c)) throw new Error('IMAP is not configured for this account');
  return new ImapFlow({host:c.imapHost,port:Number(c.imapPort||993),secure:bool(c.imapSecure,true),auth:{user:c.imapUser,pass:c.imapPass},logger:false});
}
async function verifyServices(c){
  const result={smtp:smtpConfigured(c),imap:imapConfigured(c),smtpOk:false,imapOk:false};
  if(result.smtp){try{await transporter(c).verify();result.smtpOk=true}catch(e){result.smtpError=e.message}}
  if(result.imap){const client=imapClient(c);try{await client.connect();result.imapOk=true}catch(e){result.imapError=e.message}finally{try{await client.logout()}catch(_){}}}
  return result;
}
async function sendMail(c,{to,subject,text}){
  const fromAddress=c.fromAddress||c.smtpUser;
  const fromName=c.fromName||'Ethan Email';
  const info=await transporter(c).sendMail({from:`\"${String(fromName).replace(/[\r\n"]/g,'')}\" <${fromAddress}>`,to,subject:subject||'(no subject)',text:text||''});
  return {messageId:info.messageId,accepted:info.accepted,rejected:info.rejected};
}
async function listInbox(c,limit=50){
  const client=imapClient(c); await client.connect();
  try{const lock=await client.getMailboxLock('INBOX');try{const exists=client.mailbox.exists||0;if(!exists)return[];const start=Math.max(1,exists-limit+1),items=[];for await(const msg of client.fetch(`${start}:*`,{envelope:true,flags:true,internalDate:true,uid:true})){const from=msg.envelope?.from?.[0];items.push({uid:msg.uid,from:from?(from.name||from.address||'Unknown'):'Unknown',fromAddress:from?.address||'',subject:msg.envelope?.subject||'(no subject)',date:msg.internalDate||msg.envelope?.date||null,unread:!msg.flags?.has('\\Seen')});}return items.reverse();}finally{lock.release();}}finally{await client.logout();}
}
async function readMessage(c,uid){
  const client=imapClient(c); await client.connect();
  try{const lock=await client.getMailboxLock('INBOX');try{const msg=await client.fetchOne(uid,{envelope:true,source:true,flags:true},{uid:true});if(!msg)return null;await client.messageFlagsAdd(uid,['\\Seen'],{uid:true});const from=msg.envelope?.from?.[0];return{uid,from:from?(from.name||from.address||'Unknown'):'Unknown',fromAddress:from?.address||'',subject:msg.envelope?.subject||'(no subject)',date:msg.envelope?.date||null,raw:msg.source?msg.source.toString('utf8'):''};}finally{lock.release();}}finally{await client.logout();}
}
module.exports={verifyServices,sendMail,listInbox,readMessage,smtpConfigured,imapConfigured};
