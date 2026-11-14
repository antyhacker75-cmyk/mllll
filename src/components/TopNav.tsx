export type AppTab = 'account' | 'heroes' | 'counter' | 'ranks' | 'calculator';

interface TopNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  hasDossier: boolean;
  isSampleMode: boolean;
  onPrimaryAction: () => void;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string; mobileLabel: string }> = [
  { id: 'account', label: 'Account Lookup', mobileLabel: 'Account' },
  { id: 'heroes', label: 'Hero Meta', mobileLabel: 'Heroes' },
  { id: 'counter', label: 'Item Counter', mobileLabel: 'Counter' },
  { id: 'ranks', label: 'Rank Ladder', mobileLabel: 'Ranks' },
  { id: 'calculator', label: 'Win Predictor', mobileLabel: 'Predict' },
];

export function TopNav({
  activeTab,
  onSelectTab,
  hasDossier,
  isSampleMode,
  onPrimaryAction,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B0F17]/95 backdrop-blur-md">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('account');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm"
        >
          DawnSight
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 lg:gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm ${
                  isActive
                    ? 'text-amber-400'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-amber-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary CTA */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {hasDossier
              ? isSampleMode
                ? 'Verify Account'
                : 'Switch Account'
              : 'Verify Account'}
          </button>
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden border-t border-slate-800/70 px-1 grid grid-cols-5"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-label={item.label}
              className={`py-2 px-1 text-center text-[11px] font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.mobileLabel}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
