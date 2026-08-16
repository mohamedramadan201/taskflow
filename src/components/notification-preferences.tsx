"use client";

import { useState } from "react";

export function NotificationPreferences({ initialEmail, initialReminders }: { initialEmail: boolean; initialReminders: boolean }) {
  const [emailNotifications, setEmailNotifications] = useState(initialEmail);
  const [taskReminderNotifications, setTaskReminderNotifications] = useState(initialReminders);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function update(values: { emailNotifications?: boolean; taskReminderNotifications?: boolean }) {
    setMessage("Saving...");
    setSaving(true);
    const response = await fetch("/api/notification-preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
    if (!response.ok) { setMessage("Could not save preferences."); setSaving(false); return; }
    const result = await response.json();
    setEmailNotifications(result.emailNotifications);
    setTaskReminderNotifications(result.taskReminderNotifications);
    setMessage("Preferences saved.");
    setSaving(false);
  }

  return <section className="preference-panel"><div><h2>Notification preferences</h2><p>Task assignments always appear in the app. Choose which updates TaskFlow should also email.</p></div><label><span><strong>Task reminders</strong><small>Receive reminders created for your assigned tasks.</small></span><input aria-label="Task reminders" role="switch" type="checkbox" disabled={saving} checked={taskReminderNotifications} onChange={(event) => { setTaskReminderNotifications(event.target.checked); update({ taskReminderNotifications: event.target.checked }); }} /></label><label><span><strong>Email delivery</strong><small>Also email task assignments and enabled reminders.</small></span><input aria-label="Email delivery" role="switch" type="checkbox" disabled={saving} checked={emailNotifications} onChange={(event) => { setEmailNotifications(event.target.checked); update({ emailNotifications: event.target.checked }); }} /></label><small className="preference-message" aria-live="polite">{message}</small></section>;
}
