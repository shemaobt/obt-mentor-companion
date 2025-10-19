import { useState, useEffect } from 'react';
import { themes } from '@/lib/themes';

export function useThemeLogo() {
  const [logoSrc, setLogoSrc] = useState('/logo.png');

  useEffect(() => {
    const updateLogo = () => {
      const savedTheme = localStorage.getItem('obt-theme') || 'verdeClaro';
      const theme = themes[savedTheme];
      
      if (theme?.icon) {
        setLogoSrc(theme.icon);
      } else {
        setLogoSrc('/logo.png');
      }
    };

    // Update logo on mount
    updateLogo();

    // Listen for theme changes
    window.addEventListener('storage', updateLogo);
    window.addEventListener('theme-changed', updateLogo);

    return () => {
      window.removeEventListener('storage', updateLogo);
      window.removeEventListener('theme-changed', updateLogo);
    };
  }, []);

  return logoSrc;
}
