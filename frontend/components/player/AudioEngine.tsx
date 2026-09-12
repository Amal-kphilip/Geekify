"use client";

import { useEffect, useRef } from "react";
import { api, streamUrl } from "@/lib/api";
import { usePlayerStore } from "@/store/usePlayerStore";

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const seekLock = useRef(false);

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
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      if (!seekLock.current) setProgress(audio.currentTime, audio.duration || 0);
    };
    const onEnded = () => next();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onErr = () => {
      setPlayError("This track could not be streamed. It may be region-locked, age-restricted, or removed.");
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

  const playPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    
    setPlayError(null);
    audio.src = streamUrl(currentTrack.videoId);
    audio.load();

    if (isPlaying) {
      ensureGraph();
      const p = audio.play();
      if (p !== undefined) {
        playPromiseRef.current = p;
        p.catch((err) => {
          if (err.name !== "AbortError") {
            setPlayError("Click play to start audio.");
          }
        });
      }
    }

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) {
      ensureGraph();
      const p = audio.play();
      if (p !== undefined) {
        playPromiseRef.current = p;
        p.catch((err) => {
          if (err.name !== "AbortError") {
            setPlayError("Click play to start audio.");
          }
        });
      }
    } else {
      if (playPromiseRef.current) {
        playPromiseRef.current
          .then(() => {
            audio.pause();
          })
          .catch(() => {
            audio.pause();
          });
      } else {
        audio.pause();
      }
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

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

  function ensureGraph() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (!ctxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;
        if (!sourceRef.current) {
          sourceRef.current = ctx.createMediaElementSource(audio);
          sourceRef.current.connect(analyser);
          analyser.connect(ctx.destination);
        }
      }
      if (ctxRef.current && ctxRef.current.state === "suspended") {
        ctxRef.current.resume().catch(() => undefined);
      }
    } catch {
      // Fallback to simulated bins if Web Audio MediaElementSource is restricted
    }
    tick();
  }

  function tick() {
    const analyser = analyserRef.current;
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let step = 0;

    const loop = () => {
      step += 0.08;
      const playing = usePlayerStore.getState().isPlaying;
      if (!playing) {
        setAnalyserBins([0.15, 0.2, 0.25, 0.2, 0.15]);
        return;
      }

      let bins: number[] = [];
      let hasSignal = false;

      if (analyser && data) {
        analyser.getByteFrequencyData(data);
        const bands = 5;
        const slice = Math.max(1, Math.floor(data.length / bands));
        for (let i = 0; i < bands; i++) {
          let sum = 0;
          for (let j = 0; j < slice; j++) sum += data[i * slice + j] || 0;
          const val = Math.min(1, sum / slice / 180);
          if (val > 0.05) hasSignal = true;
          bins.push(val);
        }
      }

      if (!hasSignal && playing) {
        // Dynamic simulated wave when playing
        bins = [
          0.3 + 0.4 * Math.abs(Math.sin(step)),
          0.4 + 0.5 * Math.abs(Math.sin(step * 1.3 + 1)),
          0.5 + 0.5 * Math.abs(Math.cos(step * 0.9 + 2)),
          0.35 + 0.45 * Math.abs(Math.sin(step * 1.5 + 3)),
          0.25 + 0.35 * Math.abs(Math.cos(step * 1.1 + 4)),
        ];
      }

      setAnalyserBins(bins);
      rafRef.current = requestAnimationFrame(loop);
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }

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
        s.setVolume(s.volume + 0.05);
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        s.setVolume(s.volume - 0.05);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <audio
      ref={audioRef}
      preload="metadata"
      crossOrigin="anonymous"
      className="hidden"
    />
  );
}
