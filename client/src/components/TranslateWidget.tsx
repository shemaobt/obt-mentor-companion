import { useEffect } from "react";
import { Languages } from "lucide-react";

export function TranslateWidget() {
  useEffect(() => {
    const checkForTranslateElement = setInterval(() => {
      const translateElement = document.getElementById('google_translate_element');
      if (translateElement && translateElement.children.length > 0) {
        clearInterval(checkForTranslateElement);
      }
    }, 100);

    return () => clearInterval(checkForTranslateElement);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-2">
        <Languages className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Translate</span>
      </div>
      <div 
        id="google_translate_element" 
        className="translate-widget-container"
        data-testid="translate-widget"
      ></div>
    </div>
  );
}
