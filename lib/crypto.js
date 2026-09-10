const crypto = require('crypto');

function key(){
  const raw = process.env.MAIL_CREDENTIALS_KEY || '';
  const buf = Buffer.from(raw, 'base64');
  if(buf.length !== 32) throw new Error('MAIL_CREDENTIALS_KEY must be a base64-encoded 32-byte key');
  return buf;
}
function encrypt(value){
  if(!value) return '';
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const enc=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return Buffer.concat([iv,tag,enc]).toString('base64');
}
function decrypt(payload){
  if(!payload) return '';
  const b=Buffer.from(payload,'base64');
  const iv=b.subarray(0,12), tag=b.subarray(12,28), data=b.subarray(28);
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(),iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8');
}
module.exports={encrypt,decrypt};
