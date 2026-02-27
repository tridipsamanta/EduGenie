import React, { useEffect, useRef, useState } from "react";
import { SignInButton, SignUpButton, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mapRange(value: number, input: number[], output: number[]) {
  if (input.length !== output.length || input.length === 0) {
    return output[0] || 0;
  }

  if (value <= input[0]) return output[0];
  if (value >= input[input.length - 1]) return output[output.length - 1];

  for (let index = 0; index < input.length - 1; index += 1) {
    const start = input[index];
    const end = input[index + 1];
    if (value >= start && value <= end) {
      const progress = (value - start) / (end - start || 1);
      return output[index] + (output[index + 1] - output[index]) * progress;
    }
  }

  return output[output.length - 1];
}

export default function ScrollyTutor() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const TOTAL_FRAMES = 82;

  useEffect(() => {
    const updateProgress = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const totalScrollable = Math.max(1, rect.height - viewportHeight);
      const scrolled = Math.max(0, -rect.top);
      const progress = clamp01(scrolled / totalScrollable);
      setScrollProgress(progress);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  useEffect(() => {
    // Preload all images
    const loadImages = async () => {
      const loadedImages: HTMLImageElement[] = [];
      let loadedCount = 0;

      for (let i = 1; i <= TOTAL_FRAMES; i++) {
        const img = new Image();
        // The images are stored in public/Robot/
        // Naming convention: ezgif-frame-001.png
        const frameNumber = i.toString().padStart(3, "0");
        img.src = `/Robot/ezgif-frame-${frameNumber}.png`;

        img.onload = () => {
          loadedCount++;
          if (loadedCount === TOTAL_FRAMES) {
            setImages(loadedImages);
            setImagesLoaded(true);
          }
        };
        img.onerror = () => {
          loadedCount++;
          if (loadedCount === TOTAL_FRAMES) {
            setImages(loadedImages.filter((loadedImage) => loadedImage.complete && loadedImage.naturalWidth > 0));
            setImagesLoaded(true);
          }
        };
        loadedImages.push(img);
      }
    };

    loadImages();
  }, []);

  useEffect(() => {
    if (!imagesLoaded || !canvasRef.current || images.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Helper to draw an image covering the canvas (contain or cover fit)
    const drawImage = (index: number) => {
      const img = images[index];
      if (!img) return;

      // Ensure canvas internal resolution matches display size natively
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // We want to "contain" or "cover" the image. Let's do a smooth cover/contain fit
      // Since it's a product render, contain is usually better to prevent clipping
      const hRatio = canvas.width / img.width;
      const vRatio = canvas.height / img.height;

      // Use Math.min for contain, Math.max for cover
      const ratio = Math.max(hRatio, vRatio); // Cover mode usually looks best for full bleed backgrounds

      const centerShift_x = (canvas.width - img.width * ratio) / 2;
      const centerShift_y = (canvas.height - img.height * ratio) / 2;

      // Artificial Enhancement via Canvas API
      // Since it's a dark background image, we can try to improve perceived sharpness
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        img,
        0, 0, img.width, img.height,
        centerShift_x, centerShift_y, img.width * ratio, img.height * ratio
      );
    };

    const drawIndex = Math.min(
      Math.max(0, Math.round(scrollProgress * (TOTAL_FRAMES - 1))),
      images.length - 1
    );
    drawImage(drawIndex);
  }, [imagesLoaded, images, scrollProgress]);

  const text1Opacity = mapRange(scrollProgress, [0, 0.18, 0.26], [1, 1, 0]);
  const text1Y = mapRange(scrollProgress, [0, 0.18, 0.26], [0, 0, -30]);

  const text2Opacity = mapRange(scrollProgress, [0.22, 0.3, 0.46, 0.56], [0, 1, 1, 0]);
  const text2Y = mapRange(scrollProgress, [0.22, 0.34, 0.56], [30, 0, -30]);

  const text3Opacity = mapRange(scrollProgress, [0.52, 0.6, 0.76, 0.86], [0, 1, 1, 0]);
  const text3Y = mapRange(scrollProgress, [0.52, 0.64, 0.86], [30, 0, -30]);

  const text4Opacity = mapRange(scrollProgress, [0.82, 0.9, 1], [0, 1, 1]);
  const text4Y = mapRange(scrollProgress, [0.82, 0.92], [30, 0]);

  const orb1Y = mapRange(scrollProgress, [0, 1], [0, 300]);
  const orb1X = mapRange(scrollProgress, [0, 1], [0, 150]);
  const orb2Y = mapRange(scrollProgress, [0, 1], [0, -300]);
  const orb2X = mapRange(scrollProgress, [0, 1], [0, -150]);
  const sideGradientLeftX = mapRange(scrollProgress, [0, 1], [-20, 30]);
  const sideGradientLeftY = mapRange(scrollProgress, [0, 1], [0, 45]);
  const sideGradientRightX = mapRange(scrollProgress, [0, 1], [20, -30]);
  const sideGradientRightY = mapRange(scrollProgress, [0, 1], [0, -40]);


  return (
    <div ref={containerRef} className="relative h-[400vh] bg-[#030303] w-full">
      {/* Sticky Background & Canvas Container */}
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-[#030303]">

        {!imagesLoaded && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#030303]">
            <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-indigo-500/60"></div>
          </div>
        )}

        {/* Subtle radial center piece */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-transparent to-transparent opacity-60" />

        {/* Animated side gradients */}
        <div
          style={{ transform: `translate3d(${sideGradientLeftX}px, ${sideGradientLeftY}px, 0)` }}
          className="absolute -left-[22%] top-[8%] h-[70vh] w-[52vw] max-w-[720px] rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/20 via-violet-500/8 to-transparent blur-3xl pointer-events-none"
        />
        <div
          style={{ transform: `translate3d(${sideGradientRightX}px, ${sideGradientRightY}px, 0)` }}
          className="absolute -right-[22%] top-[12%] h-[70vh] w-[52vw] max-w-[720px] rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-violet-500/20 via-indigo-500/8 to-transparent blur-3xl pointer-events-none"
        />

        {/* Premium Animated Glowing Orbs */}
        <div
          style={{ transform: `translate3d(${orb1X}px, ${orb1Y}px, 0)` }}
          className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-indigo-600/30 rounded-full blur-[100px] pointer-events-none"
        />
        <div
          style={{ transform: `translate3d(${orb2X}px, ${orb2Y}px, 0)` }}
          className="absolute -bottom-[10%] -right-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-violet-600/20 rounded-full blur-[100px] pointer-events-none"
        />

        {/* Embedded Canvas */}
        <canvas
          ref={canvasRef}
          // The CSS filters: contrast(110%) saturate(110%) brightness(105%) to artificially bump quality
          // mix-blend-screen totally knocks out the pure black of the JPEGs! It leaves only the glowing product!
          className="absolute inset-0 h-full w-full object-cover contrast-125 saturate-110 brightness-105 filter mix-blend-screen"
        />

        {/* Text Overlays positioned absolutely over the sticky canvas area */}
        <div className="absolute inset-0 z-10 w-full h-full pointer-events-none">

          {/* 0% Scroll: Top Left Intro */}
          <div
            style={{ opacity: text1Opacity, transform: `translateY(${text1Y}px)` }}
            className="absolute top-32 left-8 md:top-40 md:left-24 max-w-xl pr-6"
          >
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.1] text-white/90 drop-shadow-2xl">
              Meet EduGenie.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 py-1 block">Your AI Study Partner.</span>
            </h1>
          </div>

          {/* 30% Scroll: Top Left Features */}
          <div
            style={{ opacity: text2Opacity, transform: `translateY(${text2Y}px)` }}
            className="absolute top-32 left-8 md:top-40 md:left-24 max-w-xl pr-6"
          >
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight leading-[1.1] text-white/90 drop-shadow-xl">
              Upload Your Notes. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 py-1 block mt-2">Generate Quizzes Instantly.</span>
            </h2>
          </div>

          {/* 60% Scroll: Bottom Left Insights */}
          <div
            style={{ opacity: text3Opacity, transform: `translateY(${text3Y}px)` }}
            className="absolute bottom-32 left-8 md:bottom-40 md:left-24 max-w-lg pr-6"
          >
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight leading-[1.1] text-white/90 drop-shadow-xl">
              Master Weak Topics,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 py-1 block mt-2">Acing Exams Faster.</span>
            </h2>
          </div>

          {/* 90% Scroll: Top Left Final CTA */}
          <div
            style={{ opacity: text4Opacity, transform: `translateY(${text4Y}px)` }}
            className="absolute top-32 left-8 md:top-40 md:left-24 max-w-xl pr-6 pointer-events-auto"
          >
            <h2 className="text-2xl md:text-4xl font-medium leading-[1.3] tracking-tight text-white/90 mb-6 drop-shadow-xl">
              Everything you need to excel, <br className="hidden md:block" />
              <span className="text-white/70 block mt-1">all in one intelligent platform.</span>
            </h2>

            {/* Dynamic CTA */}
            <div className="flex items-start">
              {isSignedIn ? (
                <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-lg px-8 h-12 rounded-full shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] transition-transform hover:scale-105" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              ) : (
                <SignUpButton mode="modal" forceRedirectUrl="/dashboard" signInForceRedirectUrl="/dashboard">
                  <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-lg px-8 h-12 rounded-full shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] transition-transform hover:scale-105">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </SignUpButton>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
