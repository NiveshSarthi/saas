import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { 
  Upload, 
  X, 
  File, 
  Image, 
  FileText, 
  Loader2,
  Paperclip
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const FILE_ICONS = {
  image: Image,
  pdf: FileText,
  default: File
};

const getFileIcon = (type) => {
  if (type?.startsWith('image')) return FILE_ICONS.image;
  if (type?.includes('pdf')) return FILE_ICONS.pdf;
  return FILE_ICONS.default;
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function FileUpload({ 
  onUpload, 
  onRemove,
  files = [],
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB
  accept = "*",
  multiple = true,
  compact = false
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = async (fileList) => {
    const newFiles = Array.from(fileList);
    
    if (files.length + newFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    for (const file of newFiles) {
      if (file.size > maxSize) {
        alert(`File ${file.name} exceeds ${formatFileSize(maxSize)} limit`);
        continue;
      }

      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onUpload({
        name: file.name,
        url: file_url,
        type: file.type,
        size: file.size
      });
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Paperclip className="w-4 h-4 mr-2" />
          )}
          Attach
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
        />
        {files.map((file, i) => {
          const Icon = getFileIcon(file.type);
          return (
            <div 
              key={i}
              className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm"
            >
              <Icon className="w-3 h-3 text-slate-500" />
              <span className="truncate max-w-[100px]">{file.name}</span>
              <X 
                className="w-3 h-3 cursor-pointer text-slate-400 hover:text-red-500" 
                onClick={() => onRemove(i)}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer",
          dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300",
          uploading && "opacity-50 pointer-events-none"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
        />
        
        {uploading ? (
          <Loader2 className="w-8 h-8 mx-auto text-indigo-500 animate-spin" />
        ) : (
          <Upload className="w-8 h-8 mx-auto text-slate-400" />
        )}
        
        <p className="mt-2 text-sm text-slate-600">
          {uploading ? 'Uploading...' : 'Drag & drop files or click to browse'}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Max {formatFileSize(maxSize)} per file
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => {
            const Icon = getFileIcon(file.type);
            return (
              <div 
                key={i}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
              >
                <Icon className="w-5 h-5 text-slate-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  {file.size && (
                    <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => onRemove(i)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}