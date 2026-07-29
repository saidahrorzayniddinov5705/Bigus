import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { CheckCircle2, ScanFace, Loader2, X, Hand } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
// @ts-ignore
import * as tf from '@tensorflow/tfjs';
// @ts-ignore
import * as handpose from '@tensorflow-models/handpose';

interface CameraCheckProps {
  onVerify: (success: boolean) => void;
  onClose: () => void;
}

export default function CameraCheck({ onVerify, onClose }: CameraCheckProps) {
  const { t } = useLanguage();
  const webcamRef = useRef<Webcam>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'analyzing' | 'success' | 'failed'>('loading');
  const [verificationProgress, setVerificationProgress] = useState(0);
  
  const requestRef = useRef<number>();
  const successReported = useRef(false);
  const consecutiveFrames = useRef(0);

  useEffect(() => {
    let isMounted = true;
    const maxFrames = 30; // Approx 1 second
    
    const loadModelAndDetect = async () => {
      try {
        await tf.ready();
        const net = await handpose.load();
        if (isMounted) {
          setIsModelLoaded(true);
          setVerificationStatus('analyzing');
          detect(net);
        }
      } catch (e) {
        console.error("Failed to load handpose model:", e);
      }
    };

    const detect = async (net: any) => {
      if (successReported.current) return;
      
      if (
        webcamRef.current &&
        webcamRef.current.video &&
        webcamRef.current.video.readyState === 4
      ) {
        const video = webcamRef.current.video as HTMLVideoElement;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        video.width = videoWidth;
        video.height = videoHeight;

        try {
          const hand = await net.estimateHands(video);

          let isOkGesture = false;

          if (hand.length > 0) {
            const landmarks = hand[0].landmarks;
            const dist = (p1: number[], p2: number[]) => Math.sqrt(Math.pow(p1[0]-p2[0], 2) + Math.pow(p1[1]-p2[1], 2));
            
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const middleTip = landmarks[12];
            const ringTip = landmarks[16];
            const pinkyTip = landmarks[20];
            const wrist = landmarks[0];
            const indexMcp = landmarks[5];

            const circleSize = dist(thumbTip, indexTip);
            const handSize = dist(wrist, indexMcp) * 2; // Approximate full hand length

            // Stricter OK Gesture logic
            const isCircle = circleSize < handSize * 0.25; // Must be close together
            const midExtended = dist(middleTip, wrist) > handSize * 0.7;
            const ringExtended = dist(ringTip, wrist) > handSize * 0.65;
            const pinkyExtended = dist(pinkyTip, wrist) > handSize * 0.6;
            
            if (handSize > 20 && isCircle && midExtended && ringExtended && pinkyExtended) {
              isOkGesture = true;
            }
          }
          
          if (isOkGesture) {
            consecutiveFrames.current += 1;
            if (isMounted) {
              setVerificationProgress(Math.min(100, (consecutiveFrames.current / maxFrames) * 100));
            }
            
            if (consecutiveFrames.current >= maxFrames) {
              successReported.current = true;
              if (isMounted) {
                setVerificationStatus('success');
                setTimeout(() => {
                  onVerify(true);
                }, 1500);
              }
              return;
            }
          } else {
            if (consecutiveFrames.current > 0) {
              consecutiveFrames.current = Math.max(0, consecutiveFrames.current - 2); // gradual decay
              if (isMounted) {
                setVerificationProgress(Math.min(100, (consecutiveFrames.current / maxFrames) * 100));
              }
            }
          }
        } catch (e) {
          // ignore detection errors
        }
      }
      
      if (!successReported.current && isMounted) {
        // Debounce to improve performance, 100ms between frames (~10 fps)
        requestRef.current = window.setTimeout(() => detect(net), 100) as unknown as number;
      }
    };

    loadModelAndDetect();

    return () => {
      isMounted = false;
      if (requestRef.current) {
        window.clearTimeout(requestRef.current);
      }
    };
  }, [onVerify]);

  const forceVerify = () => {
    successReported.current = true;
    setVerificationStatus('success');
    setTimeout(() => {
      onVerify(true);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#1C1C1E] rounded-3xl overflow-hidden border border-white/10 relative shadow-2xl flex flex-col">
        <div className="p-4 flex justify-between items-center border-b border-white/10">
           <h3 className="text-white font-bold text-lg flex items-center gap-2"><ScanFace className="w-5 h-5 text-cyan-400"/> {t('cameraTaskTitle')}</h3>
           <button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white/70 hover:text-white transition"><X className="w-5 h-5"/></button>
        </div>
        
        <div className="relative w-full aspect-[3/4] bg-black">
          {verificationStatus !== 'success' && (
            <>
              {/* @ts-ignore */}
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </>
          )}

          {verificationStatus === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
               <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
               <p className="text-blue-400 font-medium text-center px-4">{t('cameraLoadingModel')}</p>
            </div>
          )}

          {verificationStatus === 'analyzing' && (
            <>
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 z-10">
                 <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                 <p className="text-white/90 font-medium text-sm">{t('cameraAnalyzing')}</p>
              </div>
              
              <div className="absolute bottom-6 left-6 right-6">
                 <div className="bg-black/60 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-xl">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold text-white/80 uppercase tracking-widest">{t('cameraVerifyBtn') || 'Verification'}</span>
                     <span className="text-xs font-mono font-bold text-cyan-400">{Math.round(verificationProgress)}%</span>
                   </div>
                   <div className="h-2.5 w-full bg-black/50 rounded-full overflow-hidden shadow-inner border border-white/5">
                     <div 
                       className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-75"
                       style={{ width: `${verificationProgress}%` }}
                     />
                   </div>
                 </div>
              </div>
            </>
          )}

          {verificationStatus === 'success' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/20 backdrop-blur-md">
               <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
               <p className="text-emerald-400 font-bold text-xl">{t('cameraVerified')}</p>
               <p className="text-emerald-400/80 font-bold">{t('cameraCoins')}</p>
            </div>
          )}
        </div>

        {verificationStatus !== 'success' && (
          <div className="p-6 bg-[#1C1C1E]">
            <p className="text-white/70 text-sm text-center mb-6">{t('cameraInstruction')}</p>
            <button 
              onClick={forceVerify}
              className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/80 font-bold rounded-2xl border border-white/10 active:scale-95 transition-all text-sm"
            >
              {t('cameraManualVerify')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
