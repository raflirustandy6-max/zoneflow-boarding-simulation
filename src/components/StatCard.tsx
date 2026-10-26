import React from "react";
import { TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";

export type StatVariant = "cream" | "lavender" | "mint" | "sky" | "ocean";

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  secondaryText?: string;
  variant?: StatVariant;
  trend?: {
    value: string;
    type: "positive" | "negative" | "neutral";
    label?: string;
  };
  icon?: React.ElementType;
  badge?: string;
  tooltip?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  secondaryText,
  variant = "sky",
  trend,
  icon: Icon,
  badge,
  tooltip,
  onClick,
}) => {
  const variantStyles: Record<
    StatVariant,
    {
      card: string;
      iconBg: string;
      iconColor: string;
      valueColor: string;
      badgeBg: string;
      divider: string;
    }
  > = {
    cream: {
      card: "bg-[#FFF9EA] border-[#FFE7A8] hover:border-[#FAD67B]",
      iconBg: "bg-[#FFEFC4]",
      iconColor: "text-amber-800",
      valueColor: "text-slate-900",
      badgeBg: "bg-amber-100/90 text-amber-900 border-amber-300/80",
      divider: "border-amber-900/10",
    },
    lavender: {
      card: "bg-[#F3EFFC] border-[#DED4FA] hover:border-[#C4B2F5]",
      iconBg: "bg-[#EAE4FB]",
      iconColor: "text-purple-800",
      valueColor: "text-slate-900",
      badgeBg: "bg-purple-100/90 text-purple-900 border-purple-300/80",
      divider: "border-purple-900/10",
    },
    mint: {
      card: "bg-[#EAF8EE] border-[#C3ECD0] hover:border-[#9EE0B2]",
      iconBg: "bg-[#DBF3E2]",
      iconColor: "text-emerald-800",
      valueColor: "text-slate-900",
      badgeBg: "bg-emerald-100/90 text-emerald-900 border-emerald-300/80",
      divider: "border-emerald-900/10",
    },
    sky: {
      card: "bg-[#EFF8FF] border-[#BAE1FD] hover:border-[#85C8FA]",
      iconBg: "bg-[#E0F2FE]",
      iconColor: "text-[#086288]",
      valueColor: "text-slate-900",
      badgeBg: "bg-sky-100/90 text-[#086288] border-sky-300/80",
      divider: "border-sky-900/10",
    },
    ocean: {
      card: "bg-[#086288] border-[#064e6d] text-white",
      iconBg: "bg-white/15",
      iconColor: "text-white",
      valueColor: "text-white",
      badgeBg: "bg-white/20 text-white border-white/30",
      divider: "border-white/15",
    },
  };

  const currentStyle = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between min-w-0 shadow-xs ${
        currentStyle.card
      } ${onClick ? "cursor-pointer hover:shadow-md" : ""}`}
    >
      {/* Top Group: Header + Main Metric + Badge */}
      <div className="flex flex-col gap-2.5 min-w-0">
        {/* Header Row: Category Title + Optional Tooltip + Icon */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-xs font-semibold leading-snug ${
                variant === "ocean" ? "text-slate-100" : "text-slate-700"
              }`}
            >
              {title}
            </span>
            {tooltip && (
              <button
                type="button"
                title={tooltip}
                aria-label={`Informasi ${title}: ${tooltip}`}
                className="cursor-help text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] rounded shrink-0"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {Icon && (
            <div
              className={`p-2 rounded-xl shrink-0 ${currentStyle.iconBg} ${currentStyle.iconColor}`}
            >
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Main Metric Row: Value + Unit */}
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span
            className={`text-3xl font-bold tracking-tight tabular-nums leading-none ${currentStyle.valueColor}`}
          >
            {value}
          </span>
          {unit && (
            <span
              className={`text-xs font-medium whitespace-nowrap ${
                variant === "ocean" ? "text-slate-200" : "text-slate-600"
              }`}
            >
              {unit}
            </span>
          )}
        </div>

        {/* Dedicated Badge Row for Uniform Vertical Alignment Across All Cards */}
        {badge && (
          <div className="flex items-center">
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${currentStyle.badgeBg}`}
            >
              {badge}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Supporting Group: Two Uncramped Lines */}
      <div
        className={`flex flex-col gap-1.5 mt-3.5 pt-3 border-t min-w-0 ${currentStyle.divider}`}
      >
        {/* Supporting Line 1: Full Method Name or Primary Context (Never Truncated) */}
        {subtitle && (
          <div
            className={`text-xs font-semibold leading-snug break-words ${
              variant === "ocean" ? "text-white" : "text-slate-800"
            }`}
          >
            {subtitle}
          </div>
        )}

        {/* Supporting Line 2: Secondary Detail and/or Trend Pill */}
        {(secondaryText || trend) && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0">
            {secondaryText && (
              <span
                className={`text-[11px] font-medium leading-snug ${
                  variant === "ocean" ? "text-slate-200" : "text-slate-600"
                }`}
              >
                {secondaryText}
              </span>
            )}

            {trend && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                  trend.type === "positive"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200/80"
                    : trend.type === "negative"
                    ? "bg-rose-100 text-rose-800 border border-rose-200/80"
                    : "bg-slate-200/75 text-slate-700 border border-slate-300/80"
                }`}
              >
                {trend.type === "positive" && <TrendingUp className="w-3 h-3 shrink-0" />}
                {trend.type === "negative" && <TrendingDown className="w-3 h-3 shrink-0" />}
                {trend.type === "neutral" && <Minus className="w-3 h-3 shrink-0" />}
                <span>{trend.value}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
