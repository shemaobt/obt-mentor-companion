import { useState } from 'react';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { themes, type ColorTheme } from '@/lib/themes';

export function ThemeSwitcher() {
  const [selectedTheme, setSelectedTheme] = useState<string>('olive');
  const [open, setOpen] = useState(false);

  const applyTheme = (themeKey: string) => {
    const theme = themes[themeKey];
    if (!theme) return;

    const root = document.documentElement;
    const [h, s, l] = theme.brand.hsl.split(',').map(v => v.trim());

    // Light mode colors
    root.style.setProperty('--primary', `hsl(${theme.brand.hsl})`);
    root.style.setProperty('--ring', `hsl(${theme.brand.hsl})`);
    root.style.setProperty('--sidebar-primary', `hsl(${theme.brand.hsl})`);
    root.style.setProperty('--sidebar-ring', `hsl(${theme.brand.hsl})`);
    root.style.setProperty('--chart-1', `hsl(${theme.brand.hsl})`);
    
    // Accent variations
    root.style.setProperty('--accent', `hsl(${h}, ${s}, 65%)`);
    root.style.setProperty('--secondary', `hsl(${h}, 20%, 90%)`);
    root.style.setProperty('--sidebar-accent', `hsl(${h}, 20%, 90%)`);
    
    // Chart variations
    root.style.setProperty('--chart-2', `hsl(${h}, 35%, 55%)`);
    root.style.setProperty('--chart-3', `hsl(${h}, 25%, 65%)`);
    root.style.setProperty('--chart-4', `hsl(${h}, 20%, 75%)`);
    root.style.setProperty('--chart-5', `hsl(${h}, 15%, 82%)`);

    // Save to localStorage for persistence
    localStorage.setItem('obt-theme', themeKey);
    setSelectedTheme(themeKey);
  };

  // Apply saved theme on mount
  useState(() => {
    const savedTheme = localStorage.getItem('obt-theme') || 'verdeClaro';
    applyTheme(savedTheme);
    setSelectedTheme(savedTheme);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          data-testid="button-theme-switcher"
        >
          <Palette className="h-4 w-4" />
          <span className="hidden md:inline">Theme</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose Color Theme</DialogTitle>
          <DialogDescription>
            Select a color scheme for your OBT Mentor Companion
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {Object.entries(themes).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => {
                applyTheme(key);
                setOpen(false);
              }}
              className={`
                relative p-4 rounded-lg border-2 transition-all text-left
                hover:scale-105 hover:shadow-lg
                ${selectedTheme === key
                  ? 'border-primary shadow-md'
                  : 'border-border hover:border-primary/50'
                }
              `}
              data-testid={`button-theme-${key}`}
            >
              <div className="flex items-start gap-3">
                {theme.icon ? (
                  <img
                    src={theme.icon}
                    alt={theme.name}
                    className="w-12 h-12 rounded-md shrink-0 object-cover"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-md shrink-0"
                    style={{ backgroundColor: theme.brand.hex }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm mb-1">{theme.name}</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    {theme.description}
                  </p>
                  <div className="text-xs font-mono text-muted-foreground">
                    {theme.brand.hex}
                  </div>
                </div>
              </div>
              {selectedTheme === key && (
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-primary-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
