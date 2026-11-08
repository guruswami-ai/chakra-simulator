import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const TABLET_MIN = 768;
const DESKTOP_MIN = 1024;

function getBreakpoint(width: number): Breakpoint {
  if (width >= DESKTOP_MIN) return 'desktop';
  if (width >= TABLET_MIN) return 'tablet';
  return 'mobile';
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    typeof window !== 'undefined' ? getBreakpoint(window.innerWidth) : 'desktop'
  );

  useEffect(() => {
    const tabletQuery = window.matchMedia(`(min-width: ${TABLET_MIN}px)`);
    const desktopQuery = window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`);

    const update = () => {
      if (desktopQuery.matches) setBreakpoint('desktop');
      else if (tabletQuery.matches) setBreakpoint('tablet');
      else setBreakpoint('mobile');
    };

    tabletQuery.addEventListener('change', update);
    desktopQuery.addEventListener('change', update);
    return () => {
      tabletQuery.removeEventListener('change', update);
      desktopQuery.removeEventListener('change', update);
    };
  }, []);

  return breakpoint;
}
