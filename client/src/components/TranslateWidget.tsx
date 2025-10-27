import { useEffect, useState } from "react";
import { Languages, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const languages = [
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'zh-CN', name: '中文 (简体)' },
  { code: 'zh-TW', name: '中文 (繁體)' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'ru', name: 'Русский' },
  { code: 'tr', name: 'Türkçe' },
];

export function TranslateWidget() {
  const [selectedLang, setSelectedLang] = useState('en');
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [pendingLang, setPendingLang] = useState<string | null>(null);

  const translatePage = (langCode: string) => {
    setSelectedLang(langCode);
    
    // Persistent polling - keep trying until Google Translate is ready
    const pollAndTranslate = () => {
      const googleTranslateElement = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      
      if (googleTranslateElement) {
        // Google Translate is ready, trigger the translation
        googleTranslateElement.value = langCode;
        googleTranslateElement.dispatchEvent(new Event('change'));
        setPendingLang(null);
        return;
      }
      
      // Not ready yet, store the pending language and try again
      setPendingLang(langCode);
      setTimeout(pollAndTranslate, 100);
    };
    
    pollAndTranslate();
  };

  useEffect(() => {
    // Monitor Google Translate initialization status
    const checkInterval = setInterval(() => {
      const combo = document.querySelector('.goog-te-combo');
      if (combo) {
        setIsGoogleReady(true);
        clearInterval(checkInterval);
        
        // If there's a pending language selection, apply it now
        if (pendingLang) {
          const googleTranslateElement = combo as HTMLSelectElement;
          googleTranslateElement.value = pendingLang;
          googleTranslateElement.dispatchEvent(new Event('change'));
          setPendingLang(null);
        }
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, [pendingLang]);

  return (
    <div className="px-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between text-sm"
            data-testid="button-translate"
          >
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              <span>Select your language</span>
            </div>
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => translatePage(lang.code)}
              className={selectedLang === lang.code ? 'bg-accent' : ''}
              data-testid={`menu-item-lang-${lang.code}`}
            >
              {lang.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Hidden Google Translate element */}
      <div 
        id="google_translate_element" 
        className="hidden"
        data-testid="translate-widget"
      ></div>
    </div>
  );
}
