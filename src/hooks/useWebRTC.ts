import { useState, useEffect, useRef, useCallback } from 'react';

interface WebRTCState {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isInCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: string[];
  isConnecting: boolean;
}

export function useWebRTC(roomId: string, userName: string) {
  const [state, setState] = useState<WebRTCState>({
    isAudioEnabled: false,
    isVideoEnabled: false,
    isInCall: false,
    localStream: null,
    remoteStreams: new Map(),
    participants: [],
    isConnecting: false
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<any>(null);

  const createPeerConnection = useCallback((participantId: string) => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice_candidate',
          payload: {
            candidate: event.candidate,
            to: participantId,
            from: userName
          }
        });
      }
    };

    pc.ontrack = (event) => {
      setState(prev => {
        const newRemoteStreams = new Map(prev.remoteStreams);
        newRemoteStreams.set(participantId, event.streams[0]);
        return { ...prev, remoteStreams: newRemoteStreams };
      });
    };

    return pc;
  }, [userName]);

  const startLocalStream = useCallback(async (audio: boolean, video: boolean) => {
    try {
      setState(prev => ({ ...prev, isConnecting: true }));

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false,
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false
      });

      setState(prev => ({ 
        ...prev, 
        localStream: stream,
        isAudioEnabled: audio,
        isVideoEnabled: video,
        isInCall: true,
        isConnecting: false
      }));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Add stream to all peer connections
      peerConnectionsRef.current.forEach(pc => {
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
      });

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setState(prev => ({ ...prev, isConnecting: false }));
      
      // Show error toast
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      toast.textContent = 'Camera/microphone access denied';
      document.body.appendChild(toast);
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 3000);
      
      return null;
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
      setState(prev => ({ 
        ...prev, 
        localStream: null,
        isAudioEnabled: false,
        isVideoEnabled: false,
        isInCall: false
      }));
    }
  }, [state.localStream]);

  const toggleAudio = useCallback(async () => {
    if (!state.isInCall) {
      await startLocalStream(true, state.isVideoEnabled);
    } else if (state.localStream) {
      const audioTrack = state.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !state.isAudioEnabled;
        setState(prev => ({ ...prev, isAudioEnabled: !prev.isAudioEnabled }));
        
        // Broadcast audio status
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'audio_toggle',
            payload: {
              user_name: userName,
              audio_enabled: !state.isAudioEnabled
            }
          });
        }
      }
    }
  }, [state.isInCall, state.isAudioEnabled, state.isVideoEnabled, state.localStream, startLocalStream, userName]);

  const toggleVideo = useCallback(async () => {
    if (!state.isInCall) {
      await startLocalStream(state.isAudioEnabled, true);
    } else if (state.localStream) {
      const videoTrack = state.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !state.isVideoEnabled;
        setState(prev => ({ ...prev, isVideoEnabled: !prev.isVideoEnabled }));
        
        // Broadcast video status
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'video_toggle',
            payload: {
              user_name: userName,
              video_enabled: !state.isVideoEnabled
            }
          });
        }
      }
    }
  }, [state.isInCall, state.isAudioEnabled, state.isVideoEnabled, state.localStream, startLocalStream, userName]);

  const endCall = useCallback(() => {
    stopLocalStream();
    
    // Close all peer connections
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    
    setState(prev => ({
      ...prev,
      isInCall: false,
      isAudioEnabled: false,
      isVideoEnabled: false,
      localStream: null,
      remoteStreams: new Map(),
      participants: []
    }));

    // Broadcast call end
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call_end',
        payload: {
          user_name: userName
        }
      });
    }
  }, [stopLocalStream, userName]);

  useEffect(() => {
    if (!roomId || !userName) return;

    // Set up WebRTC signaling channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`webrtc_${roomId}_${Date.now()}`)
      .on('broadcast', { event: 'call_offer' }, async (payload) => {
        const { offer, from } = payload.payload;
        if (from === userName) return;

        const pc = createPeerConnection(from);
        peerConnectionsRef.current.set(from, pc);

        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        channelRef.current.send({
          type: 'broadcast',
          event: 'call_answer',
          payload: {
            answer,
            to: from,
            from: userName
          }
        });
      })
      .on('broadcast', { event: 'call_answer' }, async (payload) => {
        const { answer, to, from } = payload.payload;
        if (to !== userName) return;

        const pc = peerConnectionsRef.current.get(from);
        if (pc) {
          await pc.setRemoteDescription(answer);
        }
      })
      .on('broadcast', { event: 'ice_candidate' }, async (payload) => {
        const { candidate, to, from } = payload.payload;
        if (to !== userName) return;

        const pc = peerConnectionsRef.current.get(from);
        if (pc) {
          await pc.addIceCandidate(candidate);
        }
      })
      .on('broadcast', { event: 'audio_toggle' }, (payload) => {
        // Handle remote audio toggle
        console.log('Remote audio toggle:', payload.payload);
      })
      .on('broadcast', { event: 'video_toggle' }, (payload) => {
        // Handle remote video toggle
        console.log('Remote video toggle:', payload.payload);
      })
      .on('broadcast', { event: 'call_end' }, (payload) => {
        const { user_name } = payload.payload;
        if (user_name === userName) return;

        // Remove peer connection
        const pc = peerConnectionsRef.current.get(user_name);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(user_name);
        }

        // Remove remote stream
        setState(prev => {
          const newRemoteStreams = new Map(prev.remoteStreams);
          newRemoteStreams.delete(user_name);
          return {
            ...prev,
            remoteStreams: newRemoteStreams,
            participants: prev.participants.filter(p => p !== user_name)
          };
        });
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      // Clean up streams and connections
      stopLocalStream();
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
    };
  }, [roomId, userName, createPeerConnection, stopLocalStream]);

  return {
    ...state,
    localVideoRef,
    toggleAudio,
    toggleVideo,
    endCall,
    userName
  };
}