import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Sidebar from "@/components/sidebar";
import { Download, Copy, Check, Menu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function QRCodePage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [appUrl] = useState("https://obtmentor.org");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        appUrl,
        {
          width: 300,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        },
        (error) => {
          if (error) {
            console.error("Error generating QR code:", error);
          }
        }
      );
    }
  }, [appUrl]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = "obtmentor-qr-code.png";
      link.href = url;
      link.click();
      
      toast({
        title: "QR Code Downloaded",
        description: "The QR code has been saved to your device",
      });
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    
    toast({
      title: "URL Copied",
      description: "App URL copied to clipboard",
    });
    
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen bg-background flex relative overflow-hidden" data-testid="page-qr-code">
      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 2xl:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        ${isMobile 
          ? `fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } w-4/5 max-w-sm`
          : 'h-screen w-80'
        }
      `}>
        <Sidebar 
          isMobile={isMobile}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
      
      <div className={`flex-1 h-screen overflow-y-auto ${isMobile ? 'p-4' : 'p-8'}`}>
        <div className={`${isMobile ? 'max-w-full' : 'max-w-2xl'} mx-auto`}>
          {/* Header */}
          <div className={`${isMobile ? 'mb-6' : 'mb-8'}`}>
            <div className="flex items-start gap-3">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="mt-1 flex-shrink-0"
                  data-testid="button-open-sidebar"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="flex-1">
                <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`} data-testid="text-page-title">
                  App QR Code
                </h1>
                <p className={`text-muted-foreground mt-2 ${isMobile ? 'text-sm' : ''}`} data-testid="text-page-description">
                  Share this app with others by scanning the QR code
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle data-testid="text-card-title">App QR Code</CardTitle>
              <CardDescription data-testid="text-card-description">
                Scan this code to open OBT Mentor Companion on any device
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-6">
              {/* QR Code Display */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <canvas
                  ref={canvasRef}
                  data-testid="canvas-qr-code"
                  className="max-w-full h-auto"
                />
              </div>

              {/* App URL */}
              <div className="w-full space-y-2">
                <Label htmlFor="app-url">App URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="app-url"
                    value={appUrl}
                    readOnly
                    className="flex-1"
                    data-testid="input-app-url"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyUrl}
                    data-testid="button-copy-url"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Download Button */}
              <Button
                onClick={handleDownload}
                className="w-full bg-[#86884C] hover:bg-[#86884C]/90"
                size="lg"
                data-testid="button-download-qr-code"
              >
                <Download className="h-4 w-4 mr-2" />
                Download QR Code
              </Button>

              {/* Instructions */}
              <div className="w-full pt-4 border-t border-border">
                <h4 className="font-medium mb-2">How to use:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Open your camera app or QR code scanner</li>
                  <li>Point it at the QR code above</li>
                  <li>Tap the notification to open the app</li>
                  <li>Or download the QR code and share it anywhere</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
