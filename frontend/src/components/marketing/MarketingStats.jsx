import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Eye, ThumbsUp, MousePointerClick, TrendingUp, Video, Info, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { motion } from 'framer-motion';

export default function MarketingStats({ tasks }) {
  // Aggregate Metrics
  const activeCollateral = tasks.filter(t => ['editing', 'review', 'revision', 'compliance', 'compliance_revision', 'approved', 'published', 'tracking'].includes(t.status)).length;
  const totalCollateral = tasks.length;
  const collateralPending = tasks.filter(t => ['editing', 'review', 'revision', 'compliance', 'compliance_revision'].includes(t.status)).length;
  const collateralApproved = tasks.filter(t => ['approved', 'published', 'tracking'].includes(t.status)).length;
  
  // Calculate overdue tasks
  const now = new Date();
  const overdueCollateral = tasks.filter(t => {
    if (!t.due_date) return false;
    if (['closed', 'published', 'tracking'].includes(t.status)) return false;
    return new Date(t.due_date) < now;
  }).length;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <TooltipProvider>
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5 mb-4 sm:mb-6 w-full"
      >
        <motion.div variants={item}>
            <Card className="relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-indigo-500 to-purple-600 group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold text-white/90">Active Collateral</CardTitle>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3 h-3 text-white/60" /></TooltipTrigger>
                    <TooltipContent>Collateral currently being worked on (not closed)</TooltipContent>
                  </Tooltip>
                </div>
                <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl">
                  <Video className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold text-white mb-1">{activeCollateral}</div>
                <div className="flex items-center text-xs text-white/80 mt-2">
                  <TrendingUp className="w-3.5 h-3.5 mr-1" />
                  <span className="font-semibold">{collateralApproved} approved</span>
                  <span className="text-white/60 ml-1.5">collateral items</span>
                </div>
              </CardContent>
            </Card>
        </motion.div>

        <motion.div variants={item}>
            <Card className="relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-blue-500 to-cyan-600 group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold text-white/90">Total Collateral</CardTitle>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3 h-3 text-white/60" /></TooltipTrigger>
                    <TooltipContent>Total number of all collateral items</TooltipContent>
                  </Tooltip>
                </div>
                <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl">
                  <Eye className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold text-white mb-1">{totalCollateral}</div>
                <p className="text-xs text-white/80 mt-2">All collateral items</p>
              </CardContent>
            </Card>
        </motion.div>

        <motion.div variants={item}>
            <Card className="relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-pink-500 to-rose-600 group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold text-white/90">Collateral Pending</CardTitle>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3 h-3 text-white/60" /></TooltipTrigger>
                    <TooltipContent>Collateral in editing, review, or revision stages</TooltipContent>
                  </Tooltip>
                </div>
                <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl">
                  <ThumbsUp className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold text-white mb-1">{collateralPending}</div>
                <p className="text-xs text-white/80 mt-2">Awaiting completion</p>
              </CardContent>
            </Card>
        </motion.div>

        <motion.div variants={item}>
            <Card className="relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-emerald-500 to-teal-600 group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold text-white/90">Collateral Approved</CardTitle>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3 h-3 text-white/60" /></TooltipTrigger>
                    <TooltipContent>Collateral that is approved, published, or tracking</TooltipContent>
                  </Tooltip>
                </div>
                <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl">
                  <MousePointerClick className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold text-white mb-1">{collateralApproved}</div>
                <p className="text-xs text-white/80 mt-2">Ready or live</p>
              </CardContent>
            </Card>
        </motion.div>

        <motion.div variants={item}>
            <Card className="relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-orange-500 to-red-600 group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold text-white/90">Overdue</CardTitle>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3 h-3 text-white/60" /></TooltipTrigger>
                    <TooltipContent>Collateral past due date and not yet completed</TooltipContent>
                  </Tooltip>
                </div>
                <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold text-white mb-1">{overdueCollateral}</div>
                <p className="text-xs text-white/80 mt-2">Needs attention</p>
              </CardContent>
            </Card>
        </motion.div>
      </motion.div>
    </TooltipProvider>
  );
}