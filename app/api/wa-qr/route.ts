import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)),
  });
}
const db = admin.firestore();

export async function GET() {
  try {
    const doc = await db.collection('wa').doc('latest-qr').get();
    const data = doc.data();
    return NextResponse.json({ qr: data?.qr ?? null });
  } catch (e) {
    return NextResponse.json({ qr: null });
  }
} 