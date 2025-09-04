import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2, Users } from 'lucide-react';
import { RoomParticipant } from '../lib/supabase';

interface VideoCallProps {
  webRTC: any;
  participants: RoomParticipant[];
  onClose: () => void;
}

export function VideoCall({ webRTC, participants, onClose }: VideoCallProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && webRTC.localStream) {
      localVideoRef.current.srcObject = webRTC.localStream;
    }
  }, [webRTC.localStream]);

  const handleEndCall = () => {
    webRTC.endCall();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* Call Header */}
      <div className="bg-black/50 backdrop-blur-sm p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-white" />
          <span className="text-white font-medium">Video Call • {participants.length} participants</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={webRTC.toggleAudio}
            className={`p-3 rounded-full transition-all duration-200 ${
              webRTC.isAudioEnabled 
                ? 'bg-white/20 text-white hover:bg-white/30' 
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            {webRTC.isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          
          <button
            onClick={webRTC.toggleVideo}
            className={`p-3 rounded-full transition-all duration-200 ${
              webRTC.isVideoEnabled 
                ? 'bg-white/20 text-white hover:bg-white/30' 
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            {webRTC.isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
          
          <button
            onClick={handleEndCall}
            className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all duration-200"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
          {/* Local Video */}
          <div className="relative bg-gray-900 rounded-xl overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
              You {webRTC.isVideoEnabled ? '' : '(Camera Off)'}
            </div>
            {!webRTC.isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {participants.find(p => p.user_name === webRTC.userName)?.[0]?.toUpperCase() || 'Y'}
                </div>
              </div>
            )}
          </div>

          {/* Remote Videos */}
          {participants.filter(p => p.user_name !== webRTC.userName).map((participant) => (
            <div key={participant.user_name} className="relative bg-gray-900 rounded-xl overflow-hidden">
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {participant.user_name[0].toUpperCase()}
                </div>
              </div>
              <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
                {participant.user_name}
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <Mic className="w-3 h-3 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Call Controls */}
      <div className="bg-black/50 backdrop-blur-sm p-6">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={webRTC.toggleAudio}
            className={`p-4 rounded-full transition-all duration-200 ${
              webRTC.isAudioEnabled 
                ? 'bg-white/20 text-white hover:bg-white/30' 
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            {webRTC.isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
          
          <button
            onClick={webRTC.toggleVideo}
            className={`p-4 rounded-full transition-all duration-200 ${
              webRTC.isVideoEnabled 
                ? 'bg-white/20 text-white hover:bg-white/30' 
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            {webRTC.isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>
          
          <button
            onClick={handleEndCall}
            className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all duration-200 scale-110"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}