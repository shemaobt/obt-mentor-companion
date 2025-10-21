import { useTheme } from '@/contexts/ThemeContext';
import { themes } from '@/lib/themes';

interface LogoWithBackgroundProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  rounded?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8 p-1.5',
  md: 'w-12 h-12 p-2',
  lg: 'w-16 h-16 p-3',
  xl: 'w-24 h-24 p-4',
};

export default function LogoWithBackground({ 
  size = 'md', 
  className = '',
  rounded = true 
}: LogoWithBackgroundProps) {
  const { currentTheme } = useTheme();
  const theme = themes[currentTheme] || themes.verdeClaro;
  
  return (
    <div 
      className={`${sizeClasses[size]} ${rounded ? 'rounded-lg' : ''} ${className}`}
      style={{ backgroundColor: theme.brand.hex }}
    >
      <img 
        src="/logo.png" 
        alt="OBT Mentor" 
        className="w-full h-full object-contain"
      />
    </div>
  );
}
