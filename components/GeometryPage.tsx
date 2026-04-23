import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import MaterialIcon from './MaterialIcon';

interface GeometryPageProps {
  onBack: () => void;
  onFinish: (results: any) => void;
}

interface Point {
  x: number;
  y: number;
}

interface Line {
  start: Point;
  end: Point;
}

interface GeometryProblem {
  id: string;
  title: string;
  question: string;
  imageUrl?: string;
  shapes: string[]; // SVG paths for shapes
  auxiliaryLines: Line[];
  answerType: 'angle' | 'length' | 'text';
}

const GeometryPage: React.FC<GeometryPageProps> = ({ onBack, onFinish }) => {
  const [showAuxiliary, setShowAuxiliary] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [answer, setAnswer] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  // 示例几何问题
  const problem: GeometryProblem = {
    id: 'geo1',
    title: '求角度',
    question: '如图，在△ABC中，已知∠A = 45°，∠B = 60°，求∠C的度数。',
    shapes: ['triangle'],
    auxiliaryLines: [
      { start: { x: 100, y: 150 }, end: { x: 250, y: 50 } },
      { start: { x: 250, y: 50 }, end: { x: 350, y: 180 } },
    ],
    answerType: 'angle',
  };

  const canvasRef = useRef<SVGSVGElement>(null);

  const handleCheck = () => {
    // 简单验证
    if (answer === '75' || answer === '75°') {
      if (currentStep < 3) {
        setCurrentStep(prev => prev + 1);
        setAnswer('');
      } else {
        onFinish({
          score: 85,
          completed: true,
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-surface border-b border-outline-variant/10">
        <button
          onClick={onBack}
          className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
        >
          <MaterialIcon icon="arrow_back" className="text-on-surface-variant" style={{ fontSize: '24px' }} />
        </button>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-primary-container rounded-full">
            <span className="text-sm font-bold text-on-primary-container">
              步骤 {currentStep} / 3
            </span>
          </div>
        </div>

        <div className="w-10" />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Canvas Area */}
        <div className="flex-1 p-6 bg-surface-container-low/30">
          <div className="bg-white rounded-3xl shadow-inner h-full relative overflow-hidden border-2 border-outline-variant/10">
            {/* SVG Canvas */}
            <svg
              ref={canvasRef}
              viewBox="0 0 400 300"
              className="w-full h-full"
              style={{
                background: showGrid ? `
                  linear-gradient(to right, #f0f0f0 1px, transparent 1px),
                  linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
                ` : 'white',
                backgroundSize: '20px 20px'
              }}
            >
              {/* Grid */}
              {showGrid && (
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e0e0" strokeWidth="0.5"/>
                  </pattern>
                </defs>
              )}
              <rect width="100%" height="100%" fill={showGrid ? "url(#grid)" : "white"} />

              {/* Triangle */}
              <polygon
                points="100,150 250,50 350,180"
                fill="rgba(0, 166, 120, 0.1)"
                stroke="#00a678"
                strokeWidth="2"
              />

              {/* Vertex labels */}
              <text x="80" y="160" fontSize="14" fill="#00a678" fontWeight="bold">A</text>
              <text x="245" y="40" fontSize="14" fill="#00a678" fontWeight="bold">B</text>
              <text x="360" y="180" fontSize="14" fill="#00a678" fontWeight="bold">C</text>

              {/* Angle markers */}
              <path d="M 130 140 A 30 30 0 0 1 235 65" fill="rgba(0, 166, 120, 0.2)" stroke="#00a678" strokeWidth="1.5" />
              <text x="165" y="115" fontSize="12" fill="#00a678">45°</text>

              {/* Auxiliary lines */}
              {showAuxiliary && (
                <>
                  <line x1="100" y1="150" x2="250" y2="230" stroke="#ff6b6b" strokeWidth="2" strokeDasharray="8,4" />
                  <text x="160" y="210" fontSize="12" fill="#ff6b6b">辅助线</text>
                </>
              )}
            </svg>

            {/* Canvas toolbar */}
            <div className="absolute bottom-4 left-4 flex gap-2">
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={cn(
                  "p-2 rounded-xl transition-colors",
                  showGrid ? "bg-primary text-on-primary" : "bg-white text-on-surface shadow-md"
                )}
              >
                <MaterialIcon icon="grid_on" className="" style={{ fontSize: '20px' }} />
              </button>
              <button
                onClick={() => setShowAuxiliary(!showAuxiliary)}
                className={cn(
                  "p-2 rounded-xl transition-colors shadow-md",
                  showAuxiliary ? "bg-error text-on-error" : "bg-white text-on-surface"
                )}
              >
                <MaterialIcon icon="show_chart" className="" style={{ fontSize: '20px' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="w-full md:w-80 p-6 bg-surface border-l border-outline-variant/10 space-y-6 overflow-y-auto">
          {/* Question */}
          <div>
            <h3 className="text-lg font-display font-bold text-on-surface mb-3">{problem.title}</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">{problem.question}</p>
          </div>

          {/* Auxiliary Line Toggle */}
          <div className="bg-surface-container-low rounded-2xl p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-bold text-on-surface">显示辅助线</span>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAuxiliary(!showAuxiliary);
                }}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  showAuxiliary ? "bg-primary" : "bg-surface-variant"
                )}
              >
                <motion.div
                  animate={{ x: showAuxiliary ? 24 : 4 }}
                  className="absolute top-1 w-4 h-4 rounded-full bg-surface"
                />
              </div>
            </label>
          </div>

          {/* Answer Input */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-on-surface">答案</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="输入度数"
                className="flex-1 px-4 py-3 bg-surface-container border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none transition-colors"
              />
              <span className="flex items-center text-on-surface-variant font-bold">°</span>
            </div>
          </div>

          {/* Quick Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {['30°', '45°', '60°', '75°', '90°', '120°', '135°', '150°'].map((angle) => (
              <button
                key={angle}
                onClick={() => setAnswer(angle.replace('°', ''))}
                className="py-2 bg-surface-container-low rounded-xl text-sm font-bold hover:bg-surface-container transition-colors"
              >
                {angle}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleCheck}
              disabled={!answer}
              className={cn(
                "w-full py-4 rounded-full font-bold flex items-center justify-center gap-2 transition-all",
                !answer
                  ? "bg-surface-container-highest text-on-surface-variant/40 cursor-not-allowed"
                  : "bg-primary text-on-primary hover:scale-[1.02] active:scale-95 shadow-lg"
              )}
            >
              <MaterialIcon icon="check" className="" style={{ fontSize: '20px' }} />
              提交答案
            </button>

            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                className="w-full py-3 rounded-full bg-surface-container-highest text-on-surface font-bold hover:bg-surface-container transition-all"
              >
                上一步
              </button>
            )}
          </div>

          {/* Progress */}
          <div className="pt-4 border-t border-outline-variant/10">
            <div className="flex justify-between text-xs font-bold text-on-surface-variant mb-2">
              <span>进度</span>
              <span>{currentStep} / 3</span>
            </div>
            <div className="h-2 bg-surface-variant rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${(currentStep / 3) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeometryPage;
