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

  const changeLang = (langCode: string) => {
    setSelectedLang(langCode);
    
    // Direct approach: find and click the select
    const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
    if (select) {
      select.value = langCode;
      select.dispatchEvent(new Event('change'));
    }
  };

  useEffect(() => {
    // Initialize Google Translate when component mounts
    let attempts = 0;
    const maxAttempts = 50;
    
    const init = () => {
      attempts++;
      
      const w = window as any;
      if (!w.google?.translate?.TranslateElement) {
        if (attempts < maxAttempts) {
          setTimeout(init, 100);
        }
        return;
      }
      
      const el = document.getElementById('google_translate_element');
      if (!el) {
        if (attempts < maxAttempts) {
          setTimeout(init, 100);
        }
        return;
      }
      
      if (el.childElementCount === 0) {
        try {
          new w.google.translate.TranslateElement({
            pageLanguage: 'en',
            includedLanguages: 'en,pt,es,fr,de,it,zh-CN,zh-TW,ja,ko,ar,hi,ru,tr',
            layout: w.google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false
          }, 'google_translate_element');
        } catch (e) {
          // Ignore errors
        }
      }
    };
    
    setTimeout(init, 500);
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
              onClick={() => changeLang(lang.code)}
              className={selectedLang === lang.code ? 'bg-accent' : ''}
              data-testid={`menu-item-lang-${lang.code || 'en'}`}
            >
              {lang.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <div id="google_translate_element" className="hidden" data-testid="translate-widget"></div>
    </div>
  );
}
