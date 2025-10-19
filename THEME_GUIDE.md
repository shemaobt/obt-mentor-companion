# Color Theme System

## Quick Start Guide

Your OBT Mentor Companion now has an easy-to-use color theming system! You can switch between different color schemes instantly.

### How to Switch Themes

1. **Using the UI** (Easiest):
   - Click on your user profile at the bottom of the sidebar
   - Click the "Theme" button with the paint palette icon
   - Choose from the available color schemes
   - Your selection is saved automatically!

2. **Setting a Default Theme** (For the whole app):
   - Open `client/src/lib/themes.ts`
   - Change the `ACTIVE_THEME` constant to your preferred theme:
   ```typescript
   export const ACTIVE_THEME: keyof typeof themes = "olive"; // Change this!
   ```

### Available Themes

1. **Olive Green** (`olive`) - Current YWAM OBT brand color
   - Hex: #86884C
   - HSL: 62, 28%, 42%

2. **Ocean Blue** (`blue`) - Professional blue tone
   - Hex: #3B82F6
   - HSL: 217, 91%, 60%

3. **Teal** (`teal`) - Modern teal accent
   - Hex: #14B8A6
   - HSL: 173, 80%, 40%

4. **Royal Purple** (`purple`) - Elegant purple theme
   - Hex: #8B5CF6
   - HSL: 258, 90%, 66%

5. **Emerald** (`emerald`) - Fresh green tone
   - Hex: #10B981
   - HSL: 160, 84%, 39%

## Adding Your Own Custom Theme

Want to add a new color? It's easy!

1. Open `client/src/lib/themes.ts`

2. Add your new theme to the `themes` object:

```typescript
export const themes: Record<string, ColorTheme> = {
  // ... existing themes ...
  
  myCustomTheme: {
    name: "My Custom Theme",
    description: "My team's brand color",
    brand: {
      hex: "#FF5733",           // Your color in hex
      rgb: "255, 87, 51",       // RGB values
      hsl: "10, 100%, 60%",     // HSL values (use the hexToHSL helper if needed)
    },
  },
};
```

3. Save the file and your new theme will appear in the theme switcher!

### Need Help Converting Hex to HSL?

Use the built-in helper function:

```typescript
import { hexToHSL } from '@/lib/themes';

const hsl = hexToHSL("#FF5733");  // Returns "10, 100%, 60%"
```

## Showing Themes to Your Team

1. Click on your profile → "Theme" button
2. Each theme shows:
   - Color preview
   - Theme name and description
   - Hex code
3. Click any theme to preview it instantly
4. Your team can see the changes in real-time!

## What Changes When You Switch Themes?

The theme system updates all these UI elements:
- ✅ Primary buttons and links
- ✅ Sidebar accent colors
- ✅ Focus rings and borders
- ✅ Charts and data visualizations
- ✅ Progress indicators
- ✅ Active states and highlights
- ✅ Both light and dark modes

## Technical Details

The theme system works by:
1. Storing theme configurations in `client/src/lib/themes.ts`
2. Dynamically updating CSS variables when themes are switched
3. Persisting your choice in browser localStorage
4. Automatically applying the saved theme on page load

All color variations (lighter/darker shades) are automatically calculated from your brand color!
