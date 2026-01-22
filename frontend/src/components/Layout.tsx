import { useState, useRef, useCallback, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ShoppingCart, List, History, LogOut, Activity, Zap, Clock, AlertCircle, UtensilsCrossed, CalendarDays, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { cn } from '@/lib/utils';
import { api, AIStats } from '@/lib/api';

// Long press hook
function useLongPress(callback: () => void, ms = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    timerRef.current = setTimeout(() => {
      callbackRef.current();
    }, ms);
  }, [ms]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [stats, setStats] = useState<AIStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getAIStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load AI stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLongPress = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    setIsStatsOpen(true);
    loadStats();
  }, [loadStats]);

  const longPressHandlers = useLongPress(handleLongPress, 800);

  const navItems = [
    { path: '/', icon: List, label: 'List' },
    { path: '/shopping', icon: ShoppingCart, label: 'Shop' },
    { path: '/menu', icon: CalendarDays, label: 'Menu' },
    { path: '/meals', icon: UtensilsCrossed, label: 'Meals' },
    { path: '/products', icon: Package, label: 'Products' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Long-press logo for stats */}
            <div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-500/30 cursor-pointer select-none active:scale-95 transition-transform"
              {...longPressHandlers}
            >
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg text-foreground">Grocery List</h1>
              <p className="text-xs text-muted-foreground">Welcome, {user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate('/history')} title="History">
              <History className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t z-40">
        <div className="max-w-4xl mx-auto px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around h-16">
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )
                }
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* AI Stats Dialog */}
      <Dialog open={isStatsOpen} onOpenChange={setIsStatsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              AI Service Stats
            </DialogTitle>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : stats ? (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  stats.isInitialized ? "bg-emerald-500" : "bg-red-500"
                )} />
                <span className="font-medium">
                  {stats.isInitialized ? 'Connected' : 'Not Initialized'}
                </span>
                <span className="text-sm text-muted-foreground ml-auto">
                  {stats.model}
                </span>
              </div>

              {/* Request Stats */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<Zap className="w-4 h-4" />}
                  label="Last Minute"
                  value={stats.requestsLastMinute}
                  subValue={`${stats.tokensLastMinute.toLocaleString()} tokens`}
                  color="text-amber-600"
                  bgColor="bg-amber-50"
                />
                <StatCard
                  icon={<Clock className="w-4 h-4" />}
                  label="Last Hour"
                  value={stats.requestsLastHour}
                  subValue={`${stats.tokensLastHour.toLocaleString()} tokens`}
                  color="text-blue-600"
                  bgColor="bg-blue-50"
                />
              </div>

              {/* Success/Failure */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-50">
                  <div className="text-sm text-emerald-600 font-medium">Successful</div>
                  <div className="text-2xl font-bold text-emerald-700">{stats.successfulLastHour}</div>
                  <div className="text-xs text-emerald-600">last hour</div>
                </div>
                <div className="p-3 rounded-lg bg-red-50">
                  <div className="text-sm text-red-600 font-medium">Failed</div>
                  <div className="text-2xl font-bold text-red-700">{stats.failedLastHour}</div>
                  <div className="text-xs text-red-600">last hour</div>
                </div>
              </div>

              {/* Rate Limits */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Rate Limits (Free Tier)
                </div>
                <div className="space-y-2">
                  <RateLimitBar
                    label="Requests/min"
                    current={stats.requestsLastMinute}
                    max={stats.rateLimits.requestsPerMinute}
                    percent={stats.usagePercent.rpm}
                  />
                  <RateLimitBar
                    label="Tokens/min"
                    current={stats.tokensLastMinute}
                    max={stats.rateLimits.tokensPerMinute}
                    percent={stats.usagePercent.tpm}
                  />
                </div>
              </div>

              {/* All-time stats */}
              <div className="text-xs text-muted-foreground border-t pt-3">
                <div className="flex justify-between">
                  <span>Total requests (all time):</span>
                  <span className="font-medium">{stats.totalRequestsAllTime.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total tokens (all time):</span>
                  <span className="font-medium">{stats.totalTokensAllTime.toLocaleString()}</span>
                </div>
              </div>

              {/* Refresh button */}
              <Button onClick={loadStats} variant="outline" className="w-full">
                Refresh Stats
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load stats
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper components
function StatCard({ icon, label, value, subValue, color, bgColor }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subValue: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={cn("p-3 rounded-lg", bgColor)}>
      <div className={cn("flex items-center gap-1 text-sm font-medium", color)}>
        {icon}
        {label}
      </div>
      <div className={cn("text-2xl font-bold", color)}>{value}</div>
      <div className={cn("text-xs", color)}>{subValue}</div>
    </div>
  );
}

function RateLimitBar({ label, current, max, percent }: {
  label: string;
  current: number;
  max: number;
  percent: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span>{current.toLocaleString()} / {max.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all",
            percent > 80 ? "bg-red-500" : percent > 50 ? "bg-amber-500" : "bg-emerald-500"
          )}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}
