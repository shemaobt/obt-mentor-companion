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
      
      // Convert canvas to data URL
      const faviconUrl = canvas.toDataURL('image/png');
      
      // Update all favicon link elements
      let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
      let shortcutIcon = document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement;
      
      // Create link elements if they don't exist
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        faviconLink.type = 'image/png';
        document.head.appendChild(faviconLink);
      }
      
      if (!appleTouchIcon) {
        appleTouchIcon = document.createElement('link');
        appleTouchIcon.rel = 'apple-touch-icon';
        document.head.appendChild(appleTouchIcon);
      }
      
      if (!shortcutIcon) {
        shortcutIcon = document.createElement('link');
        shortcutIcon.rel = 'shortcut icon';
        document.head.appendChild(shortcutIcon);
      }
      
      // Update href for all favicon links
      faviconLink.href = faviconUrl;
      appleTouchIcon.href = faviconUrl;
      shortcutIcon.href = faviconUrl;
    };
    
    img.onerror = () => {
      console.error('Failed to load logo-white.png for favicon generation');
    };
    
    img.src = '/logo-white.png';
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
