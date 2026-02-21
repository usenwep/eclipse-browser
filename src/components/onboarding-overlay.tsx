import { useState, useEffect } from "react"
import { Globe, ShieldCheck, Sparkles, Map, ArrowRight, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"

type Step =
  | { Icon: React.ElementType; bg: string; title: string; body: string; choice?: false }
  | { Icon: React.ElementType; bg: string; title: string; body: string; choice: true }

const STEPS: Step[] = [
  {
    Icon: Sparkles,
    bg: "#0a84ff",
    title: t("onboarding.steps.welcome.title"),
    body: t("onboarding.steps.welcome.body"),
  },
  {
    Icon: Globe,
    bg: "#30d158",
    title: t("onboarding.steps.browse.title"),
    body: t("onboarding.steps.browse.body"),
  },
  {
    Icon: ShieldCheck,
    bg: "#bf5af2",
    title: t("onboarding.steps.private.title"),
    body: t("onboarding.steps.private.body"),
  },
  {
    Icon: Check,
    bg: "#ff9f0a",
    title: t("onboarding.steps.allSet.title"),
    body: t("onboarding.steps.allSet.body"),
  },
  {
    Icon: Map,
    bg: "#0a84ff",
    title: t("onboarding.steps.tour.title"),
    body: t("onboarding.steps.tour.body"),
    choice: true,
  },
]

export function OnboardingOverlay({ onComplete }: { onComplete: (wantsTour: boolean) => void }) {
  const [step, setStep] = useState(0)
  const [fading, setFading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(timer)
  }, [])

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const goTo = (next: number | "done", wantsTour = false) => {
    setFading(true)
    setTimeout(() => {
      if (next === "done") {
        onComplete(wantsTour)
      } else {
        setStep(next)
        setFading(false)
      }
    }, 150)
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6",
        "bg-black/50 backdrop-blur-sm",
        "transition-opacity duration-300",
        mounted ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="w-full max-w-sm bg-white dark:bg-[#1c1c1e] rounded-3xl overflow-hidden shadow-2xl">


        <div
          className={cn(
            "flex justify-center pt-10 pb-6 transition-opacity duration-150",
            fading ? "opacity-0" : "opacity-100",
          )}
        >
          <div
            className="size-[84px] rounded-full flex items-center justify-center"
            style={{ backgroundColor: current.bg }}
          >
            <current.Icon className="size-10 text-white" strokeWidth={1.75} />
          </div>
        </div>


        <div
          className={cn(
            "px-8 pb-6 text-center transition-opacity duration-150",
            fading ? "opacity-0" : "opacity-100",
          )}
        >
          <h2 className="text-[22px] font-bold text-foreground mb-2 tracking-tight">
            {current.title}
          </h2>
          <p className="text-[15px] text-foreground/55 leading-relaxed">
            {current.body}
          </p>
        </div>


        <div className="flex justify-center gap-1.5 pb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-[6px] rounded-full transition-all duration-300",
                i === step
                  ? "w-5 bg-[#0a84ff]"
                  : "w-[6px] bg-black/15 dark:bg-white/20",
              )}
            />
          ))}
        </div>


        {current.choice ? (
          <div className="flex flex-col gap-2 px-6 pb-8">
            <button
              onClick={() => goTo("done", true)}
              className="w-full py-3 rounded-xl font-semibold text-[15px] bg-[#0a84ff] text-white hover:bg-[#0071e3] active:opacity-80 transition-colors"
            >
              {t("onboarding.showMeAround")}
            </button>
            <button
              onClick={() => goTo("done", false)}
              className="w-full py-2.5 text-[15px] text-foreground/40 hover:text-foreground/60 transition-colors"
            >
              {t("onboarding.iKnowWhatImDoing")}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-6 pb-8">
            <button
              onClick={() => goTo("done")}
              className="text-[15px] text-foreground/35 hover:text-foreground/55 px-2 py-1 transition-colors"
            >
              {t("onboarding.skip")}
            </button>
            <button
              onClick={() => goTo(isLast ? "done" : step + 1)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-[15px] bg-[#0a84ff] text-white hover:bg-[#0071e3] active:opacity-80 transition-colors"
            >
              {isLast ? t("onboarding.getStarted") : t("onboarding.continue")}
              {!isLast && <ArrowRight className="size-4 rtl:scale-x-[-1]" />}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
