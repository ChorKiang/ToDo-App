'use client';
import { useState, useEffect } from 'react';

export const REMINDER_OPTIONS = [
  { label: 'No reminder', value: null },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '2 hours before', value: 120 },
  { label: '1 day before', value: 1440 },
  { label: '2 days before', value: 2880 },
  { label: '1 week before', value: 10080 },
];

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const startPolling = () => {
    return setInterval(async () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      try {
        const res = await fetch('/api/notifications/check');
        const data = await res.json();
        for (const todo of data.todos ?? []) {
          new Notification('Todo Due Soon', {
            body: `${todo.title} — due ${new Date(todo.due_date).toLocaleTimeString('en-SG')}`,
            icon: '/favicon.ico',
          });
        }
      } catch { /* silently fail */ }
    }, 30_000);
  };

  return { permission, requestPermission, startPolling };
}
