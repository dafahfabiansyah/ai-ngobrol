"use client";
import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const newMessages = [...messages, { role: "user", text: input }];
    setMessages(newMessages);
    setLoading(true);
    setInput("");
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        body: JSON.stringify({ messages: newMessages }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setMessages((msgs) => [
        ...msgs,
        { role: "bot", text: data.text || data.error || "(No response)" },
      ]);
    } catch (e) {
      console.error(e);
      setMessages((msgs) => [
        ...msgs,
        { role: "bot", text: "Terjadi error saat menghubungi server." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 500, margin: "40px auto", padding: 20, border: "1px solid #eee", borderRadius: 8 }}>
      <h2>Chat dengan Gemini</h2>
      <div style={{ minHeight: 200, marginBottom: 16 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ margin: "8px 0", textAlign: msg.role === "user" ? "right" : "left" }}>
            <b>{msg.role === "user" ? "Kamu" : "Gemini"}:</b> {msg.text}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ketik pesan..."
          style={{ flex: 1, padding: 8 }}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()} style={{ padding: "8px 16px" }}>
          {loading ? "Mengirim..." : "Kirim"}
        </button>
      </div>
    </main>
  );
}
