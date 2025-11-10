import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "OBT MENTOR COMPANION",
      subtitle: "Created by Marcia Suzuki • Presented by Luciano Duarte",
      content: (
        <div className="text-center space-y-6">
          <div className="flex justify-center mb-8">
            <div className="w-32 h-32 rounded-full bg-[#86884C] flex items-center justify-center text-white text-4xl font-bold">
              OBT
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#86884C]">
            EQUIPPING QUALITY ASSURANCE (QA) MENTORS
          </h3>
          <p className="text-lg text-muted-foreground">
            TO MEET THE RAPID GROWTH OF THE OBT MOVEMENT
          </p>
        </div>
      ),
    },
    {
      title: "ALL ORGANIZATIONS ARE WORKING HARD",
      content: (
        <div className="space-y-6">
          <p className="text-lg font-semibold text-center">
            All organizations are working hard to train consultants and to build capacity
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-muted/50 p-6 rounded-lg">
              <h4 className="font-bold text-[#86884C] mb-3">MALI BT</h4>
              <p className="text-sm">
                M.A. in Applied Linguistics for Bible Translation
              </p>
              <p className="text-2xl font-bold mt-2">45 graduates</p>
            </div>
            <div className="bg-muted/50 p-6 rounded-lg">
              <h4 className="font-bold text-[#86884C] mb-3">MALI CT</h4>
              <p className="text-sm">
                Consultant Training: mentored pathway for MALI BT alumni
              </p>
              <p className="text-lg mt-2">
                <span className="font-bold">16 completed</span> • 23 waiting
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "THE CHALLENGE & OPPORTUNITY",
      content: (
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500 p-6 rounded">
            <p className="text-lg font-semibold">
              OBT initiatives are multiplying MUCH FASTER than qualified QA mentors
            </p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-500 p-6 rounded">
            <p className="text-lg">
              Existing agency-centric training pipelines can't keep up.
            </p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/20 border-l-4 border-orange-500 p-6 rounded">
            <p className="text-lg font-semibold">KEY RISK:</p>
            <p>Inconsistent translation quality, over-stretched consultants</p>
          </div>
        </div>
      ),
    },
    {
      title: "WHY A PARADIGM SHIFT?",
      content: (
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-950/20 p-6 rounded-lg border-2 border-red-300">
            <h4 className="font-bold text-red-700 dark:text-red-400 mb-2">
              ❌ Agency-led model = bottleneck
            </h4>
            <p className="text-muted-foreground">
              Limited trainers, fixed intake cycles
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/20 p-6 rounded-lg border-2 border-green-300">
            <h4 className="font-bold text-green-700 dark:text-green-400 mb-2">
              ✅ Learner-led model = scalable
            </h4>
            <p className="text-muted-foreground">
              Competence-based progression on demand
            </p>
          </div>
          <div className="bg-[#86884C]/10 p-6 rounded-lg border-2 border-[#86884C]">
            <p className="font-semibold text-lg">
              <strong>Vision:</strong> Those preparing to mentor take the lead in their own learning, 
              while agencies come alongside to confirm readiness.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "INTRODUCING THE OBT MENTOR COMPANION",
      subtitle: "A self-paced pathway to QA competence that blends practice, hands-on resources, mentorship, and adaptive technology",
      content: (
        <div className="space-y-4">
          <div className="bg-muted/50 p-5 rounded-lg">
            <h4 className="font-bold text-[#86884C] mb-2 flex items-center gap-2">
              📖 INTERACTIVE PRINT MANUAL
            </h4>
            <p className="text-sm mb-2">Sturdy field manual embedded with QR codes.</p>
            <p className="text-sm text-muted-foreground">
              Scan to unlock short videos, lectures, podcasts, infographics, and downloadable tools 
              designed for multimodal, flexible, real-time learning.
            </p>
          </div>
          <div className="bg-muted/50 p-5 rounded-lg">
            <h4 className="font-bold text-[#86884C] mb-3 flex items-center gap-2">
              🤖 AI-POWERED CONVERSATIONAL COACH
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <strong>Personalised roadmap</strong> – answers your questions and recommends 
                targeted courses, workshops, and readings as you progress.
              </li>
              <li>
                <strong>Instant session feedback</strong> – analyses your recorded mentoring sessions 
                and highlights strengths and growth areas.
              </li>
              <li>
                <strong>Quarterly progress briefs</strong> – generates clear three-month reports 
                reviewed by senior consultants, who confirm competencies and advise next steps.
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: "BENEFITS ACROSS THE BIBLE TRANSLATION ECOSYSTEM",
      content: (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/20 p-5 rounded-lg border-l-4 border-blue-500">
            <h4 className="font-bold mb-2">👤 Learner</h4>
            <p className="text-sm">Reduced dependence on agencies, clearer milestones</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/20 p-5 rounded-lg border-l-4 border-purple-500">
            <h4 className="font-bold mb-2">🏢 Agencies</h4>
            <p className="text-sm">Larger pool of vetted mentors without added staff load</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/20 p-5 rounded-lg border-l-4 border-green-500">
            <h4 className="font-bold mb-2">👨‍💼 Consultants</h4>
            <p className="text-sm">Focus on high-level review, not basic skill transfer</p>
          </div>
          <div className="bg-[#86884C]/10 p-5 rounded-lg border-l-4 border-[#86884C]">
            <h4 className="font-bold mb-2">👥 OBT Teams</h4>
            <p className="text-sm">Consistent, context-aware QA support</p>
          </div>
        </div>
      ),
    },
    {
      title: "AI-ASSISTED RESOURCES ALREADY IN USE",
      content: (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-muted/50 p-5 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-[#86884C] flex items-center justify-center text-white mb-3">
              💬
            </div>
            <p className="text-sm">
              Assists during the conversational exegesis by telling stories, facilitating dialogues, 
              providing images and checking back translations.
            </p>
          </div>
          <div className="bg-muted/50 p-5 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-[#86884C] flex items-center justify-center text-white mb-3">
              🎤
            </div>
            <p className="text-sm">
              Assists oral translators in the internalization process by creating front oral versions 
              of the biblical passages.
            </p>
          </div>
          <div className="bg-muted/50 p-5 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-[#86884C] flex items-center justify-center text-white mb-3">
              📋
            </div>
            <p className="text-sm">
              Assists the teams in the production of the translation brief by asking questions and 
              organizing the responses.
            </p>
          </div>
          <div className="bg-muted/50 p-5 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-[#86884C] flex items-center justify-center text-white mb-3">
              🔗
            </div>
            <p className="text-sm">
              Uses Thinglink to provide interactive AR experiences and embedded learning tools for 
              training translation teams.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "INVITATION TO COLLABORATE",
      content: (
        <div className="space-y-6">
          <div className="bg-[#86884C]/10 p-6 rounded-lg border-2 border-[#86884C]">
            <p className="text-lg mb-2">
              A pilot will be launched <strong>Q4 2025</strong>, focusing on OBT team members from 
              Brazil, PNG, the US, Mozambique, and East Timor who want to grow into QA mentoring.
            </p>
            <p className="text-sm text-muted-foreground">Open to any organization.</p>
          </div>
          <div className="space-y-3">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="font-semibold">🤝 Field Partners</p>
              <p className="text-sm text-muted-foreground">
                Contribute with content, case studies & language data
              </p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="font-semibold">📊 Review Panel</p>
              <p className="text-sm text-muted-foreground">
                Help shape global QA competency standards
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "GET STARTED",
      content: (
        <div className="text-center space-y-6">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-[#86884C] flex items-center justify-center text-white text-3xl">
              ✓
            </div>
          </div>
          <h3 className="text-2xl font-bold">You're all set!</h3>
          <p className="text-lg text-muted-foreground">
            Start your journey with the OBT Mentor Companion
          </p>
          <div className="bg-muted/50 p-6 rounded-lg space-y-2">
            <p className="font-semibold">Contact Information:</p>
            <p className="text-sm">🌐 www.shemaywam.com</p>
            <p className="text-sm">✉️ marcia.suzuki@uofn.edu</p>
          </div>
        </div>
      ),
    },
  ];

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

  const currentSlideData = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden" data-testid="dialog-onboarding">
        <div className="relative h-full">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute top-4 right-4 z-10"
            data-testid="button-close-onboarding"
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Content */}
          <div className="p-8 pb-20 overflow-y-auto max-h-[80vh]">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-foreground mb-2" data-testid="text-slide-title">
                {currentSlideData.title}
              </h2>
              {currentSlideData.subtitle && (
                <p className="text-sm text-muted-foreground" data-testid="text-slide-subtitle">
                  {currentSlideData.subtitle}
                </p>
              )}
            </div>
            <div data-testid="slide-content">{currentSlideData.content}</div>
          </div>

          {/* Navigation Footer */}
          <div className="absolute bottom-0 left-0 right-0 bg-background border-t p-4">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
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
              <div className="text-sm text-muted-foreground" data-testid="text-slide-indicator">
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
