import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

interface SignatureEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signature: { data: string }) => void;
}

const SignatureEditDialog: React.FC<SignatureEditDialogProps> = ({ isOpen, onClose, onSave }) => {
    const [selectedColor, setSelectedColor] = useState<string>('#000000');
    const [isDrawing, setIsDrawing] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
    const [typedSignature, setTypedSignature] = useState<string>('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [canvasHistory, setCanvasHistory] = useState<ImageData[]>([]);
       const canvasRef = useRef<HTMLCanvasElement>(null);
       const MAX_HISTORY = 10;
  
       const activeTabStyle = {
         color: 'var(--LIGHTER-BLACK, #333)',
         fontFamily: 'Inter',
         fontSize: '12px',
         fontStyle: 'normal',
         fontWeight: 700,
         lineHeight: '100%'
       };
  
       const inactiveTabStyle = {
         ...activeTabStyle,
         fontWeight: 300
       };

  const resetState = () => {
    setSelectedColor('#000000');
    setIsDrawing(false);
    setActiveTab('draw');
    setTypedSignature('');
    setUploadedFile(null);
    setPreviewUrl(null);
    setIsSaving(false);
    setCanvasHistory([]);
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === 'draw') {
      console.log('=== SWITCHING TO DRAW TAB - INITIALIZING HISTORY ===');
      setCanvasHistory([]);
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const blankData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          console.log('Initial blank canvas state:', {
            dataLength: blankData.data.length,
            width: blankData.width,
            height: blankData.height,
            hasContent: blankData.data.some(pixel => pixel !== 0),
            nonZeroPixels: blankData.data.filter(pixel => pixel !== 0).length
          });
          setCanvasHistory([blankData]);
          console.log('Canvas history initialized with blank state');
        }
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'type' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'upload') {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      setUploadedFile(null);
      setPreviewUrl(null);
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = 2;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    // Save canvas state to history after drawing
    console.log('=== MOUSE UP - SAVING CANVAS STATE ===');
    console.log('History length before save:', canvasHistory.length);

    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        console.log('Captured canvas state:', {
          dataLength: imageData.data.length,
          width: imageData.width,
          height: imageData.height,
          hasContent: imageData.data.some(pixel => pixel !== 0),
          nonZeroPixels: imageData.data.filter(pixel => pixel !== 0).length
        });

        setCanvasHistory(prev => {
          // Check if the new imageData is different from the last saved state
          if (prev.length > 0 && JSON.stringify(prev[prev.length - 1].data) === JSON.stringify(imageData.data)) {
            console.log('Duplicate canvas state detected, skipping save');
            return prev;
          }
          const newHistory = [...prev, imageData];
          console.log('History length after save:', newHistory.length);
          console.log('History items:', newHistory.map((item, index) => ({
            index,
            dataLength: item.data.length,
            hasContent: item.data.some(pixel => pixel !== 0)
          })));
          return newHistory.length > MAX_HISTORY ? newHistory.slice(-MAX_HISTORY) : newHistory;
        });
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = 2;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      if (ctx) {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDrawing(false);
    // Save canvas state to history after drawing
    console.log('=== TOUCH END - SAVING CANVAS STATE ===');
    console.log('History length before save:', canvasHistory.length);

    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        console.log('Captured canvas state:', {
          dataLength: imageData.data.length,
          width: imageData.width,
          height: imageData.height,
          hasContent: imageData.data.some(pixel => pixel !== 0),
          nonZeroPixels: imageData.data.filter(pixel => pixel !== 0).length
        });

        setCanvasHistory(prev => {
          // Check if the new imageData is different from the last saved state
          if (prev.length > 0 && JSON.stringify(prev[prev.length - 1].data) === JSON.stringify(imageData.data)) {
            console.log('Duplicate canvas state detected, skipping save');
            return prev;
          }
          const newHistory = [...prev, imageData];
          console.log('History length after save:', newHistory.length);
          console.log('History items:', newHistory.map((item, index) => ({
            index,
            dataLength: item.data.length,
            hasContent: item.data.some(pixel => pixel !== 0)
          })));
          return newHistory.length > MAX_HISTORY ? newHistory.slice(-MAX_HISTORY) : newHistory;
        });
      }
    }
  };

  const validateFile = (file: File): boolean => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, GIF, or WebP).');
      return false;
    }

    if (file.size > maxSize) {
      alert('File size must be less than 5MB.');
      return false;
    }

    return true;
  };

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleUndo = () => {
    console.log('=== UNDO OPERATION START ===');
    console.log('Canvas history state before undo:', {
      length: canvasHistory.length,
      historyItems: canvasHistory.map((item, index) => ({
        index,
        dataLength: item.data.length,
        width: item.width,
        height: item.height
      }))
    });

    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const canvasContentBefore = ctx.getImageData(0, 0, canvas.width, canvas.height);
        console.log('Canvas content before undo:', {
          hasContent: canvasContentBefore.data.some(pixel => pixel !== 0),
          nonZeroPixels: canvasContentBefore.data.filter(pixel => pixel !== 0).length,
          dataLength: canvasContentBefore.data.length
        });
      }
    }

    if (canvasHistory.length > 1) {
      console.log('Restoring to previous state (length > 1)');
      const previousState = canvasHistory[canvasHistory.length - 2];
      console.log('Previous state details:', {
        dataLength: previousState.data.length,
        width: previousState.width,
        height: previousState.height,
        hasContent: previousState.data.some(pixel => pixel !== 0),
        nonZeroPixels: previousState.data.filter(pixel => pixel !== 0).length
      });

      setCanvasHistory(prev => {
        const newHistory = prev.slice(0, -1);
        console.log('Canvas history state after undo:', {
          length: newHistory.length,
          historyItems: newHistory.map((item, index) => ({
            index,
            dataLength: item.data.length
          }))
        });
        return newHistory;
      });

      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(previousState, 0, 0);
          console.log('Canvas restoration completed');

          // Verify restoration
          const canvasContentAfter = ctx.getImageData(0, 0, canvas.width, canvas.height);
          console.log('Canvas content after undo:', {
            hasContent: canvasContentAfter.data.some(pixel => pixel !== 0),
            nonZeroPixels: canvasContentAfter.data.filter(pixel => pixel !== 0).length,
            dataLength: canvasContentAfter.data.length,
            matchesPreviousState: JSON.stringify(canvasContentAfter.data) === JSON.stringify(previousState.data)
          });
        }
      }
    } else if (canvasHistory.length === 1) {
      console.log('Restoring to blank state (length === 1)');
      const blankState = canvasHistory[0];
      console.log('Blank state details:', {
        dataLength: blankState.data.length,
        width: blankState.width,
        height: blankState.height,
        hasContent: blankState.data.some(pixel => pixel !== 0),
        nonZeroPixels: blankState.data.filter(pixel => pixel !== 0).length
      });

      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(blankState, 0, 0);
          console.log('Canvas restoration to blank completed');

          // Verify restoration
          const canvasContentAfter = ctx.getImageData(0, 0, canvas.width, canvas.height);
          console.log('Canvas content after undo to blank:', {
            hasContent: canvasContentAfter.data.some(pixel => pixel !== 0),
            nonZeroPixels: canvasContentAfter.data.filter(pixel => pixel !== 0).length,
            dataLength: canvasContentAfter.data.length,
            matchesBlankState: JSON.stringify(canvasContentAfter.data) === JSON.stringify(blankState.data)
          });
        }
      }
    } else {
      console.log('No history available for undo');
    }

    console.log('=== UNDO OPERATION END ===');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex justify-center items-center">
      <div className="mt-8 bg-white rounded-lg w-80 h-80 p-4 relative shadow-xl">
        {/* Close button */}
        <button onClick={onClose} disabled={isSaving} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div style={{width: '315px', height: '24px', flexShrink: 0, color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 700, lineHeight: '100%', marginBottom: '10px'}}>Signature</div>

        {/* Tabs */}
        <div className="relative mb-4">
          <div className="flex space-x-4  pb-1">
            <button
            className='pl-1'
              onClick={() => setActiveTab('draw')}
              style={activeTab === 'draw' ? activeTabStyle : inactiveTabStyle}
            >
              Draw
            </button>
            <button
              onClick={() => setActiveTab('type')}
              style={activeTab === 'type' ? activeTabStyle : inactiveTabStyle}
            >
              Type
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              style={activeTab === 'upload' ? activeTabStyle : inactiveTabStyle}
            >
              Upload
            </button>
          </div>
          <div
            className="absolute -bottom-1 transition-all duration-300"
            style={{
              width: activeTab === 'upload' ? '50px' : '38px',
              height: '4.502px',
              background: 'var(--LINK-BLUE, #2D3FFF)',
              left: activeTab === 'draw' ? '0px' : activeTab === 'type' ? '47px' : '90px'
            }}
          ></div>
        </div>

        {/* Drawing area */}
        {activeTab === 'draw' && (
          <div className="relative">
            <button
              onClick={handleUndo}
              disabled={canvasHistory.length <= 1}
              className="absolute top-1 left-2 z-10 bg-white rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center px-2 py-1"
              title="Undo"
            >
              <img src="/icons/undo.svg" alt="Undo" style={{ width: '21px', height: '22px' }} />
              <span style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 300, lineHeight: '100%', marginLeft: '2px', marginTop: '2px' }}>Undo</span>
            </button>
            <canvas
              ref={canvasRef}
              width={288}
              height={176}
              className="w-72 h-44 border border-gray-300"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            ></canvas>
          </div>
        )}
        {activeTab === 'type' && (
          <div className="w-72 h-44 border border-gray-300 mb-4 flex items-center justify-center relative">
            <input
              type="text"
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              placeholder="Type your signature"
              maxLength={12}
              className="w-full h-full text-center text-2xl font-signature border-none outline-none bg-transparent"
              style={{ fontFamily: 'cursive' }}
            />
            {typedSignature.trim() && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-2xl font-signature" style={{ fontFamily: 'cursive', color: selectedColor }}>
                  {typedSignature}
                </span>
              </div>
            )}
          </div>
        )}
        {activeTab === 'upload' && (
          <div className="w-72 h-44 border-2 border-dashed border-gray-300 mb-4 flex flex-col items-center justify-start relative">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Signature preview"
                className="max-w-full max-h-full object-contain object-left"
              />
            ) : (
              <>
                <div
                  className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-gray-500 text-sm text-left text-center">
                    Drag & drop an image here<br />or click to select
                  </span>
                </div>
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </>
            )}
          </div>
        )}


        {/* Buttons */}
        <div className="absolute bottom-4 right-4 flex space-x-2">
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            style={{
              width: '103px',
              height: '27px',
              flexShrink: 0,
              borderRadius: '10px',
              border: '2px solid var(--GREY, #C4C4C4)',
              background: '#FFF'
            }}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setIsSaving(true);
              try {
                let signatureData: { data: string } | null = null;
                if (activeTab === 'draw' && canvasRef.current) {
                  signatureData = { data: canvasRef.current.toDataURL('image/png') };
                } else if (activeTab === 'type' && typedSignature.trim()) {
                  // Generate PNG from typed text
                  const canvas = document.createElement('canvas');
                  canvas.width = 288;
                  canvas.height = 176;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.font = '24px cursive';
                    ctx.fillStyle = selectedColor;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(typedSignature, canvas.width / 2, canvas.height / 2);
                    signatureData = { data: canvas.toDataURL('image/png') };
                  }
                } else if (activeTab === 'upload' && previewUrl) {
                  // Convert uploaded image to PNG
                  const img = new Image();
                  img.crossOrigin = 'anonymous';
                  await new Promise<void>((resolve, reject) => {
                    img.onload = () => {
                      const canvas = document.createElement('canvas');
                      canvas.width = img.naturalWidth;
                      canvas.height = img.naturalHeight;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        signatureData = { data: canvas.toDataURL('image/png') };
                        resolve();
                      } else {
                        reject(new Error('Could not get canvas context'));
                      }
                    };
                    img.onerror = () => reject(new Error('Failed to load image'));
                    img.src = previewUrl;
                  });
                }
                if (signatureData) {
                  await onSave(signatureData);
                  resetState();
                  onClose();
                }
              } catch (error) {
                console.error('Error saving signature:', error);
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            style={{
              width: '103px',
              height: '27px',
              flexShrink: 0,
              borderRadius: '10px',
              background: '#1D0BEB'
            }}
            className="text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignatureEditDialog;