"use client";

import { useEffect, useRef } from "react";
import { api, streamUrl } from "@/lib/api";
import { usePlayerStore } from "@/store/usePlayerStore";

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const seekLock = useRef(false);
  const rafRef = useRef<number>(0);
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
  const setAnalyserBins = usePlayerStore((s) => s.setAnalyserBins);

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
    };
    const onPause = () => setPlaying(false);
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

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onErr);
    };
  }, [next, setPlaying, setProgress, setPlayError]);

  // Handle Track Changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    setPlayError(null);
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

  // Equalizer visualizer wave animation loop (restarts whenever playback toggles)
  useEffect(() => {
    if (!isPlaying) {
      setAnalyserBins([0.15, 0.2, 0.25, 0.2, 0.15]);
      return;
    }
    let step = 0;
    const loop = () => {
      step += 0.08;

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
  }, [isPlaying, setAnalyserBins]);

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
