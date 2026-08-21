"use client";

import { useState } from "react";

type TelegramConnectionState = { id: string; username: string | null; firstName: string | null; linkedAt: string; lastSeenAt: string | null; enabled: boolean } | null;

export function TelegramConnection({ configured, initialConnection }: { configured: boolean; initialConnection: TelegramConnectionState }) {
  const [connection, setConnection] = useState(initialConnection);
  const [linkUrl, setLinkUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    const response = await fetch("/api/telegram/connection", { cache: "no-store" });
    const result = await response.json();
    if (response.ok) { setConnection(result.connection); setMessage(result.connection ? "Telegram is connected." : "Telegram has not been connected yet."); }
    else setMessage(result.error || "Could not check Telegram.");
    setBusy(false);
  }

  async function connect() {
    setBusy(true);
    const response = await fetch("/api/telegram/connection", { method: "POST" });
    const result = await response.json();
    if (response.ok && result.linkUrl) { setLinkUrl(result.linkUrl); setMessage("Open the bot, press Start, then refresh this status."); }
    else setMessage(result.error || "Could not create a Telegram connection link.");
    setBusy(false);
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Telegram from your TaskFlow account?")) return;
    setBusy(true);
    const response = await fetch("/api/telegram/connection", { method: "DELETE" });
    if (response.ok) { setConnection(null); setLinkUrl(""); setMessage("Telegram disconnected."); }
    else setMessage("Could not disconnect Telegram.");
    setBusy(false);
  }

  return <section className="telegram-panel"><div><span className="eyebrow">TELEGRAM</span><h2>Capture tasks from Telegram</h2><p>Connect your Telegram chat to create TaskFlow tasks with <code>/task</code> or <code>/note</code>.</p></div>{connection ? <div className="telegram-status"><strong>Connected{connection.username ? ` as @${connection.username}` : ""}</strong><small>{connection.lastSeenAt ? `Last message: ${new Date(connection.lastSeenAt).toLocaleString()}` : "Open the bot to send your first task."}</small><div><button className="ghost-button" type="button" onClick={refresh} disabled={busy}>Refresh status</button><button className="ghost-button danger" type="button" onClick={disconnect} disabled={busy}>Disconnect</button></div></div> : <div className="telegram-actions">{configured ? <><button className="primary-button small" type="button" onClick={connect} disabled={busy}>Connect Telegram</button>{linkUrl && <a className="toolbar-link" href={linkUrl} target="_blank" rel="noreferrer">Open Telegram bot</a>}</> : <small>Telegram is not configured by the administrator yet.</small>}<button className="ghost-button" type="button" onClick={refresh} disabled={busy}>Refresh status</button></div>}<small className="preference-message" aria-live="polite">{message}</small></section>;
}
