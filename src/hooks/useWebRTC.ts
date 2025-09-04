import { useState, useEffect, useRef, useCallback } from 'react';

interface WebRTCState {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isInCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: MediaStream[];
  participants: string[];
}

export function useWebRTC(roomId: string, userName: string) {
  const [state, setState] = useState<WebRTCState>({
    isAudioEnabled: false,
    isVideoEnabled: false,
    isInCall: false,
    localStream: null,
    remoteStreams: [],
    participants: []
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const startLocalStream = useCallback(async (audio: boolean, video: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio,
        video: video ? { width: 640, height: 480 } : false
      });

      setState(prev => ({ ...prev, localStream: stream }));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      return null;
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
      setState(prev => ({ ...prev, localStream: null }));
    }
  }, [state.localStream]);

  const toggleAudio = useCallback(async () => {
    if (!state.isInCall) {
      const stream = await startLocalStream(true, state.isVideoEnabled);
      if (stream) {
        setState(prev => ({ 
          ...prev, 
          isAudioEnabled: true, 
          isInCall: true,
          localStream: stream 
        }));
      }
    } else {
      if (state.localStream) {
        const audioTrack = state.localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !state.isAudioEnabled;
          setState(prev => ({ ...prev, isAudioEnabled: !prev.isAudioEnabled }));
        }
      }
    }
  }, [state.isInCall, state.isAudioEnabled, state.isVideoEnabled, state.localStream, startLocalStream]);

  const toggleVideo = useCallback(async () => {
    if (!state.isInCall) {
      const stream = await startLocalStream(state.isAudioEnabled, true);
      if (stream) {
        setState(prev => ({ 
          ...prev, 
          isVideoEnabled: true, 
          isInCall: true,
          localStream: stream 
        }));
      }
    } else {
      if (state.localStream) {
        const videoTrack = state.localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !state.isVideoEnabled;
          setState(prev => ({ ...prev, isVideoEnabled: !prev.isVideoEnabled }));
        }
      }
    }
  }, [state.isInCall, state.isAudioEnabled, state.isVideoEnabled, state.localStream, startLocalStream]);

  const endCall = useCallback(() => {
    stopLocalStream();
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    
    setState({
      isAudioEnabled: false,
      isVideoEnabled: false,
      isInCall: false,
      localStream: null,
      remoteStreams: [],
      participants: []
    });
  }, [stopLocalStream]);

  return {
    ...state,
    localVideoRef,
    toggleAudio,
    toggleVideo,
    endCall
  };
}