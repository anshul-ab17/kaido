import { Navbar } from '../components/Navbar';
import { TradingChart } from '../components/TradingChart';
import { Orderbook } from '../components/Orderbook';
import { TradeModule } from '../components/TradeModule';
import { StatusBar } from '../components/StatusBar';

const MARKET_STATS = [
  { label: 'SOL-PERP', value: '$145.20', sub: '+2.45%', positive: true },
  { label: 'Index Price', value: '$145.18', sub: null, positive: true },
  { label: '24h Volume', value: '$2.4B', sub: null, positive: true },
  { label: 'Open Interest', value: '$842M', sub: null, positive: true },
  { label: 'Funding Rate', value: '0.0100%', sub: 'in 42m', positive: true },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-white">
      <Navbar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 lg:p-5 scrollbar-hide">
          <div className="max-w-[1920px] mx-auto space-y-4">
            {/* Market summary bar */}
            <div className="glass-card px-6 py-2.5 flex items-center gap-8 overflow-x-auto scrollbar-hide">
              {MARKET_STATS.map((stat) => (
                <div key={stat.label} className="flex flex-col shrink-0">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{stat.label}</span>
                  <span className={`text-sm font-bold ${stat.positive ? 'text-success' : 'text-error'}`}>
                    {stat.value}
                    {stat.sub && <span className="text-[10px] font-normal text-gray-400 ml-1">{stat.sub}</span>}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-12 gap-4">
              {/* Left: Chart + Positions */}
              <div className="col-span-12 xl:col-span-9 space-y-4">
                <TradingChart />
                <div className="glass-card flex flex-col min-h-[280px]">
                  <div className="flex border-b border-white/5">
                    {['Positions (0)', 'Open Orders', 'Trade History', 'Fills'].map((tab, i) => (
                      <button key={tab} className={`px-5 py-3 text-xs font-bold transition-colors ${i === 0 ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-gray-500 hover:text-white'}`}>
                        {tab}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-700 gap-3 p-8">
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-800 flex items-center justify-center">
                      <span className="text-xl font-mono opacity-40">—</span>
                    </div>
                    <div className="text-center">
                      <p className="font-mono text-xs uppercase tracking-widest font-bold text-gray-600">No active positions</p>
                      <p className="text-[10px] mt-1 text-gray-700">Connect wallet to begin trading</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Trade + Orderbook */}
              <div className="col-span-12 xl:col-span-3 flex flex-col gap-4">
                <TradeModule />
                <div className="flex-1 min-h-[400px]">
                  <Orderbook />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <StatusBar />
    </div>
  );
}
