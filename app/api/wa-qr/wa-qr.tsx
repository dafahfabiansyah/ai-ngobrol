"use client";
import { useEffect, useState } from "react";
// @ts-ignore
const QRCode = require("qrcode.react");

export default function WaQrPage() {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    const fetchQr = async () => {
      const res = await fetch("/api/wa-qr");
      const data = await res.json();
      setQr(data.qr);
    };
    fetchQr();
    const interval = setInterval(fetchQr, 10000); // refresh tiap 10 detik
    return () => clearInterval(interval);
  }, []);

  return (
    <main style={{ maxWidth: 400, margin: "40px auto", padding: 20, textAlign: "center" }}>
      <h2>Scan QR WhatsApp Bot</h2>
      {qr ? <QRCode value={qr} size={256} /> : <p>Menunggu QR code...</p>}
      <p style={{ marginTop: 16, color: '#888' }}>Scan QR ini dengan WhatsApp di HP kamu untuk login bot.</p>
    </main>
  );
} 