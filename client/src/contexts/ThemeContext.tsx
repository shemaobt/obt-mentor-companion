import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { themes } from '@/lib/themes';

interface ThemeContextType {
  currentTheme: string;
  setTheme: (themeKey: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState('verdeClaro');

  useEffect(() => {
    const savedTheme = localStorage.getItem('obt-theme') || 'verdeClaro';
    setCurrentTheme(savedTheme);
    updateFavicon(savedTheme);

    const handleThemeChange = () => {
      const newTheme = localStorage.getItem('obt-theme') || 'verdeClaro';
      setCurrentTheme(newTheme);
      updateFavicon(newTheme);
    };

    window.addEventListener('theme-changed', handleThemeChange);
    return () => window.removeEventListener('theme-changed', handleThemeChange);
  }, []);

  const updateFavicon = (themeKey: string) => {
    const theme = themes[themeKey];
    if (!theme) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Fill background with theme color
    ctx.fillStyle = theme.brand.hex;
    ctx.fillRect(0, 0, 64, 64);
    
    // Load and draw white logo
    const img = new Image();
    img.onload = () => {
      // Center the logo with padding
      const padding = 8;
      ctx.drawImage(img, padding, padding, 64 - padding * 2, 64 - padding * 2);
      
      // Update favicon link elements
      const faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
      const shortcutIcon = document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement;
      
      const faviconUrl = canvas.toDataURL('image/png');
      
      if (faviconLink) faviconLink.href = faviconUrl;
      if (appleTouchIcon) appleTouchIcon.href = faviconUrl;
      if (shortcutIcon) shortcutIcon.href = faviconUrl;
    };
    img.src = '/logo.png';
  };

  const setTheme = (themeKey: string) => {
    setCurrentTheme(themeKey);
    updateFavicon(themeKey);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
