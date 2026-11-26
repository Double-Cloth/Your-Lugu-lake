import React, { forwardRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import LucideIcon from "./LucideIcon";

type PageProps = {
  bgImage?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

type CardVariant = "default" | "glass" | "neon" | "immersive";

type CardProps = {
  children: ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  variant?: CardVariant;
};

type ButtonVariant = "primary" | "immersive" | "secondary" | "danger" | "glass";
type ButtonSize = "sm" | "md" | "lg";
type ButtonClickHandler = (event?: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onClick?: ButtonClickHandler;
  className?: string;
};

type SkeletonProps = {
  className?: string;
};

type EmptyStateProps = {
  icon?: ReactNode;
  title?: string;
  description?: string;
  className?: string;
};

type GlassInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> & {
  className?: string;
  wrapperClassName?: string;
  icon?: ReactNode;
  inputType?: string;
  style?: CSSProperties;
  clearable?: boolean;
  onChange?: (value: string) => void;
  value?: string;
};

export const ImmersivePage = ({ bgImage, children, className = "", style }: PageProps) => {
  const isFadeIn = className.includes("page-fade-in");
  const rootClass = className.replace("page-fade-in", "").trim();

  return (
    <div className={`immersive-page relative min-h-full flex flex-col px-4 pb-4 pt-[max(10px,env(safe-area-inset-top))] overflow-x-hidden ${rootClass}`} style={style}>
      {bgImage && (
        <div
          className="immersive-bg fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${bgImage}')` }}
        />
      )}
      <div className="immersive-overlay fixed inset-0 z-0" />
      <div className="immersive-vignette fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />

      <div className={`immersive-content relative z-10 w-full flex-1 flex flex-col ${isFadeIn ? "page-fade-in" : ""}`}>
        {children}
      </div>
    </div>
  );
};

export const ReadingGlassCard = ({ children, className = "" }: { children: ReactNode; className?: string }) => {
  return (
    <div className={`backdrop-blur-xl bg-white/10 text-white/90 rounded-3xl p-6 shadow-2xl border border-white/40 ${className}`}>
      {children}
    </div>
  );
};

export const CardComponent = ({
  children,
  className = "",
  onClick = undefined,
  variant = "default",
}: CardProps) => {
  const variants: Record<CardVariant, string> = {
    default: "bg-[rgba(40,20,10,0.56)] backdrop-blur-xl border border-white/[0.14] shadow-[0_18px_44px_-30px_rgba(24,10,3,0.85)] text-white/90",
    glass: "bg-[rgba(30,15,8,0.5)] backdrop-blur-xl border border-white/[0.12] shadow-[0_16px_38px_-28px_rgba(24,10,3,0.8)] text-white/90",
    neon: "bg-gradient-to-br from-[#3b2011]/90 to-[#241108]/90 border border-[#ffc28b]/20 shadow-[0_20px_48px_-30px_rgba(0,0,0,0.85)] text-white/90",
    immersive: "backdrop-blur-xl bg-[rgba(34,17,8,0.56)] border border-white/[0.14] shadow-[0_18px_44px_-30px_rgba(24,10,3,0.85)] text-white",
  };

  return (
    <div
      className={`rounded-[22px] p-4 mb-4 transition-all duration-300 ease-out ${onClick ? "cursor-pointer active:scale-[0.995]" : ""} ${variants[variant]} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const ButtonComponent = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  onClick = undefined,
  className = "",
}: ButtonProps) => {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-gradient-to-br from-[#f5a05a] via-[#e67a2e] to-[#c05a20] text-white shadow-[0_12px_26px_-14px_rgba(201,100,36,0.9),inset_0_1px_0_rgba(255,255,255,0.28)] hover:brightness-[1.04] hover:shadow-[0_16px_30px_-14px_rgba(201,100,36,0.95)] active:brightness-95",
    immersive: "bg-white/95 hover:bg-white text-[#4a2410] border-none shadow-[0_0_20px_rgba(255,255,255,0.15)]",
    secondary: "bg-white/[0.08] text-white hover:bg-white/[0.14] border border-white/20 hover:border-white/35",
    glass: "bg-white/[0.10] backdrop-blur-xl text-white border border-white/20 hover:border-white/35 hover:bg-white/[0.16]",
    danger: "bg-red-500/80 text-white hover:bg-red-500 shadow-[0_10px_24px_-16px_rgba(239,68,68,0.8)]",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-xs font-semibold rounded-lg min-h-[34px]",
    md: "px-4 py-2.5 text-sm font-bold rounded-xl min-h-[44px]",
    lg: "px-6 py-3 text-base font-bold rounded-2xl min-h-[50px]",
  };

  return (
    <button
      type="button"
      className={`flex items-center justify-center transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-45 disabled:saturate-[0.65] disabled:active:scale-100 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

export const SkeletonComponent = ({ className = "" }: SkeletonProps) => (
  <div className={`animate-pulse bg-white/20 rounded-xl ${className}`}></div>
);

export const EmptyStateComponent = ({
  icon = <LucideIcon name="Frown" size={48} className="text-white/40 mb-3 mx-auto" strokeWidth={1.5} />,
  title = "暂无数据",
  description = "",
  className = "",
}: EmptyStateProps) => (
  <div className={`flex flex-col items-center justify-center p-8 text-center bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl ${className}`}>
    <div className="text-4xl mb-3 opacity-60">{icon}</div>
    <div className="text-white font-bold mb-1">{title}</div>
    {description && <div className="text-white/60 text-sm">{description}</div>}
  </div>
);

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(function GlassInput(
  {
    className = "",
    wrapperClassName = "",
    icon = null,
    inputType = "text",
    style = {},
    clearable = false,
    onChange = undefined,
    value = "",
    ...props
  },
  ref
) {
  const [currentInputType, setCurrentInputType] = useState(inputType);

  const togglePasswordVisibility = () => {
    setCurrentInputType((prevType) => (prevType === "password" ? "text" : "password"));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  const handleClear = () => {
    if (onChange) {
      onChange("");
    }
  };

  return (
    <div className={`glass-input flex items-center rounded-2xl transition-all duration-200 bg-black/20 border border-white/[0.16] backdrop-blur-xl px-4 min-h-[48px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] focus-within:border-orange-300/65 focus-within:bg-black/30 focus-within:ring-2 focus-within:ring-orange-300/25 ${wrapperClassName}`}>
      {icon && (
        <div className="text-white/55 text-[19px] mr-3 flex-shrink-0" aria-hidden="true">
          {icon}
        </div>
      )}

      <input
        ref={ref}
        type={currentInputType}
        value={value}
        onChange={handleChange}
        className={`flex-1 bg-transparent text-[15px] text-white leading-normal caret-orange-300 placeholder:text-white/45 outline-none border-none focus:ring-0 px-0 min-w-0 disabled:text-white/45 ${className}`}
        style={{
          color: "white",
          "--placeholder-color": "rgba(255,255,255,0.45)",
          ...style,
        } as CSSProperties}
        {...props}
      />

      {clearable && value && value.length > 0 && (
        <div
          className="text-white/40 hover:text-white ml-2 flex-shrink-0 cursor-pointer p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          onClick={handleClear}
          aria-hidden="true"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
      )}

      {inputType === "password" && (
        <div
          className="text-white/45 ml-3 flex-shrink-0 cursor-pointer select-none hover:text-white transition-colors"
          onClick={togglePasswordVisibility}
          aria-hidden="true"
        >
          {currentInputType === "password" ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/>
            </svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </div>
      )}
    </div>
  );
});

GlassInput.displayName = "GlassInput";