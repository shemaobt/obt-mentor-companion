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

export function TranslateWidget() {
  const [selectedLang, setSelectedLang] = useState('');

  const doGoogleLanguageTranslator = (langCode: string) => {
    const translateFrame = document.querySelector('.goog-te-menu-frame') as HTMLIFrameElement;
    if (!translateFrame || !translateFrame.contentWindow) {
      console.log('[Translate] Frame not ready, retrying...');
      setTimeout(() => doGoogleLanguageTranslator(langCode), 100);
      return;
    }

    const innerDoc = translateFrame.contentWindow.document;
    const langLink = innerDoc.querySelector(`a.goog-te-menu2-item span.text:contains('${langCode}')`)?.parentElement as HTMLElement;
    
    if (!langLink) {
      // Fallback: try direct combo approach
      const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (combo) {
        combo.value = langCode;
        combo.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      langLink.click();
    }
  };

  const translatePage = (langCode: string) => {
    setSelectedLang(langCode);
    
    const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement;
    if (combo) {
      combo.value = langCode;
      combo.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Widget not ready, try triggering initialization
      setTimeout(() => translatePage(langCode), 100);
    }
  };

  useEffect(() => {
    // Initialize widget on mount
    const initWidget = () => {
      const win = window as any;
      if (typeof win.google?.translate?.TranslateElement === 'undefined') {
        setTimeout(initWidget, 100);
        return;
      }

      const element = document.getElementById('google_translate_element');
      if (!element || element.children.length > 0) {
        return; // Already initialized
      }

      try {
        new win.google.translate.TranslateElement({
          pageLanguage: 'en',
          includedLanguages: 'en,pt,es,fr,de,it,zh-CN,zh-TW,ja,ko,ar,hi,ru,tr',
          layout: win.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false
        }, 'google_translate_element');
      } catch (e) {
        console.error('Translation init error:', e);
      }
    };

    initWidget();
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
    </div>
  );
}
