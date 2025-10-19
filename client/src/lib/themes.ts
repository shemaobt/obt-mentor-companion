/**
 * Color Theme Configuration
 * 
 * Define your color schemes here. Each theme includes light and dark mode variants.
 * The brand color is automatically converted to HSL format for CSS variables.
 */

export interface ColorTheme {
  name: string;
  description: string;
  brand: {
    hex: string;        // Main brand color in hex
    rgb: string;        // RGB values
    hsl: string;        // HSL values (hue, saturation, lightness)
  };
}

export const themes: Record<string, ColorTheme> = {
  // Current olive-green theme
  olive: {
    name: "Olive Green",
    description: "Current YWAM OBT brand color",
    brand: {
      hex: "#86884C",
      rgb: "134, 136, 76",
      hsl: "62, 28%, 42%",
    },
  },

  // Example alternative themes (add your own here)
  blue: {
    name: "Ocean Blue",
    description: "Professional blue tone",
    brand: {
      hex: "#3B82F6",
      rgb: "59, 130, 246",
      hsl: "217, 91%, 60%",
    },
  },

  teal: {
    name: "Teal",
    description: "Modern teal accent",
    brand: {
      hex: "#14B8A6",
      rgb: "20, 184, 166",
      hsl: "173, 80%, 40%",
    },
  },

  purple: {
    name: "Royal Purple",
    description: "Elegant purple theme",
    brand: {
      hex: "#8B5CF6",
      rgb: "139, 92, 246",
      hsl: "258, 90%, 66%",
    },
  },

  emerald: {
    name: "Emerald",
    description: "Fresh green tone",
    brand: {
      hex: "#10B981",
      rgb: "16, 185, 129",
      hsl: "160, 84%, 39%",
    },
  },
};

// Set the active theme here - change this to switch themes globally
export const ACTIVE_THEME: keyof typeof themes = "olive";

export function getActiveTheme(): ColorTheme {
  return themes[ACTIVE_THEME];
}

/**
 * Convert hex to HSL format
 * Helper function if you want to add new colors by hex only
 */
export function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return `${h}, ${s}%, ${l}%`;
}
