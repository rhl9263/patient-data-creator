/**
 * Custom hook for managing notifications/toasts
 */
import { useState, useCallback } from 'react';

export const useNotification = () => {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((type, message, options = {}) => {
    const { duration = 2500 } = options;
    const id = Math.random().toString(36).slice(2);
    
    setToasts((prev) => {
      // Prevent duplicate messages
      const isDuplicate = prev.some(t => t.message === message && t.type === type);
      if (isDuplicate) return prev;
      
      return [...prev, { id, type, message }];
    });
    
    // Auto-dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    notify,
    removeToast,
    clearAllToasts
  };
};
