import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const formatTime = (createdAt) => {
  if (!createdAt) return '';
  try {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return '';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
};

export const NotificationDropdown = ({
  notifications,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
    >
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-bold text-slate-800">Notifications</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No notifications yet</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.readAt && onMarkAsRead?.(n.id)}
              className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${
                !n.readAt ? 'bg-primary/5 border-l-2 border-l-primary' : ''
              }`}
            >
              <p className="text-sm font-semibold text-slate-800">{n.title}</p>
              <p className="text-xs text-slate-500 mt-1">{n.message}</p>
              <p className="text-[10px] text-slate-400 mt-2">{formatTime(n.createdAt)}</p>
            </div>
          ))
        )}
      </div>
      {unreadCount > 0 && (
        <div className="p-3 text-center border-t border-slate-100">
          <button
            type="button"
            onClick={() => onMarkAllAsRead?.()}
            className="text-xs font-bold text-primary hover:underline"
          >
            Mark all as read
          </button>
        </div>
      )}
    </motion.div>
  );
};
