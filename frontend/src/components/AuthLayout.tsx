import type { ReactNode } from "react";

const logoImage = "/logo-white.png";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand gradient (desktop only) */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden bg-gradient-to-br from-stone-900 via-[hsl(62,20%,18%)] to-[hsl(62,28%,22%)]">
        <div
          className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(62 28% 42%), transparent 70%)" }}
        />
        <div
          className="absolute -bottom-20 right-1/4 w-[400px] h-[400px] rounded-full opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(62 35% 65%), transparent 70%)" }}
        />

        <div className="relative mt-auto p-12 pb-14 w-full">
          <div className="flex items-center gap-3.5 mb-5">
            <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <img src={logoImage} alt="OBT Mentor" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <p className="text-white font-semibold text-xl tracking-tight">OBT Mentor Companion</p>
              <p className="text-white/40 text-xs tracking-wide">by Shema</p>
            </div>
          </div>
          <p className="text-white/50 text-sm max-w-lg leading-relaxed">
            AI-powered mentoring tools for Oral Bible Translation facilitators.
            Supporting language communities through technology.
          </p>
        </div>
      </div>

      {/* Right panel — form area */}
      <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
        <div
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.04] pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(62 28% 42%), transparent 70%)" }}
        />
        <div
          className="absolute -bottom-48 -left-48 w-[400px] h-[400px] rounded-full opacity-[0.03] pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(62 35% 65%), transparent 70%)" }}
        />

        {/* Mobile hero banner */}
        <div className="lg:hidden">
          <div className="relative h-40 overflow-hidden bg-gradient-to-br from-stone-900 via-[hsl(62,20%,18%)] to-[hsl(62,28%,22%)]">
            <div
              className="absolute top-0 -left-20 w-[300px] h-[300px] rounded-full opacity-20 pointer-events-none"
              style={{ background: "radial-gradient(circle, hsl(62 28% 42%), transparent 70%)" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            <div className="absolute bottom-5 left-6 sm:left-8 flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <img src={logoImage} alt="OBT Mentor" className="h-6 w-6 object-contain" />
              </div>
              <span className="text-white font-semibold text-lg tracking-tight drop-shadow-md">
                OBT Mentor
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-16 xl:px-20 py-8 lg:py-12 relative">
          <div className="w-full max-w-[420px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
