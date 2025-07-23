import { NextResponse } from 'next/server';
import fs from 'fs';

export async function GET() {
  try {
    const qr = fs.readFileSync('latest-qr.txt', 'utf8');
    return NextResponse.json({ qr });
  } catch {
    return NextResponse.json({ qr: null });
  }
} 