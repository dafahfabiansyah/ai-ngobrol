require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');
const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const client = new Client({
  authStrategy: new LocalAuth()
});

client.on('qr', async qr => {
  qrcode.generate(qr, { small: true });
  fs.writeFileSync('latest-qr.txt', qr);
  // Simpan QR ke Firestore
  try {
    await db.collection('wa').doc('latest-qr').set({ qr, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  } catch (e) {
    console.error('Gagal simpan QR ke Firestore:', e);
  }
});
client.on('ready', () => console.log('WhatsApp bot ready!'));

// Simpan chat ke Firestore
async function saveChat(user, role, text) {
  await db.collection('chats').doc(user).collection('messages').add({
    role,
    text,
    timestamp: Date.now()
  });
}

// Ambil riwayat chat (20 terakhir)
async function getChatHistory(user, limit = 20) {
  const snapshot = await db.collection('chats').doc(user).collection('messages')
    .orderBy('timestamp', 'desc').limit(limit).get();
  const history = [];
  snapshot.forEach(doc => history.push(doc.data()));
  return history.reverse(); // urutkan dari lama ke baru
}

client.on('message', async msg => {
  const user = msg.from;
  await saveChat(user, 'user', msg.body);

  // Ambil 20 chat terakhir
  const history = await getChatHistory(user, 20);
  const messages = history.map(h => ({ role: h.role, text: h.text }));

  // Kirim ke Gemini
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    const data = await res.json();
    await saveChat(user, 'bot', data.text);
    client.sendMessage(user, data.text);
  } catch (e) {
    client.sendMessage(user, 'Maaf Kak, server sedang bermasalah.');
  }
});

client.initialize(); 