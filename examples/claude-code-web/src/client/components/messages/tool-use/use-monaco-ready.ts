import { useEffect, useState } from 'react';

import { getMonaco } from './monaco-helpers';
import { ensureMonaco } from './monaco-loader';

export function useMonacoReady(): boolean {
  const [ready, setReady] = useState<boolean>(() => !!getMonaco());

  useEffect(() => {
    if (ready) {
      return;
    }

    let isMounted = true;
    const promise = ensureMonaco();

    promise
      ?.then(() => {
        if (isMounted) {
          setReady(!!getMonaco());
        }
      })
      .catch(() => {
        if (isMounted) {
          setReady(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [ready]);

  return ready;
}
