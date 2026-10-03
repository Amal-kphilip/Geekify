"use client";

import { useEffect, useRef } from "react";
import { api, prewarmStream, streamUrl } from "@/lib/api";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useHistoryStore } from "@/store/useHistoryStore";

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const seekLock = useRef(false);
  const retriedRef = useRef<string | null>(null);

  // Ask the backend why a stream failed so the UI can show the real reason.
  const explainFailure = async (videoId: string): Promise<string> => {
    try {
      const res = await fetch(streamUrl(videoId), { headers: { Range: "bytes=0-0" }, cache: "no-store" });
      if (res.ok) return "The browser could not decode this audio stream.";
      const body = await res.json().catch(() => null);
      const d = body?.detail;
      return (typeof d === "string" ? d : d?.reason) || `Stream request failed (HTTP ${res.status}).`;
    } catch {
      return "Cannot reach the backend. Is it running on port 8000?";
    }
  };

  const handlePlayFailure = (err: unknown) => {
    const e = err as { name?: string };
    if (e?.name === "AbortError") return; // superseded by a newer load/pause
    const track = usePlayerStore.getState().currentTrack;
    if (e?.name === "NotAllowedError") {
      setPlayError("Browser blocked autoplay. Press play to start.");
      return;
    }
    // NotSupportedError etc. => the source failed to load; find out why.
    if (track) {
      void explainFailure(track.videoId).then((msg) => {
        if (usePlayerStore.getState().currentTrack?.videoId === track.videoId) setPlayError(msg);
      });
    }
  };

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
  const setBuffering = usePlayerStore((s) => s.setBuffering);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const prewarmedRef = useRef<Set<string>>(new Set());

  // Audio element event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      if (!seekLock.current && audio.duration) {
        setProgress(audio.currentTime, audio.duration);
      }
    };
    const onEnded = () => next();
    const onPlay = () => {
      setPlaying(true);
      setPlayError(null);
      const t = usePlayerStore.getState().currentTrack;
      if (t) useHistoryStore.getState().add(t);
    };
    const onPause = () => setPlaying(false);
    const onBufferStart = () => setBuffering(true);
    const onBufferEnd = () => setBuffering(false);
    const onErr = () => {
      const track = usePlayerStore.getState().currentTrack;
      // Stream URLs expire; retry once with a fresh resolve before giving up.
      if (track && retriedRef.current !== track.videoId) {
        retriedRef.current = track.videoId;
        audio.src = `${streamUrl(track.videoId)}?retry=${Date.now()}`;
        audio.load();
        if (usePlayerStore.getState().isPlaying) {
          audio.play().catch(() => undefined);
        }
        return;
      }
      setBuffering(false);
      const t = usePlayerStore.getState().currentTrack;
      if (!t) return;
      void explainFailure(t.videoId).then((msg) => {
        if (usePlayerStore.getState().currentTrack?.videoId === t.videoId) setPlayError(msg);
      });
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onErr);
    audio.addEventListener("waiting", onBufferStart);
    audio.addEventListener("loadstart", onBufferStart);
    audio.addEventListener("playing", onBufferEnd);
    audio.addEventListener("canplay", onBufferEnd);

    return () => {
      audio.removeEventListener("waiting", onBufferStart);
      audio.removeEventListener("loadstart", onBufferStart);
      audio.removeEventListener("playing", onBufferEnd);
      audio.removeEventListener("canplay", onBufferEnd);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onErr);
    };
  }, [next, setPlaying, setProgress, setPlayError, setBuffering]);

  // Handle Track Changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    setPlayError(null);
    setBuffering(true);
    retriedRef.current = null;
    audio.src = streamUrl(currentTrack.videoId);
    audio.load();

    if (isPlaying) {
      const p = audio.play();
      if (p !== undefined) {
        playPromiseRef.current = p;
        p.catch(handlePlayFailure);
      }
    }

    // Autoplay queue recommendations
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

  // Prewarm the next tracks: the backend resolves their stream URLs (slow yt-dlp step)
  // while the current song plays, so skipping / auto-advance starts almost instantly.
  useEffect(() => {
    if (!currentTrack || isBuffering || !queue.length) return;
    const ids: string[] = [];
    if (shuffle) {
      // Unpredictable order: warm a couple of random upcoming candidates.
      const others = queue.filter((t) => t.videoId !== currentTrack.videoId);
      for (let i = 0; i < Math.min(2, others.length); i++) {
        ids.push(others[Math.floor(Math.random() * others.length)].videoId);
      }
    } else {
      for (let i = 1; i <= 2; i++) {
        const t = queue[queueIndex + i];
        if (t) ids.push(t.videoId);
      }
    }
    const fresh = ids.filter((id) => !prewarmedRef.current.has(id));
    if (!fresh.length) return;
    // Let the current track start first so we don't compete with it for the backend.
    const timer = window.setTimeout(() => {
      fresh.forEach((id, i) => {
        prewarmedRef.current.add(id);
        window.setTimeout(() => prewarmStream(id), i * 1500);
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [currentTrack, isBuffering, queue, queueIndex, shuffle]);

  // Handle Play/Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      const p = audio.play();
      if (p !== undefined) {
        playPromiseRef.current = p;
        p.catch(handlePlayFailure);
      }
    } else {
      if (playPromiseRef.current) {
        playPromiseRef.current
          .then(() => audio.pause())
          .catch(() => audio.pause());
      } else {
        audio.pause();
      }
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Volume & Mute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  // Handle Seek
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Math.abs(audio.currentTime - progress) > 1.5) {
      seekLock.current = true;
      audio.currentTime = progress;
      window.setTimeout(() => {
        seekLock.current = false;
      }, 250);
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

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // A focused button already handles Space/Enter itself; don't double-toggle.
      if (tag === "BUTTON" && (e.code === "Space" || e.code === "Enter")) return;
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
    <audio
      ref={audioRef}
      preload="auto"
      className="hidden"
    />
  );
}
