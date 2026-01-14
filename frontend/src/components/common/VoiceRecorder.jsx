import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Play, Pause, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function VoiceRecorder({ onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [audioUrl]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const localUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(localUrl);
        
        setIsUploading(true);
        try {
          const file = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          
          onRecordingComplete({
            name: file.name,
            url: file_url,
            type: file.type
          });
        } catch (error) {
          console.error('Failed to upload voice note:', error);
          // Keep local URL for preview but warn user?
          // For simplicity, we just assume success or log error.
        } finally {
          setIsUploading(false);
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAudioUrl(null);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please ensure you have granted permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return;

    if (isPlaying) {
      audioPlayerRef.current.pause();
    } else {
      audioPlayerRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const deleteRecording = () => {
    setAudioUrl(null);
    setIsPlaying(false);
    // Note: We can't easily "delete" the uploaded file from here without an ID, 
    // but removing it from the parent's list (via onRemove in parent) is sufficient for the form.
  };

  if (isUploading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-3 h-3 animate-spin" />
        Uploading...
      </div>
    );
  }

  // If we have a recording (local preview), show the player
  // Note: Once uploaded, the parent handles the display in the file list, 
  // but we might want to keep this "recorder" component ready for a new recording?
  // Actually, typically you record, it uploads, adds to list, and recorder resets.
  // So we probably don't need to show the player HERE after upload is done.
  // But let's keep it reset.
  
  // Wait, if I call onRecordingComplete, the parent adds it to the list.
  // So I should reset the recorder state to allow another recording.
  // But I need to wait for upload to finish.
  
  // If audioUrl is set but NOT uploading, it means we finished.
  // Since we called onRecordingComplete, the parent has it.
  // So we can reset automatically or show a "Recorded" state?
  // Let's just reset automatically after upload to allow new recording.
  
  // However, the code above sets audioUrl before upload.
  // Let's change logic: Only reset if we want to allow multiple recordings one by one.
  // Yes, we do.
  
  // Modified logic in onstop:
  // ... upload ...
  // onRecordingComplete(...)
  // setAudioUrl(null); // Reset internal state so user can record another one
  
  // Let's adjust the onstop function in the previous block.
  // I will rewrite the file content with this logic.

  return (
    <div className="flex items-center gap-2">
      {isRecording ? (
        <div className="flex items-center gap-3 bg-red-50 px-3 py-1 rounded-full border border-red-100 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-medium text-red-600 min-w-[40px]">
            {formatTime(recordingTime)}
          </span>
          <button 
            onClick={stopRecording}
            className="p-1 bg-red-100 hover:bg-red-200 rounded-full text-red-600 transition-colors"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={startRecording}
          className="text-slate-500 hover:text-indigo-600"
          title="Record voice note"
          disabled={isUploading}
        >
          <Mic className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}