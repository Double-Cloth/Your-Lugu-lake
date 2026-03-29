import React, { forwardRef, useState } from 'react';

/**
 * 沉浸式全局页面容器
 */
export const ImmersivePage = ({ bgImage, children, className = '', style }) => {
  const isFadeIn = className.includes('page-fade-in');
  const rootClass = className.replace('page-fade-in', '').trim();
  
  return (
    <div className={`relative min-h-full flex flex-col px-4 pb-4 pt-[max(10px,env(safe-area-inset-top))] overflow-x-hidden ${rootClass}`} style={style}>
      {bgImage && (
        <div 
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${bgImage}')` }}
        />
      )}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-slate-900/90 backdrop-blur-[2px]" />
      
      <div className={`relative z-10 w-full flex-1 flex flex-col ${isFadeIn ? 'page-fade-in' : ''}`}>
        {children}
      </div>
    </div>
  );
};

/**
 * 长文本阅读容器 - (半透明浅色底，保证深色字体可读)
 */
export const ReadingGlassCard = ({ children, className = '' }) => {
  return (
    <div className={`backdrop-blur-xl bg-white/10 text-white/90 rounded-3xl p-6 shadow-2xl border border-white/40 ${className}`}>
      {children}
    </div>
  );
};

/**
 * 优化的卡片组件 - 使用Tailwind CSS + 玻璃态效果
 */
export const CardComponent = ({
  children,
  className = '',
  onClick = null,
  variant = 'default' // 'default', 'glass', 'neon', 'immersive'
}) => {
  const variants = {
    default: 'bg-white/10 backdrop-blur-md border border-white/20 shadow-card hover:shadow-card-hover text-white/90',
    glass: 'bg-white/5 backdrop-blur-lg border border-white/10 shadow-smooth text-white/90', 
    neon: 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 shadow-smooth-lg text-white/90',
    immersive: 'backdrop-blur-md bg-white/10 border border-white/20 shadow-xl text-white' // 新增沉浸式深色玻璃
  };

  return (
    <div
      className={`rounded-2xl p-4 mb-4 transition-all duration-300 ease-out ${variants[variant]} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

/**
 * 按钮组件 - 统一样式和交互
 */
export const ButtonComponent = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick = null,
  className = '',
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-lake-500 to-lake-600 text-white hover:from-lake-600 hover:to-lake-700 shadow-md',
    immersive: 'bg-white/90 hover:bg-white text-slate-900 border-none shadow-[0_0_20px_rgba(255,255,255,0.15)]', // 新增深色模式主题主按钮
    secondary: 'bg-white/10 text-white hover:bg-white/20 border border-white/20',
    danger: 'bg-red-500/80 text-white hover:bg-red-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-semibold rounded-lg',
    md: 'px-4 py-2.5 text-sm font-bold rounded-xl',
    lg: 'px-6 py-3 text-base font-bold rounded-2xl min-h-[48px]',
  };

  return (
    <button
      className={`flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
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

export const SkeletonComponent = ({ className = '' }) => (
  <div className={`animate-pulse bg-white/20 rounded-xl ${className}`}></div>
);

export const EmptyStateComponent = ({ icon = <LucideIcon name="Frown" size={48} className="text-white/40 mb-3 mx-auto" strokeWidth={1.5} />, title = '暂无数据', description = '', className = '' }) => (
  <div className={`flex flex-col items-center justify-center p-8 text-center bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl ${className}`}>
    <div className="text-4xl mb-3 opacity-60">{icon}</div>
    <div className="text-white font-bold mb-1">{title}</div>
    {description && <div className="text-white/60 text-sm">{description}</div>}
  </div>
);

/**
 * 沉浸式玻璃态输入框组件
 */
export const GlassInput = forwardRef(({
  className = "",
  wrapperClassName = "",
  icon = null,
  inputType = "text",
  style = {},
  clearable = false,
  onChange = null,
  value = "",
  ...props
}, ref) => {
  const [currentInputType, setCurrentInputType] = useState(inputType);

  const togglePasswordVisibility = () => {
    setCurrentInputType(prevType => prevType === "password" ? "text" : "password");
  };

  const handleChange = (e) => {
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
    <div
      className={`flex items-center rounded-xl transition-all shadow-inner bg-white/10 border border-white/20 backdrop-blur-md px-4 py-2.5 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400/50 ${wrapperClassName}`}
    >
      {icon && (
        <div className="text-white/60 text-[20px] mr-3 flex-shrink-0" aria-hidden="true">
          {icon}
        </div>
      )}

      <input
        ref={ref}
        type={currentInputType}
        value={value}
        onChange={handleChange}
        className={`flex-1 bg-transparent text-[16px] text-white leading-normal caret-cyan-400 placeholder:text-white/50 outline-none border-none focus:ring-0 px-0 min-w-0 ${className}`}
        style={{
          "--color": "white",
          "--placeholder-color": "rgba(255,255,255,0.5)",
          ...style
        }}
        {...props}
      />

      {clearable && value && value.length > 0 && (
        <div
          className="text-white/40 hover:text-white ml-2 flex-shrink-0 cursor-pointer p-0.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          onClick={handleClear}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
      )}

      {inputType === "password" && (
        <div
          className="text-white/60 ml-3 flex-shrink-0 cursor-pointer select-none hover:text-white transition-colors"
          onClick={togglePasswordVisibility}
          aria-hidden="true"
        >
          {currentInputType === "password" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
