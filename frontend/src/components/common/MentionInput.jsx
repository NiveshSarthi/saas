import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function MentionInput({
  value,
  onChange,
  users = [],
  placeholder = "Type @ to mention someone...",
  className
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);

  const filteredUsers = users.filter(u => 
    (u.full_name?.toLowerCase().includes(mentionSearch.toLowerCase()) ||
     u.email?.toLowerCase().includes(mentionSearch.toLowerCase()))
  ).slice(0, 5);

  const handleChange = (e) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart;
    setCursorPosition(cursor);
    
    // Check for @ mention
    const textBeforeCursor = newValue.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionSearch(mentionMatch[1]);
      setShowSuggestions(true);
      setSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
    }
    
    onChange(newValue);
  };

  const insertMention = (user) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const mentionStart = textBeforeCursor.lastIndexOf('@');
    
    const newText = 
      textBeforeCursor.slice(0, mentionStart) + 
      `@${user.full_name || user.email} ` + 
      textAfterCursor;
    
    onChange(newText);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestionIndex(i => Math.min(i + 1, filteredUsers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestionIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filteredUsers[suggestionIndex]) {
      e.preventDefault();
      insertMention(filteredUsers[suggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const getInitials = (user) => {
    if (user.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user.email?.slice(0, 2).toUpperCase() || '?';
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "w-full min-h-[80px] p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none",
          className
        )}
      />
      
      {showSuggestions && filteredUsers.length > 0 && (
        <div className="absolute z-10 w-64 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
          {filteredUsers.map((user, i) => (
            <button
              key={user.email}
              type="button"
              className={cn(
                "w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50",
                i === suggestionIndex && "bg-indigo-50"
              )}
              onClick={() => insertMention(user)}
            >
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                  {getInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                {user.full_name && (
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}