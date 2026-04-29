'use client';

import { useEffect, useState } from 'react';

export type Surface = 'desktop' | 'mobile-web' | 'pwa';

const MOBILE_BREAKPOINT_PX = 768;

function compute(): Surface {
  if (typeof window === 'undefined') return 'desktop';
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isStandalone) return 'pwa';
  if (window.innerWidth < MOBILE_BREAKPOINT_PX) return 'mobile-web';
  return 'desktop';
}

export function useSurface(): Surface {
  const [surface, setSurface] = useState<Surface>('desktop');

  useEffect(() => {
    setSurface(compute());
    const onResize = () => setSurface(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return surface;
}

export const isMobileSurface = (s: Surface) => s !== 'desktop';
