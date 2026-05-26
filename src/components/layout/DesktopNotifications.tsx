import { useEffect } from 'react';
import { useDesktopNotifications } from '@/hooks/useDesktopNotifications';

export function DesktopNotifications() {
  useDesktopNotifications();
  return null;
}