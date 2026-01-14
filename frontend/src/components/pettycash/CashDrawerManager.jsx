import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function CashDrawerManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    drawer_name: '',
    custodian_email: '',
    opening_balance: ''
  });

  const queryClient = useQueryClient();

  const { data: drawers = [] } = useQuery({
    queryKey: ['petty-cash-drawers'],
    queryFn: () => base44.entities.PettyCashDrawer.list('-created_date', 50),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PettyCashDrawer.create({
      ...data,
      current_balance: data.opening_balance,
      status: 'active'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-drawers'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({
      drawer_name: '',
      custodian_email: '',
      opening_balance: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Cash Drawer Management</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Drawer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Cash Drawer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Drawer Name/Location</Label>
                <Input
                  value={formData.drawer_name}
                  onChange={(e) => setFormData({...formData, drawer_name: e.target.value})}
                  placeholder="e.g., Reception Desk, Office 1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Custodian Email</Label>
                <Input
                  type="email"
                  value={formData.custodian_email}
                  onChange={(e) => setFormData({...formData, custodian_email: e.target.value})}
                  placeholder="person@company.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  value={formData.opening_balance}
                  onChange={(e) => setFormData({...formData, opening_balance: parseFloat(e.target.value)})}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Drawer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {drawers.map((drawer) => (
          <Card key={drawer.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{drawer.drawer_name}</CardTitle>
                  <p className="text-sm text-slate-500">{drawer.custodian_email}</p>
                </div>
                <Badge className={drawer.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                  {drawer.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Current Balance</span>
                  <span className="text-2xl font-bold">₹{(drawer.current_balance || 0).toLocaleString()}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-xs text-slate-500">Credits</p>
                      <p className="text-sm font-semibold">₹{(drawer.total_credits || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <div>
                      <p className="text-xs text-slate-500">Debits</p>
                      <p className="text-sm font-semibold">₹{(drawer.total_debits || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {drawer.last_reconciled_date && (
                  <p className="text-xs text-slate-400 pt-2">
                    Last reconciled: {new Date(drawer.last_reconciled_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {drawers.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-slate-500">
            <Wallet className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No cash drawers created. Set up drawers to track physical cash.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}