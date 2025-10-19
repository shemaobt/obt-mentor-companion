import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { themes } from '@/lib/themes';

interface ThemeContextType {
  currentTheme: string;
  currentLogo: string;
  setTheme: (themeKey: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState('verdeClaro');
  const [currentLogo, setCurrentLogo] = useState('/logo.png');

  useEffect(() => {
    const savedTheme = localStorage.getItem('obt-theme') || 'verdeClaro';
    setCurrentTheme(savedTheme);
    updateLogo(savedTheme);

    const handleThemeChange = () => {
      const newTheme = localStorage.getItem('obt-theme') || 'verdeClaro';
      setCurrentTheme(newTheme);
      updateLogo(newTheme);
    };

    window.addEventListener('theme-changed', handleThemeChange);
    return () => window.removeEventListener('theme-changed', handleThemeChange);
  }, []);

  const updateLogo = (themeKey: string) => {
    const theme = themes[themeKey];
    if (theme?.icon) {
      setCurrentLogo(theme.icon);
    } else {
      setCurrentLogo('/logo.png');
    }
  };

  const setTheme = (themeKey: string) => {
    setCurrentTheme(themeKey);
    updateLogo(themeKey);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, currentLogo, setTheme }}>
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
