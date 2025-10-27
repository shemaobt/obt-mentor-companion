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
  { code: '', name: 'English' },
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

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
  }
}

export function TranslateWidget() {
  const [selectedLang, setSelectedLang] = useState('');
  const [isReady, setIsReady] = useState(false);

  const translatePage = (langCode: string) => {
    console.log('[TranslateWidget] Translate to:', langCode);
    setSelectedLang(langCode);
    
    const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
    if (select) {
      console.log('[TranslateWidget] Select element found, changing value from', select.value, 'to', langCode);
      select.value = langCode;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[TranslateWidget] Change event dispatched');
    } else {
      console.warn('[TranslateWidget] Google Translate select not found!');
    }
  };

  useEffect(() => {
    console.log('[TranslateWidget] Component mounted');
    
    const initTranslate = () => {
      console.log('[TranslateWidget] Checking for Google Translate...');
      
      if (typeof window.google === 'undefined' || !window.google.translate) {
        console.log('[TranslateWidget] Google not available yet, retrying...');
        setTimeout(initTranslate, 200);
        return;
      }
      
      const element = document.getElementById('google_translate_element');
      if (!element) {
        console.log('[TranslateWidget] Element not in DOM yet, retrying...');
        setTimeout(initTranslate, 200);
        return;
      }
      
      if (element.childElementCount > 0) {
        console.log('[TranslateWidget] Already initialized');
        setIsReady(true);
        return;
      }
      
      console.log('[TranslateWidget] Initializing Google Translate widget...');
      
      try {
        new window.google.translate.TranslateElement({
          pageLanguage: 'en',
          includedLanguages: 'en,pt,es,fr,de,it,zh-CN,zh-TW,ja,ko,ar,hi,ru,tr',
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false
        }, 'google_translate_element');
        
        console.log('[TranslateWidget] Widget created, waiting for select...');
        
        // Wait for the select element to appear
        const waitForSelect = setInterval(() => {
          const select = document.querySelector('.goog-te-combo');
          if (select) {
            console.log('[TranslateWidget] Select element ready!');
            setIsReady(true);
            clearInterval(waitForSelect);
          }
        }, 100);
        
      } catch (error) {
        console.error('[TranslateWidget] Error initializing:', error);
      }
    };
    
    // Start initialization with a small delay to ensure DOM is ready
    const timeout = setTimeout(initTranslate, 100);
    
    return () => clearTimeout(timeout);
  }, []);

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
              key={lang.code || 'en'}
              onClick={() => translatePage(lang.code)}
              className={selectedLang === lang.code ? 'bg-accent' : ''}
              data-testid={`menu-item-lang-${lang.code || 'en'}`}
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
      
      {/* Debug info */}
      {!isReady && (
        <div className="text-xs text-muted-foreground mt-1 px-2">
          Loading translator...
        </div>
      )}
    </div>
  );
}
