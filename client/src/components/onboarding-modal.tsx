import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import slide1 from "@assets/1762796336130-c65bcd86-ddc9-4482-8e40-bbc241fc8994_1_1762796472412.jpg";
import slide2 from "@assets/1762796336130-c65bcd86-ddc9-4482-8e40-bbc241fc8994_2_1762796472412.jpg";
import slide3 from "@assets/1762796336130-c65bcd86-ddc9-4482-8e40-bbc241fc8994_3_1762796472412.jpg";
import slide4 from "@assets/1762796336130-c65bcd86-ddc9-4482-8e40-bbc241fc8994_4_1762796472412.jpg";
import slide5 from "@assets/1762796336130-c65bcd86-ddc9-4482-8e40-bbc241fc8994_5_1762796472412.jpg";
import slide6 from "@assets/1762796336130-c65bcd86-ddc9-4482-8e40-bbc241fc8994_6_1762796472412.jpg";
import slide7 from "@assets/1762796336130-c65bcd86-ddc9-4482-8e40-bbc241fc8994_7_1762796472412.jpg";
import slide8 from "@assets/1762796336130-c65bcd86-ddc9-4482-8e40-bbc241fc8994_8_1762796472412.jpg";
import slide9 from "@assets/1762796336130-c65bcd86-ddc9-4482-8e40-bbc241fc8994_9_1762796472412.jpg";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [slide1, slide2, slide3, slide4, slide5, slide6, slide7, slide8, slide9];

  const goToNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const goToPrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleClose = () => {
    setCurrentSlide(0);
    onClose();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      handleClose();
    }
  };

  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden border-none" data-testid="dialog-onboarding">
        <DialogTitle className="sr-only">OBT Mentor Companion Onboarding</DialogTitle>
        <DialogDescription className="sr-only">
          Welcome to OBT Mentor Companion. Navigate through the presentation slides to learn about the program.
        </DialogDescription>
        <div className="flex flex-col">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 bg-background/80 hover:bg-background/90 rounded-full"
            data-testid="button-close-onboarding"
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Slide Image */}
          <div className="w-full bg-black" data-testid="slide-content">
            <img
              src={slides[currentSlide]}
              alt={`Slide ${currentSlide + 1}`}
              className="w-full h-auto"
              data-testid={`slide-image-${currentSlide + 1}`}
            />
          </div>

          {/* Navigation Menu Bar */}
          <div className="bg-background border-t p-4">
            <div className="flex items-center justify-between">
              {/* Previous Button */}
              <Button
                variant="outline"
                onClick={goToPrevious}
                disabled={currentSlide === 0}
                data-testid="button-previous-slide"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              {/* Page Indicator */}
              <div className="text-sm font-medium text-muted-foreground" data-testid="text-slide-indicator">
                {currentSlide + 1} / {slides.length}
              </div>

              {/* Next/Finish Button */}
              {isLastSlide ? (
                <Button
                  onClick={handleClose}
                  className="bg-[#86884C] hover:bg-[#86884C]/90"
                  data-testid="button-get-started"
                >
                  Get Started
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={goToNext}
                  data-testid="button-next-slide"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
