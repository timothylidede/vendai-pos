"use client";

import { useState } from "react";
import { Card } from "./ui/card";
import { motion } from "framer-motion";
import { Button } from "./ui/button";

interface Org {
  id: string;
  name: string;
}

interface OrgDashboardProps {
  orgs: Org[];
  onCreateOrg: () => void;
  onSelectOrg: (orgId: string) => void;
}

export function OrgDashboard({ orgs, onCreateOrg, onSelectOrg }: OrgDashboardProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="glass rounded-lg p-8 w-full max-w-lg flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-6 text-slate-200 text-center">Choose or Create Organization</h2>
          <div className="w-full mb-6">
            {orgs.length > 0 ? (
              <div className="grid gap-4">
                {orgs.map(org => (
                  <motion.div
                    key={org.id}
                    whileHover={{ scale: 1.03 }}
                    className="w-full"
                  >
                    <Button className="w-full bg-white text-slate-900 font-medium text-base py-3 rounded-lg mb-2" onClick={() => onSelectOrg(org.id)}>
                      {org.name}
                    </Button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 text-center mb-4">No organizations found.</div>
            )}
          </div>
          <Button className="w-full bg-blue-600 text-white font-medium text-base py-3 rounded-lg" onClick={onCreateOrg}>
            Create New Organization
          </Button>
        </Card>
      </motion.div>
    </div>
  );
}
