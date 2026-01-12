import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Keyboard,
  Search,
  Plus,
  Home,
  FolderOpen,
  CheckSquare,
  Calendar,
  Settings,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const shortcuts = [
  { keys: ['g', 'h'], description: 'Go to Dashboard', action: 'navigate', target: 'Dashboard', icon: Home },
  { keys: ['g', 'p'], description: 'Go to Projects', action: 'navigate', target: 'Projects', icon: FolderOpen },
  { keys: ['g', 't'], description: 'Go to My Tasks', action: 'navigate', target: 'MyTasks', icon: CheckSquare },
  { keys: ['g', 'c'], description: 'Go to Calendar', action: 'navigate', target: 'Calendar', icon: Calendar },
  { keys: ['g', 's'], description: 'Go to Settings', action: 'navigate', target: 'Settings', icon: Settings },
  { keys: ['c', 't'], description: 'Create New Task', action: 'navigate', target: 'NewTask', icon: Plus },
  { keys: ['c', 'p'], description: 'Create New Project', action: 'navigate', target: 'NewProject', icon: Plus },
  { keys: ['/'], description: 'Focus Search', action: 'search', icon: Search },
  { keys: ['?'], description: 'Show Shortcuts', action: 'help', icon: Keyboard },
  { keys: ['Esc'], description: 'Close Dialog', action: 'close', icon: X },
];

export default function KeyboardShortcuts({ children }) {
  const [showHelp, setShowHelp] = useState(false);
  const [keySequence, setKeySequence] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let timeout;

    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();
      
      // Show help with ?
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Close with Escape
      if (e.key === 'Escape') {
        setShowHelp(false);
        return;
      }

      // Focus search with /
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const searchInput = document.querySelector('[data-search-input]');
        if (searchInput) searchInput.focus();
        return;
      }

      // Build key sequence
      setKeySequence(prev => [...prev, key]);

      // Clear sequence after 1 second
      clearTimeout(timeout);
      timeout = setTimeout(() => setKeySequence([]), 1000);

      // Check for matching shortcuts
      const currentSequence = [...keySequence, key];
      
      for (const shortcut of shortcuts) {
        if (shortcut.keys.length === currentSequence.length &&
            shortcut.keys.every((k, i) => k === currentSequence[i])) {
          e.preventDefault();
          
          if (shortcut.action === 'navigate') {
            window.location.href = createPageUrl(shortcut.target);
          } else if (shortcut.action === 'help') {
            setShowHelp(true);
          }
          
          setKeySequence([]);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, [keySequence, navigate]);

  return (
    <>
      {children}
      
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="w-5 h-5" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-1">
              {shortcuts.map((shortcut, i) => {
                const Icon = shortcut.icon;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-700">{shortcut.description}</span>
                    </div>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, j) => (
                        <React.Fragment key={j}>
                          <kbd className="px-2 py-1 text-xs font-semibold bg-slate-100 border border-slate-200 rounded">
                            {key}
                          </kbd>
                          {j < shortcut.keys.length - 1 && (
                            <span className="text-slate-400 text-xs self-center">then</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-xs">?</kbd> anytime to show this help
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}