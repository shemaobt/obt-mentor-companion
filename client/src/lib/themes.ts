/**
 * Color Theme Configuration
 * 
 * Define your color schemes here. Each theme includes light and dark mode variants.
 * The brand color is automatically converted to HSL format for CSS variables.
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
    name: "Areia",
    description: "Sandy beige tone",
    icon: "/attached_assets/ÍCONE - areia.s_1760906854630.png",
    brand: {
      hex: "#C5C29F",
      rgb: "197, 194, 159",
      hsl: "55, 25%, 70%",
    },
  },

  azul: {
    name: "Azul",
    description: "Soft blue-teal",
    icon: "/attached_assets/ÍCONE - azul_1760906854630.png",
    brand: {
      hex: "#89AAA3",
      rgb: "137, 170, 163",
      hsl: "167, 16%, 60%",
    },
  },

  telha: {
    name: "Telha",
    description: "Terracotta orange",
    icon: "/attached_assets/ÍCONE - telha_1760906854630.png",
    brand: {
      hex: "#BE4A01",
      rgb: "190, 74, 1",
      hsl: "23, 99%, 37%",
    },
  },

  verdeClaro: {
    name: "Verde Claro",
    description: "Light olive green",
    icon: "/attached_assets/ÍCONE - verde claro_1760906854630.png",
    brand: {
      hex: "#777D45",
      rgb: "119, 125, 69",
      hsl: "66, 29%, 38%",
    },
  },

  verde: {
    name: "Verde",
    description: "Dark forest green",
    icon: "/attached_assets/ÍCONE - verde_1760906854630.png",
    brand: {
      hex: "#3F3E20",
      rgb: "63, 62, 32",
      hsl: "58, 33%, 19%",
    },
  },

  preto: {
    name: "Preto",
    description: "Deep charcoal",
    icon: "/attached_assets/ÍCONE - preto_1760906854630.png",
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
