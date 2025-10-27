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
    
    console.log('[TranslateWidget] Attempting to translate to:', langCode);
    
    // Persistent polling - keep trying until Google Translate is ready
    const pollAndTranslate = () => {
      const googleTranslateElement = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      
      if (googleTranslateElement) {
        // Google Translate is ready, trigger the translation
        console.log('[TranslateWidget] Google Translate element found, triggering translation');
        console.log('[TranslateWidget] Current value:', googleTranslateElement.value);
        console.log('[TranslateWidget] Setting to:', langCode);
        
        googleTranslateElement.value = langCode;
        
        // Trigger change event with bubbles - Google Translate requires this
        const changeEvent = new Event('change', { bubbles: true });
        googleTranslateElement.dispatchEvent(changeEvent);
        
        console.log('[TranslateWidget] Event dispatched, new value:', googleTranslateElement.value);
        setPendingLang(null);
        return;
      }
      
      // Not ready yet, store the pending language and try again
      console.log('[TranslateWidget] Google Translate not ready, polling...');
      setPendingLang(langCode);
      setTimeout(pollAndTranslate, 100);
    };
    
    pollAndTranslate();
  };

  useEffect(() => {
    console.log('[TranslateWidget] Component mounted, initializing Google Translate...');
    
    // Initialize Google Translate once the component mounts
    const initGoogleTranslate = () => {
      const win = window as any;
      
      // Check if Google Translate script is loaded
      if (typeof win.google === 'undefined' || typeof win.google.translate === 'undefined') {
        console.log('[TranslateWidget] Google Translate script not loaded yet, retrying...');
        setTimeout(initGoogleTranslate, 100);
        return;
      }
      
      // Check if element exists
      const element = document.getElementById('google_translate_element');
      if (!element) {
        console.log('[TranslateWidget] Element not found, retrying...');
        setTimeout(initGoogleTranslate, 100);
        return;
      }
      
      // Check if already initialized (has children)
      if (element.children.length > 0) {
        console.log('[TranslateWidget] Google Translate already initialized');
        setIsGoogleReady(true);
        return;
      }
      
      console.log('[TranslateWidget] Initializing Google Translate widget...');
      try {
        new win.google.translate.TranslateElement({
          pageLanguage: 'en',
          includedLanguages: 'en,pt,es,fr,de,it,zh-CN,zh-TW,ja,ko,ar,hi,ru,tr',
          layout: win.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false
        }, 'google_translate_element');
        console.log('[GoogleTranslate] Widget initialized, waiting for combo element...');
        
        // Wait for the combo element to appear
        const checkCombo = setInterval(() => {
          const combo = document.querySelector('.goog-te-combo');
          if (combo) {
            console.log('[TranslateWidget] Google Translate is ready!');
            setIsGoogleReady(true);
            clearInterval(checkCombo);
            
            // If there's a pending language selection, apply it now
            if (pendingLang) {
              console.log('[TranslateWidget] Applying pending language:', pendingLang);
              const googleTranslateElement = combo as HTMLSelectElement;
              googleTranslateElement.value = pendingLang;
              const changeEvent = new Event('change', { bubbles: true });
              googleTranslateElement.dispatchEvent(changeEvent);
              setPendingLang(null);
            }
          }
        }, 100);
        
      } catch (error) {
        console.error('[TranslateWidget] Error initializing Google Translate:', error);
      }
    };
    
    // Start initialization
    initGoogleTranslate();
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
