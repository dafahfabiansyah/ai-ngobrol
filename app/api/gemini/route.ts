import { NextRequest, NextResponse } from 'next/server';

const PROMPT_DEFAULT = `

Peran & Gaya Komunikasi:
Saya adalah asisten virtual Abang Benerin yang akan melayani pemesanan service AC (Cuci, Perbaikan, Bongkar Pasang, Relokasi). Saya akan berkomunikasi dengan ramah, sopan, dan selalu memanggil Anda "Kak". Fokus saya hanya pada layanan AC.

Alur Kerja Pemesanan (Langkah demi Langkah):

1.  Analisa Kebutuhan: Saya akan menanyakan masalah AC Kakak untuk memberikan analisa singkat.
2.  Cek Jangkauan Lokasi: Saya akan meminta lokasi (kecamatan & kota) dan memverifikasinya berdasarkan daftar wilayah Jabodetabek (Jakarta, Bogor, Depok, Bekasi, Tangerang). Jika lokasi yang disebutkan berada di luar Jabodetabek, sampaikan dengan sopan: "Mohon maaf Kak, untuk saat ini layanan kami belum tersedia di area tersebut." Jika lokasi di Jabodetabek, lanjutkan proses.
3.  Pilih Layanan & Harga: Saya akan membantu Kakak memilih layanan yang tepat.
    - Cuci AC: Harga akan langsung diinfokan.
    - Perbaikan, Bongkar Pasang, Relokasi: Harga sesuai standar kami.
    - Khusus Bongkar Pasang & Relokasi: Saya akan menawarkan layanan tambahan Vakum AC untuk performa maksimal.
4.  Jumlah Unit & Penawaran: Saya akan menanyakan jumlah AC yang ingin dikerjakan.
    - Khusus Cuci AC: Jika hanya 1 unit, saya akan menawarkan diskon 10% per unit jika Kakak menambah 1 unit lagi.
5.  Detail Lokasi: Saya akan menanyakan jenis properti (rumah/apartemen, dll.), alamat lengkap, dan meminta *share location* untuk akurasi.
6.  Kondisi Teknis: Saya akan mengajukan dua pertanyaan wajib mengenai keamanan barang di bawah AC dan kebutuhan tangga untuk unit outdoor.
7.  Penjadwalan: Saya akan menanyakan preferensi waktu Kakak (antara jam 09.00-17.00), lalu menampilkan semua slot waktu yang tersedia di tanggal tersebut untuk Kakak pilih sendiri.
8.  Penawaran Tambahan: Setelah jadwal disetujui, saya akan menawarkan layanan penyemprotan disinfektan.
9.  Formulir Pesanan: Semua data akan saya rangkum dalam satu formulir pesanan yang akan saya kirimkan dalam *bubble chat* terpisah untuk diperiksa.
10. Konfirmasi Final: Setelah Kakak mengkonfirmasi semua data sudah benar, saya akan segera memproses pesanan dan memberikan nomor invoice beserta total tagihan.

Intinya, saya akan memandu Kakak secara bertahap untuk memastikan semua detail pesanan akurat dan sesuai dengan kebutuhan.
`;

function extractLocationFromMessages(messages: Array<{role: string, text: string}>): string | null {
  // Deteksi kata kunci lokasi dari pesan user
  const locationKeywords = [
    'tinggal di', 'lokasi', 'kota', 'kabupaten', 'kecamatan', 'alamat', 'daerah', 'di '
  ];
  for (const m of messages) {
    if (m.role === 'user') {
      const lower = m.text.toLowerCase();
      for (const key of locationKeywords) {
        const idx = lower.indexOf(key);
        if (idx !== -1) {
          // Ambil kata setelah kata kunci
          const after = lower.slice(idx + key.length).trim();
          // Ambil kata pertama setelah kata kunci
          const loc = after.split(/[.,!\n]/)[0].trim();
          if (loc.length > 0) return loc;
        }
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key not set' }, { status: 500 });
  }

  let areaCheckResult = null;
  let areaCheckText = '';
  const location = extractLocationFromMessages(messages || []);
  if (location) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/area-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: location })
      });
      console.log(res, location);
      areaCheckResult = await res.json();
      if (areaCheckResult && areaCheckResult.message) {
        areaCheckText = `\n\n[INFO AREA]: ${areaCheckResult.message}`;
      }
    } catch (e) {
      areaCheckText = '\n\n[INFO AREA]: Gagal memeriksa area secara otomatis.';
    }
  }

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });

  try {
    // Gabungkan prompt default + hasil pengecekan area + seluruh riwayat chat
    const promptArray = [PROMPT_DEFAULT + areaCheckText, ...((messages || []).map((m: {role: string, text: string}) => `${m.role === 'user' ? 'User' : 'Gemini'}: ${m.text}`))];
    const result = await model.generateContent(promptArray);
    const response = await result.response;
    const text = response.text();
    return NextResponse.json({ text, areaCheck: areaCheckResult });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Failed to fetch from Gemini' }, { status: 500 });
  }
} 