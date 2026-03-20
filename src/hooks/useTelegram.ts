import { useEffect, useState } from 'react';
import { init, backButton, viewport } from '@telegram-apps/sdk-react';

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      init();

      if (viewport.mount.isAvailable()) {
        viewport.mount().then(() => {
          if (viewport.expand.isAvailable()) {
            viewport.expand();
          }
        });
      }

      if (backButton.mount.isAvailable()) {
        backButton.mount();
      }

      setIsReady(true);
    } catch (e) {
      console.warn('Telegram SDK init failed (running outside Telegram?):', e);
      setIsReady(true);
    }

    return () => {
      if (backButton.isMounted()) {
        backButton.unmount();
      }
    };
  }, []);

  return { isReady };
}
