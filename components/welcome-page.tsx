'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { motion } from 'framer-motion';

export function WelcomePage() {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Save form data
    router.push('/modules');
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 p-6">
      <div className="max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="glass rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 text-slate-200">Let's get started</h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Company Name</label>
                <input type="text" name="company" placeholder="e.g. Mambo Grocers" className="w-full mt-1 p-2 text-sm rounded bg-slate-800/40 border border-slate-700/50 text-slate-200" />
              </div>

              <div>
                <label className="text-xs text-slate-400">Contact Person</label>
                <input type="text" name="contact" placeholder="Name or owner" className="w-full mt-1 p-2 text-sm rounded bg-slate-800/40 border border-slate-700/50 text-slate-200" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Country</label>
                  <select name="country" className="w-full mt-1 p-2 text-sm rounded bg-slate-800/40 border border-slate-700/50 text-slate-200">
                    <option>Kenya</option>
                    <option>Tanzania</option>
                    <option>Uganda</option>
                    <option>Rwanda</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Currency</label>
                  <select name="currency" className="w-full mt-1 p-2 text-sm rounded bg-slate-800/40 border border-slate-700/50 text-slate-200">
                    <option>KES</option>
                    <option>TZS</option>
                    <option>UGX</option>
                    <option>USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Timezone</label>
                <select name="tz" className="w-full mt-1 p-2 text-sm rounded bg-slate-800/40 border border-slate-700/50 text-slate-200">
                  <option>Africa/Nairobi</option>
                  <option>Africa/Dar_es_Salaam</option>
                  <option>Africa/Kampala</option>
                </select>
              </div>

              <div>
                <Button type="submit" className="w-full py-2 bg-primary text-primary-foreground text-sm">Start Setup</Button>
              </div>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
}

const FeatureCard = (props: FeatureCardProps) => {
  const { title, description, icon } = props;

  return (
    <Card className="p-6 backdrop-blur-sm bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}
