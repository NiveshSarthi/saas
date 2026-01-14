import { useState } from 'react';
import { usePermissions } from './PermissionsContext';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function ProtectedRoute({ 
  children, 
  module, 
  action = 'read',
  projectId = null,
  fallback = null 
}) {
  const { can, canAccessProject, loading } = usePermissions();
  const [showDenied, setShowDenied] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const hasModulePermission = can(module, action);
  const hasProjectAccess = projectId ? canAccessProject(projectId) : true;
  const hasAccess = hasModulePermission && hasProjectAccess;

  if (!hasAccess) {
    if (fallback) return fallback;

    return (
      <>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <ShieldX className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-500 mb-6 max-w-md">
            You don't have permission to access this page. Please contact your administrator if you believe this is an error.
          </p>
          <Link to={createPageUrl('Dashboard')}>
            <Button>Go to Dashboard</Button>
          </Link>
        </div>

        <Dialog open={showDenied} onOpenChange={setShowDenied}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldX className="w-5 h-5 text-red-600" />
                Permission Denied
              </DialogTitle>
              <DialogDescription>
                You don't have the required permissions to perform this action.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return children;
}

// Component for conditionally rendering UI elements
export function PermissionGate({ module, action, children, fallback = null }) {
  const { can, loading } = usePermissions();

  if (loading) return null;
  if (!can(module, action)) return fallback;

  return children;
}

// Button that shows permission denied dialog
export function ProtectedButton({ module, action, children, onClick, ...props }) {
  const { can } = usePermissions();
  const [showDenied, setShowDenied] = useState(false);

  if (!can(module, action)) {
    return null; // Hide if no permission
  }

  return (
    <>
      <Button onClick={onClick} {...props}>
        {children}
      </Button>
      
      <Dialog open={showDenied} onOpenChange={setShowDenied}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldX className="w-5 h-5" />
              Permission Denied
            </DialogTitle>
            <DialogDescription>
              You don't have permission to perform this action.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}