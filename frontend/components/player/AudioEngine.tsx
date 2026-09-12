"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { usePlayerStore } from "@/store/usePlayerStore";

declare global {
  interface Window {
    YT: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    onYouTubeIframeAPIReady: () => void;
  }
}

export function AudioEngine() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const isReadyRef = useRef(false);
  const isMountedRef = useRef(true);
  const currentVideoIdRef = useRef<string | null>(null);
  const seekLock = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number>(0);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const progress = usePlayerStore((s) => s.progress);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setPlayError = usePlayerStore((s) => s.setPlayError);
  const setAnalyserBins = usePlayerStore((s) => s.setAnalyserBins);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize YouTube IFrame Player API
  useEffect(() => {
    function initPlayer() {
      if (!window.YT || !window.YT.Player) return;
      if (playerRef.current) return;
      if (!containerRef.current) return;

      const mountPoint = document.createElement("div");
      mountPoint.id = "yt-mount-" + Math.random().toString(36).substring(2, 9);
      containerRef.current.appendChild(mountPoint);

      playerRef.current = new window.YT.Player(mountPoint.id, {
        height: "200",
        width: "200",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          enablejsapi: 1,
          iv_load_policy: 3,
          rel: 0,
        },
        events: {
          onReady: (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (!isMountedRef.current) return;
            isReadyRef.current = true;
            try {
              event.target.setVolume(Math.round(usePlayerStore.getState().volume * 100));
              if (usePlayerStore.getState().muted) {
                event.target.mute();
              }
              const track = usePlayerStore.getState().currentTrack;
              if (track) {
                currentVideoIdRef.current = track.videoId;
                event.target.loadVideoById(track.videoId);
              }
            } catch (err) {
              console.warn("[Geekify Player] Error in onReady:", err);
            }
          },
          onStateChange: (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (!isMountedRef.current) return;
            // 1: PLAYING, 2: PAUSED, 0: ENDED, 3: BUFFERING
            if (event.data === 1) {
              setPlaying(true);
              setPlayError(null);
            } else if (event.data === 0) {
              next();
            }
          },
          onError: (err: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (!isMountedRef.current) return;
            console.warn("[Geekify Player] Error:", err);
            if (err && (err.data === 150 || err.data === 101)) {
              setPlayError("Track is restricted by copyright owner. Skipping to next song...");
              setTimeout(() => {
                if (isMountedRef.current) next();
              }, 1200);
            } else {
              setPlayError("Playback error. Skipping to next song...");
              setTimeout(() => {
                if (isMountedRef.current) next();
              }, 1500);
            }
          },
        },
      });
    }

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };

      if (!document.getElementById("youtube-iframe-api-script")) {
        const tag = document.createElement("script");
        tag.id = "youtube-iframe-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
    }

    // Progress polling loop
    intervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (player && isReadyRef.current && typeof player.getCurrentTime === "function") {
        try {
          const currentTime = player.getCurrentTime() || 0;
          const duration = player.getDuration() || 0;
          if (!seekLock.current && duration > 0) {
            setProgress(currentTime, duration);
          }
        } catch {
          // Player not ready
        }
      }
    }, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [next, setPlaying, setProgress, setPlayError]);

  // Handle Track Change
  useEffect(() => {
    if (!currentTrack) return;
    setPlayError(null);

    const player = playerRef.current;
    if (player && isReadyRef.current && typeof player.loadVideoById === "function") {
      try {
        if (currentVideoIdRef.current !== currentTrack.videoId) {
          currentVideoIdRef.current = currentTrack.videoId;
          player.loadVideoById(currentTrack.videoId);
        }
      } catch (err) {
        console.warn("[Geekify Player] Track change error:", err);
      }
    }

    // Autoplay related queue recommendations
    const q = usePlayerStore.getState().queue;
    if (q.length <= 1 && currentTrack) {
      api
        .related(currentTrack.videoId)
        .then((rel) => {
          if (usePlayerStore.getState().currentTrack?.videoId !== currentTrack.videoId) return;
          if (!rel.length) return;
          usePlayerStore.setState({
            queue: [currentTrack, ...rel.filter((t) => t.videoId !== currentTrack.videoId)],
            queueIndex: 0,
          });
        })
        .catch(() => undefined);
    }
  }, [currentTrack?.videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Play/Pause
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReadyRef.current || !currentTrack) return;

    try {
      if (isPlaying) {
        if (typeof player.playVideo === "function") {
          player.playVideo();
        }
      } else {
        if (typeof player.pauseVideo === "function") {
          player.pauseVideo();
        }
      }
    } catch (err) {
      console.warn("[Geekify Player] Play/pause error:", err);
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Volume & Mute
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReadyRef.current) return;
    try {
      if (typeof player.setVolume === "function") {
        player.setVolume(Math.round(volume * 100));
      }
      if (muted && typeof player.mute === "function") {
        player.mute();
      } else if (!muted && typeof player.unMute === "function") {
        player.unMute();
      }
    } catch {
      // Ignore
    }
  }, [volume, muted]);

  // Handle Seek
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReadyRef.current || typeof player.getCurrentTime !== "function") return;
    try {
      const cur = player.getCurrentTime() || 0;
      if (Math.abs(cur - progress) > 2) {
        seekLock.current = true;
        if (typeof player.seekTo === "function") {
          player.seekTo(progress, true);
        }
        window.setTimeout(() => {
          seekLock.current = false;
        }, 350);
      }
    } catch {
      // Ignore
    }
  }, [progress]);

  // MediaSession API integration
  useEffect(() => {
    const track = currentTrack;
    if (!track || !("mediaSession" in navigator)) return;
    const art = track.thumbnails?.[track.thumbnails.length - 1]?.url;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || "Geekify",
      artwork: art ? [{ src: art, sizes: "512x512", type: "image/jpeg" }] : [],
    });
    navigator.mediaSession.setActionHandler("play", () => usePlayerStore.getState().setPlaying(true));
    navigator.mediaSession.setActionHandler("pause", () => usePlayerStore.getState().setPlaying(false));
    navigator.mediaSession.setActionHandler("previoustrack", () => previous());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("seekto", (d) => {
      if (typeof d.seekTime === "number") usePlayerStore.getState().seek(d.seekTime);
    });
  }, [currentTrack, next, previous]);

  // Equalizer visualizer wave animation loop
  useEffect(() => {
    let step = 0;
    const loop = () => {
      step += 0.08;
      const playing = usePlayerStore.getState().isPlaying;
      if (!playing) {
        setAnalyserBins([0.15, 0.2, 0.25, 0.2, 0.15]);
        return;
      }

      const bins = [
        0.3 + 0.4 * Math.abs(Math.sin(step)),
        0.4 + 0.5 * Math.abs(Math.sin(step * 1.3 + 1)),
        0.5 + 0.5 * Math.abs(Math.cos(step * 0.9 + 2)),
        0.35 + 0.45 * Math.abs(Math.sin(step * 1.5 + 3)),
        0.25 + 0.35 * Math.abs(Math.cos(step * 1.1 + 4)),
      ];

      setAnalyserBins(bins);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [setAnalyserBins]);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const s = usePlayerStore.getState();
      if (e.code === "Space") {
        e.preventDefault();
        s.togglePlay();
      } else if (e.code === "ArrowRight") {
        s.seek(Math.min((s.duration || 0), s.progress + 5));
      } else if (e.code === "ArrowLeft") {
        s.seek(Math.max(0, s.progress - 5));
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        s.setVolume(Math.min(1, s.volume + 0.05));
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        s.setVolume(Math.max(0, s.volume - 0.05));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        bottom: "-500px",
        right: "-500px",
        width: "200px",
        height: "200px",
        zIndex: -999,
        pointerEvents: "none",
      }}
    />
  );
}
