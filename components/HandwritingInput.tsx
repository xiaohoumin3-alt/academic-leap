import React, { useState, useRef, useCallback } from 'react';
import { Camera, RotateCcw, Check, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface HandwritingInputProps {
  onRecognized: (text: string, expressions: string[]) => void;
  onClose: () => void;
}

const HandwritingInput: React.FC<HandwritingInputProps> = ({ onRecognized, onClose }) => {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ text: string; expressions: string[] } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // 启动摄像头
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('无法访问摄像头:', error);
      alert('无法访问摄像头，请检查权限设置');
    }
  }, [facingMode]);

  // 停止摄像头
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // 拍照
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/png');
    setImage(imageData);

    stopCamera();
  }, [stopCamera]);

  // 重新拍照
  const retakePhoto = useCallback(() => {
    setImage(null);
    setResult(null);
    startCamera();
  }, [startCamera]);

  // 识别手写内容
  const recognizeImage = useCallback(async () => {
    if (!image) return;

    setIsProcessing(true);

    try {
      const response = await fetch('/api/ocr/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          text: data.data.text,
          expressions: data.data.expressions,
        });
      } else {
        throw new Error(data.error || '识别失败');
      }
    } catch (error) {
      console.error('OCR识别失败:', error);
      alert('识别失败，请重试');
      retakePhoto();
    } finally {
      setIsProcessing(false);
    }
  }, [image, retakePhoto]);

  // 确认使用识别结果
  const confirmResult = useCallback(() => {
    if (result) {
      onRecognized(result.text, result.expressions);
      onClose();
    }
  }, [result, onRecognized, onClose]);

  // 切换摄像头
  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  // 组件挂载时启动摄像头
  React.useEffect(() => {
    if (!image && !result) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [image, result, startCamera, stopCamera]);

  // 摄像头方向变化时重启
  React.useEffect(() => {
    if (!image && !result) {
      stopCamera();
      startCamera();
    }
  }, [facingMode, image, result, startCamera, stopCamera]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
    >
      <div className="bg-surface rounded-[2rem] max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/10">
          <h3 className="font-display font-bold text-on-surface text-lg">手写识别</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {/* Camera/Image Preview */}
        <div className="relative aspect-[4/3] bg-black">
          {image ? (
            <img
              src={image}
              alt="Captured"
              className="w-full h-full object-contain"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* 扫描框 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-40 border-2 border-primary/70 rounded-lg relative">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary" />
                </div>
              </div>
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Actions */}
        <div className="p-6 space-y-4">
          {/* Result Display */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-container-low rounded-2xl p-4"
            >
              <p className="text-sm text-on-surface-variant mb-2">识别结果:</p>
              <p className="font-mono text-on-surface">{result.text}</p>
              {result.expressions.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-on-surface-variant mb-1">提取的表达式:</p>
                  {result.expressions.map((expr, i) => (
                    <code key={i} className="block text-xs bg-surface rounded px-2 py-1 mt-1">
                      {expr}
                    </code>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            {image ? (
              <>
                <button
                  onClick={retakePhoto}
                  disabled={isProcessing}
                  className="flex-1 py-4 rounded-full bg-surface-container-highest text-on-surface font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  重拍
                </button>

                {result ? (
                  <button
                    onClick={confirmResult}
                    className="flex-1 py-4 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Check className="w-5 h-5" />
                    确认
                  </button>
                ) : (
                  <button
                    onClick={recognizeImage}
                    disabled={isProcessing}
                    className="flex-1 py-4 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        识别中...
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5" />
                        识别
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={toggleCamera}
                  className="py-4 px-6 rounded-full bg-surface-container-highest text-on-surface font-bold active:scale-95 transition-all"
                >
                  切换
                </button>
                <button
                  onClick={capturePhoto}
                  className="flex-1 py-4 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Camera className="w-5 h-5" />
                  拍照
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HandwritingInput;
