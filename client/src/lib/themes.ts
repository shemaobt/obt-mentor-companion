/**
 * Color Theme Configuration
 * 
 * Define your color schemes here. Each theme includes light and dark mode variants.
 * The brand color is automatically converted to HSL format for CSS variables.
 * Last updated: 2025-10-19
 */

export interface ColorTheme {
  name: string;
  description: string;
  icon?: string;      // Path to theme icon
  brand: {
    hex: string;        // Main brand color in hex
    rgb: string;        // RGB values
    hsl: string;        // HSL values (hue, saturation, lightness)
  };
}

export const themes: Record<string, ColorTheme> = {
  areia: {
    name: "Sand",
    description: "Sandy beige tone",
    icon: "/logo-areia.png",
    brand: {
      hex: "#C5C29F",
      rgb: "197, 194, 159",
      hsl: "55, 25%, 70%",
    },
  },

  azul: {
    name: "Blue",
    description: "Soft blue-teal",
    icon: "/logo-azul.png",
    brand: {
      hex: "#89AAA3",
      rgb: "137, 170, 163",
      hsl: "167, 16%, 60%",
    },
  },

  telha: {
    name: "Terracotta",
    description: "Warm terracotta orange",
    icon: "/logo-telha.png",
    brand: {
      hex: "#BE4A01",
      rgb: "190, 74, 1",
      hsl: "23, 99%, 37%",
    },
  },

  verdeClaro: {
    name: "Light Green",
    description: "Light olive green",
    icon: "/logo-verde.png",
    brand: {
      hex: "#777D45",
      rgb: "119, 125, 69",
      hsl: "66, 29%, 38%",
    },
  },

  verde: {
    name: "Green",
    description: "Dark forest green",
    icon: "/logo-verde.png",
    brand: {
      hex: "#3F3E20",
      rgb: "63, 62, 32",
      hsl: "58, 33%, 19%",
    },
  },

  preto: {
    name: "Black",
    description: "Deep charcoal black",
    icon: "/logo-preto.png",
    brand: {
      hex: "#0A0703",
      rgb: "10, 7, 3",
      hsl: "34, 54%, 3%",
    },
  },
};

// Set the active theme here - change this to switch themes globally
export const ACTIVE_THEME: keyof typeof themes = "verdeClaro";

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
