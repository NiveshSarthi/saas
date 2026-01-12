import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { cn } from '@/lib/utils';

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['blockquote', 'code-block'],
    ['link'],
    ['clean']
  ],
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet',
  'blockquote', 'code-block',
  'link'
];

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Write something...",
  className,
  readOnly = false
}) {
  return (
    <div className={cn("rich-text-editor", className)}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
      />
      <style>{`
        .rich-text-editor .ql-container {
          border-radius: 0 0 0.5rem 0.5rem;
          min-height: 120px;
          font-size: 14px;
        }
        .rich-text-editor .ql-toolbar {
          border-radius: 0.5rem 0.5rem 0 0;
          background: #f8fafc;
        }
        .rich-text-editor .ql-editor {
          min-height: 100px;
        }
      `}</style>
    </div>
  );
}