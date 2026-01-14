import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Tag as TagIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StandardTagSelect({ selectedTags = [], onChange }) {
  const [tagInput, setTagInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch all existing tags from tasks
  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-tasks-for-tags'],
    queryFn: () => base44.entities.Task.list('-created_date', 1000),
  });

  // Fetch Tag entity to check/create tags
  const { data: tagEntities = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.list('name'),
  });

  // Extract unique tags from all tasks
  const existingTags = React.useMemo(() => {
    const tagSet = new Set();
    allTasks.forEach(task => {
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet);
  }, [allTasks]);

  // Filter suggestions based on input
  const filteredSuggestions = React.useMemo(() => {
    if (!tagInput.trim()) return [];
    return existingTags.filter(tag => 
      tag.toLowerCase().includes(tagInput.toLowerCase()) &&
      !selectedTags.includes(tag)
    );
  }, [tagInput, existingTags, selectedTags]);

  const handleAddTag = async () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      // Add to Tag entity if it doesn't exist
      const tagExists = tagEntities.some(t => t.name.toLowerCase() === trimmedTag.toLowerCase());
      if (!tagExists) {
        try {
          await base44.entities.Tag.create({
            name: trimmedTag,
            color: '#6366F1' // Default color
          });
        } catch (error) {
          // Ignore duplicate errors, tag might have been created by another user
        }
      }
      
      onChange([...selectedTags, trimmedTag]);
      setTagInput('');
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (tag) => {
    if (!selectedTags.includes(tag)) {
      // Add to Tag entity if it doesn't exist
      const tagExists = tagEntities.some(t => t.name.toLowerCase() === tag.toLowerCase());
      if (!tagExists) {
        try {
          await base44.entities.Tag.create({
            name: tag,
            color: '#6366F1'
          });
        } catch (error) {
          // Ignore duplicate errors
        }
      }
      
      onChange([...selectedTags, tag]);
    }
    setTagInput('');
    setShowSuggestions(false);
  };

  const handleRemove = (tagName) => {
    onChange(selectedTags.filter(t => t !== tagName));
  };

  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tagName) => (
            <Badge 
              key={tagName}
              className="bg-indigo-100 text-indigo-700 border-indigo-200 px-3 py-1 text-sm flex items-center gap-1.5"
            >
              {tagName}
              <button
                type="button"
                onClick={() => handleRemove(tagName)}
                className="hover:text-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tag Input */}
      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            onBlur={() => {
              // Delay to allow clicking on suggestions
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            onFocus={() => {
              if (tagInput.trim()) setShowSuggestions(true);
            }}
            placeholder="Type tag and press Enter..."
            className="flex-1 border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddTag}
            disabled={!tagInput.trim()}
            className="shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Tag Suggestions */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {filteredSuggestions.map((tag, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => handleSelectSuggestion(tag)}
                className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors text-sm flex items-center gap-2"
              >
                <TagIcon className="w-3 h-3 text-indigo-600" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {existingTags.length > 0 && (
        <p className="text-xs text-slate-500">
          💡 Start typing to see suggestions from existing tags
        </p>
      )}
    </div>
  );
}