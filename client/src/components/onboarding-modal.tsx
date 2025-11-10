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
      <DialogContent className="max-w-5xl p-0 overflow-hidden bg-transparent border-none" data-testid="dialog-onboarding">
        <DialogTitle className="sr-only">OBT Mentor Companion Onboarding</DialogTitle>
        <DialogDescription className="sr-only">
          Welcome to OBT Mentor Companion. Navigate through the presentation slides to learn about the program.
        </DialogDescription>
        <div className="relative">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
            data-testid="button-close-onboarding"
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Slide Image */}
          <div className="w-full" data-testid="slide-content">
            <img
              src={slides[currentSlide]}
              alt={`Slide ${currentSlide + 1}`}
              className="w-full h-auto rounded-lg"
              data-testid={`slide-image-${currentSlide + 1}`}
            />
          </div>

          {/* Navigation Footer */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm p-4">
            <div className="flex items-center justify-between max-w-5xl mx-auto">
              {/* Previous Button */}
              <Button
                variant="ghost"
                onClick={goToPrevious}
                disabled={currentSlide === 0}
                className="text-white hover:bg-white/20 disabled:opacity-50"
                data-testid="button-previous-slide"
              >
                <ChevronLeft className="h-5 w-5 mr-1" />
                Previous
              </Button>

              {/* Page Indicator */}
              <div className="text-sm text-white font-medium" data-testid="text-slide-indicator">
                {currentSlide + 1} / {slides.length}
              </div>

              {/* Next/Finish Button */}
              {isLastSlide ? (
                <Button
                  onClick={handleClose}
                  className="bg-[#86884C] hover:bg-[#86884C]/90 text-white"
                  data-testid="button-get-started"
                >
                  Get Started
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={goToNext}
                  className="text-white hover:bg-white/20"
                  data-testid="button-next-slide"
                >
                  Next
                  <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
