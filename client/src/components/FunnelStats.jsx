import React, { useState, useEffect } from 'react';
import { BarChart, Activity, Users } from 'lucide-react';

const FunnelStats = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const baseUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:8080' 
      : 'https://penny-finance-backend.fly.dev';

    fetch(`${baseUrl}/api/analytics/stats`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch stats", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-4 text-gray-400">Loading stats...</div>;

  const startCount = stats.funnel_start || 0;
  
  const steps = [
    { key: 'funnel_start', label: 'Started Quiz' },
    { key: 'question_1_answered', label: 'Q1 Answered' },
    { key: 'question_2_answered', label: 'Q2 Answered' },
    { key: 'question_3_answered', label: 'Q3 Answered' },
    { key: 'question_4_answered', label: 'Q4 Answered' },
    { key: 'question_5_answered', label: 'Q5 Answered' },
    { key: 'question_6_answered', label: 'Q6 Answered' },
    { key: 'question_7_answered', label: 'Q7 Answered' },
    { key: 'question_8_answered', label: 'Lead Capture' },
    { key: 'funnel_completed', label: 'Completed' }
  ];

  return (
    <div className="p-8 bg-black/50 border border-white/10 rounded-3xl shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
          <Activity className="w-5 h-5" />
        </div>
        <div>
           <h2 className="text-xl font-bold text-white">Funnel Health</h2>
           <p className="text-xs text-gray-500">Real-time conversion metrics</p>
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => {
          const count = stats[step.key] || 0;
          const percentage = startCount > 0 ? Math.round((count / startCount) * 100) : 0;
          
          // Dropoff from previous step
          const prevCount = index > 0 ? (stats[steps[index-1].key] || 0) : startCount;
          const dropoff = prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : 0;

          return (
            <div key={step.key} className="relative group">
               <div className="flex justify-between text-xs mb-1 font-medium text-gray-400 group-hover:text-white transition-colors">
                 <span>{step.label}</span>
                 <div className="flex gap-3">
                   {index > 0 && <span className="text-red-400 text-[10px] opacity-60">-{dropoff}% drop</span>}
                   <span>{count} users ({percentage}%)</span>
                 </div>
               </div>
               
               <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                 <div
                   className={`h-full rounded-full transition-all duration-1000 ${
                     step.key === 'funnel_completed' ? 'bg-emerald-500' : 'bg-purple-500'
                   }`}
                   style={{ width: `${percentage}%` }}
                 ></div>
               </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
         <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Total Traffic</p>
            <p className="text-2xl font-black text-white">{startCount}</p>
         </div>
         <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Conversion Rate</p>
            <p className="text-2xl font-black text-emerald-400">
               {startCount > 0 ? ((stats.funnel_completed || 0) / startCount * 100).toFixed(1) : 0}%
            </p>
         </div>
      </div>
    </div>
  );
};

export default FunnelStats;
