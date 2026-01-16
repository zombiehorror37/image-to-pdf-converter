'use client';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Download, X, RotateCw, FileImage, Archive, ChevronUp, ChevronDown, GripVertical,
  Sun, Moon, Trash2, CheckSquare, Square, Eye, Clipboard, FileText
} from 'lucide-react';
import JSZip from 'jszip';
import jsPDF from 'jspdf';

export default function ImageToPDFConverter() {
  const [images, setImages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Touch drag state
  const [touchDragIndex, setTouchDragIndex] = useState(null);
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 });
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const gridRef = useRef(null);

  // New features state
  const [theme, setTheme] = useState('dark');
  const [filename, setFilename] = useState('converted-images');
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [estimatedSize, setEstimatedSize] = useState(0);

  // PDF Settings
  const [pdfSettings, setPdfSettings] = useState({
    preserveSize: true,
    quality: 0.92,
    dpi: 300,
    pageSize: 'A4',
    orientation: 'portrait',
    fitToPage: false
  });

  // Theme persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem('pdf-converter-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pdf-converter-theme', theme);
  }, [theme]);

  // Clipboard paste handler
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles = [];
      for (let item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        handleFileUpload(imageFiles);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Estimate file size when images or settings change
  useEffect(() => {
    if (images.length === 0) {
      setEstimatedSize(0);
      return;
    }

    // Rough estimation based on image sizes and quality
    let totalBytes = 0;
    images.forEach(img => {
      const pixels = img.width * img.height;
      // Estimate JPEG bytes: ~0.5 bytes per pixel at 92% quality, scales with quality
      const bytesPerPixel = 0.5 * pdfSettings.quality;
      totalBytes += pixels * bytesPerPixel;
    });

    // Add PDF overhead (~1KB per page + 10KB base)
    totalBytes += images.length * 1024 + 10240;

    setEstimatedSize(totalBytes);
  }, [images, pdfSettings.quality]);

  // Handle file uploads (images + ZIP)
  const handleFileUpload = useCallback(async (files) => {
    setIsProcessing(true);
    setProcessingStep('Processing files...');
    setProcessingProgress(0);

    const newImages = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingProgress(Math.round((i / totalFiles) * 100));

      if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        setProcessingStep(`Extracting ${file.name}...`);
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);

        for (let filename in zipContent.files) {
          const zipFile = zipContent.files[filename];
          if (!zipFile.dir && isImageFile(filename)) {
            const blob = await zipFile.async('blob');
            const imageFile = new File([blob], filename, { type: getImageMimeType(filename) });
            newImages.push(await createImageObject(imageFile));
          }
        }
      } else if (isImageFile(file.name)) {
        newImages.push(await createImageObject(file));
      }
    }

    setProcessingProgress(100);
    // Sort images by filename using natural sort
    newImages.sort(naturalSort);
    setImages(prev => [...prev, ...newImages]);
    setIsProcessing(false);
    setProcessingStep('');
    setProcessingProgress(0);
  }, []);

  const createImageObject = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            id: Date.now() + Math.random(),
            file,
            preview: e.target.result,
            name: file.name,
            width: img.width,
            height: img.height,
            rotation: 0,
            size: file.size
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const isImageFile = (filename) => {
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i;
    return imageExtensions.test(filename);
  };

  const getImageMimeType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      bmp: 'image/bmp',
      webp: 'image/webp',
      svg: 'image/svg+xml'
    };
    return mimeTypes[ext] || 'image/jpeg';
  };

  // Natural sort comparator - handles numeric sorting correctly (1, 2, 10 instead of 1, 10, 2)
  const naturalSort = (a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
  };

  // File drop handlers
  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  }, [handleFileUpload]);

  const onFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    handleFileUpload(files);
  };

  const removeImage = (id) => {
    setImages(prev => prev.filter(img => img.id !== id));
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const rotateImage = (id) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img
    ));
  };

  // Bulk operations
  const toggleImageSelection = (id) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllImages = () => {
    if (selectedImages.size === images.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(images.map(img => img.id)));
    }
  };

  const deleteSelectedImages = () => {
    setImages(prev => prev.filter(img => !selectedImages.has(img.id)));
    setSelectedImages(new Set());
    setIsSelectionMode(false);
  };

  const rotateSelectedImages = () => {
    setImages(prev => prev.map(img =>
      selectedImages.has(img.id) ? { ...img, rotation: (img.rotation + 90) % 360 } : img
    ));
  };

  // Move image up/down for mobile
  const moveImage = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= images.length) return;

    const newImages = [...images];
    [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
    setImages(newImages);
  };

  // Desktop drag handlers
  const handleDragStart = (e, index) => {
    if (isSelectionMode) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOverItem = (e, index) => {
    e.preventDefault();
    if (isSelectionMode) return;
    setDragOverIndex(index);
    if (draggedIndex !== null && draggedIndex !== index) {
      const newImages = [...images];
      const draggedImage = newImages[draggedIndex];
      newImages.splice(draggedIndex, 1);
      newImages.splice(index, 0, draggedImage);
      setImages(newImages);
      setDraggedIndex(index);
    }
  };

  // Touch drag handlers
  const handleTouchStart = (e, index) => {
    if (isSelectionMode) return;
    const touch = e.touches[0];
    setTouchDragIndex(index);
    setTouchPosition({ x: touch.clientX, y: touch.clientY });

    const longPressTimer = setTimeout(() => {
      setIsTouchDragging(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 200);

    e.target.dataset.longPressTimer = longPressTimer;
  };

  const handleTouchMove = (e) => {
    if (!isTouchDragging || touchDragIndex === null) return;

    e.preventDefault();
    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });

    const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
    const cardElement = elementsAtPoint.find(el => el.dataset.cardIndex !== undefined);

    if (cardElement) {
      const targetIndex = parseInt(cardElement.dataset.cardIndex);
      if (targetIndex !== touchDragIndex) {
        setDragOverIndex(targetIndex);
      }
    }
  };

  const handleTouchEnd = (e) => {
    clearTimeout(e.target.dataset.longPressTimer);

    if (isTouchDragging && dragOverIndex !== null && dragOverIndex !== touchDragIndex) {
      const newImages = [...images];
      const draggedImage = newImages[touchDragIndex];
      newImages.splice(touchDragIndex, 1);
      newImages.splice(dragOverIndex, 0, draggedImage);
      setImages(newImages);
    }

    setTouchDragIndex(null);
    setDragOverIndex(null);
    setIsTouchDragging(false);
  };

  // PDF generation
  const loadImageElement = (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = imageSrc;
    });
  };

  const processImage = (imageObj) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        const { width, height } = img;
        const rotation = imageObj.rotation;

        if (rotation === 90 || rotation === 270) {
          canvas.width = height;
          canvas.height = width;
        } else {
          canvas.width = width;
          canvas.height = height;
        }

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);

        canvas.toBlob(resolve, 'image/jpeg', pdfSettings.quality);
      };

      img.src = imageObj.preview;
    });
  };

  const blobToDataURL = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(blob);
    });
  };

  const generatePDF = async (forPreview = false) => {
    if (images.length === 0) return null;

    setIsProcessing(true);
    setProcessingStep('Generating PDF...');
    setProcessingProgress(0);

    try {
      let pdf;
      const totalImages = images.length;

      if (pdfSettings.preserveSize) {
        const firstImage = images[0];
        const processedBlob = await processImage(firstImage);
        const firstImgElement = await loadImageElement(URL.createObjectURL(processedBlob));

        const pixelsToMM = 25.4 / pdfSettings.dpi;
        const firstWidth = firstImgElement.width * pixelsToMM;
        const firstHeight = firstImgElement.height * pixelsToMM;

        pdf = new jsPDF({
          orientation: firstWidth > firstHeight ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [firstWidth, firstHeight]
        });

        const firstImageData = await blobToDataURL(processedBlob);
        pdf.addImage(firstImageData, 'JPEG', 0, 0, firstWidth, firstHeight);
        setProcessingProgress(Math.round((1 / totalImages) * 100));

        for (let i = 1; i < images.length; i++) {
          setProcessingStep(`Processing image ${i + 1} of ${images.length}...`);

          const processedBlob = await processImage(images[i]);
          const imgElement = await loadImageElement(URL.createObjectURL(processedBlob));

          const width = imgElement.width * pixelsToMM;
          const height = imgElement.height * pixelsToMM;

          pdf.addPage([width, height]);

          const imageData = await blobToDataURL(processedBlob);
          pdf.addImage(imageData, 'JPEG', 0, 0, width, height);
          setProcessingProgress(Math.round(((i + 1) / totalImages) * 100));
        }

      } else {
        pdf = new jsPDF({
          orientation: pdfSettings.orientation,
          unit: 'mm',
          format: pdfSettings.pageSize.toLowerCase()
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;

        for (let i = 0; i < images.length; i++) {
          setProcessingStep(`Processing image ${i + 1} of ${images.length}...`);

          if (i > 0) pdf.addPage();

          const processedBlob = await processImage(images[i]);
          const imageData = await blobToDataURL(processedBlob);

          if (pdfSettings.fitToPage) {
            const maxWidth = pageWidth - (margin * 2);
            const maxHeight = pageHeight - (margin * 2);

            const imgWidth = images[i].rotation === 90 || images[i].rotation === 270
              ? images[i].height : images[i].width;
            const imgHeight = images[i].rotation === 90 || images[i].rotation === 270
              ? images[i].width : images[i].height;

            const widthRatio = maxWidth / (imgWidth * 25.4 / pdfSettings.dpi);
            const heightRatio = maxHeight / (imgHeight * 25.4 / pdfSettings.dpi);
            const ratio = Math.min(widthRatio, heightRatio);

            const finalWidth = (imgWidth * 25.4 / pdfSettings.dpi) * ratio;
            const finalHeight = (imgHeight * 25.4 / pdfSettings.dpi) * ratio;

            const x = (pageWidth - finalWidth) / 2;
            const y = (pageHeight - finalHeight) / 2;

            pdf.addImage(imageData, 'JPEG', x, y, finalWidth, finalHeight);
          } else {
            pdf.addImage(imageData, 'JPEG', margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2));
          }
          setProcessingProgress(Math.round(((i + 1) / totalImages) * 100));
        }
      }

      setProcessingProgress(100);

      if (forPreview) {
        const pdfBlob = pdf.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        setPreviewPdfUrl(url);
        setShowPreview(true);
      } else {
        setProcessingStep('Saving PDF...');
        pdf.save(`${filename}.pdf`);
      }

      return pdf;

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
      return null;
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
    }
  };

  const convertToPDF = () => generatePDF(false);
  const previewPDF = () => generatePDF(true);

  const downloadFromPreview = () => {
    if (previewPdfUrl) {
      const link = document.createElement('a');
      link.href = previewPdfUrl;
      link.download = `${filename}.pdf`;
      link.click();
    }
  };

  const closePreview = () => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
    }
    setPreviewPdfUrl(null);
    setShowPreview(false);
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white'
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900'
    }`}>
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl ${
          isDark ? 'bg-blue-500/10' : 'bg-blue-500/20'
        }`} />
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl ${
          isDark ? 'bg-purple-500/10' : 'bg-purple-500/20'
        }`} />
      </div>

      <div className="relative z-10 px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <header className="flex justify-between items-start mb-6 sm:mb-10">
            <div className="flex-1 text-center">
              <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold pb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Image to PDF Converter
              </h1>
              <p className={`text-sm sm:text-base mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Convert your images to PDF in seconds • Ctrl+V to paste
              </p>
            </div>
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`p-2.5 rounded-xl transition-all ${
                isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400'
                  : 'bg-white hover:bg-gray-100 text-gray-700 shadow-md'
              }`}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </header>

          {/* Upload Area */}
          <div
            className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-10 lg:p-12 mb-6 sm:mb-8 text-center
                       transition-all duration-300 cursor-pointer active:scale-[0.99] group ${
              isDark
                ? 'border-gray-600 hover:border-blue-500 hover:bg-blue-500/5'
                : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
            }`}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={() => document.getElementById('fileInput').click()}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="flex space-x-3 sm:space-x-4">
                <div className={`p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform ${
                  isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                }`}>
                  <FileImage className="w-8 h-8 sm:w-12 sm:h-12 text-blue-500" />
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform ${
                  isDark ? 'bg-purple-500/20' : 'bg-purple-100'
                }`}>
                  <Archive className="w-8 h-8 sm:w-12 sm:h-12 text-purple-500" />
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform ${
                  isDark ? 'bg-green-500/20' : 'bg-green-100'
                }`}>
                  <Clipboard className="w-8 h-8 sm:w-12 sm:h-12 text-green-500" />
                </div>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-medium mb-1">Drop images or ZIP files here</p>
                <p className={`text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  or tap to browse • Ctrl+V to paste from clipboard
                </p>
                <p className={`text-xs sm:text-sm mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Supports: JPG, PNG, GIF, BMP, WebP, SVG + ZIP archives
                </p>
              </div>
            </div>
            <input
              id="fileInput"
              type="file"
              multiple
              accept="image/*,.zip"
              onChange={onFileInputChange}
              className="hidden"
            />
          </div>

          {/* PDF Settings */}
          {images.length > 0 && (
            <div className={`rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 border ${
              isDark
                ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700/50'
                : 'bg-white/80 backdrop-blur-sm border-gray-200 shadow-lg'
            }`}>
              <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                PDF Settings
              </h3>

              {/* Filename input */}
              <div className="mb-4 sm:mb-6">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <FileText className="w-4 h-4 inline mr-2" />
                  Filename
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value || 'converted-images')}
                    placeholder="converted-images"
                    className={`flex-1 p-3 rounded-xl border outline-none transition-all text-sm sm:text-base ${
                      isDark
                        ? 'bg-gray-700/50 border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>.pdf</span>
                </div>
              </div>

              {/* Preserve size toggle */}
              <div className="mb-4 sm:mb-6">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={pdfSettings.preserveSize}
                      onChange={(e) => setPdfSettings(prev => ({
                        ...prev,
                        preserveSize: e.target.checked
                      }))}
                      className="sr-only peer"
                    />
                    <div className={`w-10 h-6 rounded-full peer-checked:bg-blue-500 transition-colors ${
                      isDark ? 'bg-gray-600' : 'bg-gray-300'
                    }`}></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                  </div>
                  <div>
                    <span className="font-medium block text-sm sm:text-base">Preserve original image sizes</span>
                    <span className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Each page will match the image dimensions
                    </span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {!pdfSettings.preserveSize && (
                  <>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Page Size</label>
                      <select
                        value={pdfSettings.pageSize}
                        onChange={(e) => setPdfSettings(prev => ({ ...prev, pageSize: e.target.value }))}
                        className={`w-full p-3 rounded-xl border outline-none transition-all text-sm sm:text-base ${
                          isDark
                            ? 'bg-gray-700/50 border-gray-600 focus:border-blue-500'
                            : 'bg-white border-gray-300 focus:border-blue-500'
                        }`}
                      >
                        <option value="A4">A4</option>
                        <option value="A3">A3</option>
                        <option value="Letter">Letter</option>
                        <option value="Legal">Legal</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Orientation</label>
                      <select
                        value={pdfSettings.orientation}
                        onChange={(e) => setPdfSettings(prev => ({ ...prev, orientation: e.target.value }))}
                        className={`w-full p-3 rounded-xl border outline-none transition-all text-sm sm:text-base ${
                          isDark
                            ? 'bg-gray-700/50 border-gray-600 focus:border-blue-500'
                            : 'bg-white border-gray-300 focus:border-blue-500'
                        }`}
                      >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </div>
                  </>
                )}

                <div className={pdfSettings.preserveSize ? 'sm:col-span-2 lg:col-span-4' : ''}>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Quality: {Math.round(pdfSettings.quality * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={pdfSettings.quality}
                    onChange={(e) => setPdfSettings(prev => ({ ...prev, quality: parseFloat(e.target.value) }))}
                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500 ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}
                  />
                </div>

                {!pdfSettings.preserveSize && (
                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfSettings.fitToPage}
                        onChange={(e) => setPdfSettings(prev => ({ ...prev, fitToPage: e.target.checked }))}
                        className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      <span className="text-sm sm:text-base">Fit to page</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Estimated size */}
              <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Estimated PDF size: <span className="font-semibold text-blue-500">{formatSize(estimatedSize)}</span>
                </p>
              </div>
            </div>
          )}

          {/* Processing Status with Progress Bar */}
          {isProcessing && (
            <div className={`rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8 ${
              isDark
                ? 'bg-blue-900/50 backdrop-blur-sm border border-blue-700/50'
                : 'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent"></div>
                </div>
                <span className="text-sm sm:text-base">{processingStep}</span>
              </div>
              {/* Progress Bar */}
              <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-blue-100'}`}>
                <div
                  className="h-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
              <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {processingProgress}% complete
              </p>
            </div>
          )}

          {/* Image Grid */}
          {images.length > 0 && (
            <div className="mb-6 sm:mb-8">
              {/* Header with count and actions */}
              <div className="flex flex-col gap-4 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-semibold">
                      {images.length} {images.length === 1 ? 'Image' : 'Images'} Ready
                    </h3>
                    <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <span className="hidden sm:inline">Drag to reorder • </span>
                      <span className="sm:hidden">Use arrows to reorder • </span>
                      Page order reflects PDF order
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {/* Selection mode toggle */}
                    <button
                      onClick={() => {
                        setIsSelectionMode(!isSelectionMode);
                        if (isSelectionMode) setSelectedImages(new Set());
                      }}
                      className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all ${
                        isSelectionMode
                          ? 'bg-blue-500 text-white'
                          : isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span className="hidden sm:inline">{isSelectionMode ? 'Cancel' : 'Select'}</span>
                    </button>

                    {/* Preview button */}
                    <button
                      onClick={previewPDF}
                      disabled={isProcessing}
                      className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all ${
                        isDark
                          ? 'bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Preview</span>
                    </button>

                    {/* Convert button */}
                    <button
                      onClick={convertToPDF}
                      disabled={isProcessing}
                      className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-medium
                               disabled:opacity-50 disabled:cursor-not-allowed
                               flex items-center justify-center gap-2
                               active:scale-[0.98] transition-all text-sm
                               ${isDark
                                 ? 'bg-white text-gray-900 hover:bg-gray-100'
                                 : 'bg-gray-900 text-white hover:bg-gray-800'
                               }`}
                    >
                      <Download className="w-4 h-4" />
                      <span>Convert to PDF</span>
                    </button>
                  </div>
                </div>

                {/* Bulk actions bar */}
                {isSelectionMode && (
                  <div className={`flex flex-wrap items-center gap-2 p-3 rounded-xl ${
                    isDark ? 'bg-gray-800/80' : 'bg-gray-100'
                  }`}>
                    <button
                      onClick={selectAllImages}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${
                        isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'
                      }`}
                    >
                      {selectedImages.size === images.length ? (
                        <><CheckSquare className="w-4 h-4" /> Deselect All</>
                      ) : (
                        <><Square className="w-4 h-4" /> Select All</>
                      )}
                    </button>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {selectedImages.size} selected
                    </span>
                    <div className="flex-1" />
                    <button
                      onClick={rotateSelectedImages}
                      disabled={selectedImages.size === 0}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                        isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'
                      }`}
                    >
                      <RotateCw className="w-4 h-4" /> Rotate
                    </button>
                    <button
                      onClick={deleteSelectedImages}
                      disabled={selectedImages.size === 0}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5
                               bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Image Grid */}
              <div
                ref={gridRef}
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
              >
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    data-card-index={index}
                    draggable={!isSelectionMode}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOverItem(e, index)}
                    onTouchStart={(e) => handleTouchStart(e, index)}
                    onTouchMove={(e) => handleTouchMove(e)}
                    onTouchEnd={(e) => handleTouchEnd(e)}
                    onClick={() => isSelectionMode && toggleImageSelection(image.id)}
                    className={`rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-200 border ${
                      isDark
                        ? 'bg-gray-800/80 backdrop-blur-sm border-gray-700/50'
                        : 'bg-white border-gray-200 shadow-md'
                    } ${
                      isSelectionMode ? 'cursor-pointer' : ''
                    } ${
                      selectedImages.has(image.id)
                        ? 'ring-2 ring-blue-500 ring-offset-2 ' + (isDark ? 'ring-offset-gray-900' : 'ring-offset-white')
                        : ''
                    } ${
                      draggedIndex === index || (isTouchDragging && touchDragIndex === index)
                        ? 'opacity-50 scale-95 rotate-2'
                        : dragOverIndex === index && (draggedIndex !== null || isTouchDragging)
                        ? 'ring-2 ring-blue-500 ring-offset-2 scale-[1.02] shadow-xl shadow-blue-500/30 ' + (isDark ? 'ring-offset-gray-900' : 'ring-offset-white')
                        : !isSelectionMode ? (isDark ? 'hover:bg-gray-800 sm:cursor-move' : 'hover:shadow-lg sm:cursor-move') : ''
                    }`}
                  >
                    <div className="aspect-square relative group">
                      {/* Selection checkbox */}
                      {isSelectionMode && (
                        <div className={`absolute top-2 left-2 z-20 w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                          selectedImages.has(image.id)
                            ? 'bg-blue-500 text-white'
                            : isDark ? 'bg-gray-800/80 border border-gray-600' : 'bg-white/80 border border-gray-300'
                        }`}>
                          {selectedImages.has(image.id) && <CheckSquare className="w-4 h-4" />}
                        </div>
                      )}

                      {/* Page Number Badge - Sleek pill style */}
                      {!isSelectionMode && (
                        <div className={`absolute top-0 left-0 z-10 transition-all duration-200
                          ${draggedIndex === index || (isTouchDragging && touchDragIndex === index)
                            ? 'opacity-50'
                            : dragOverIndex === index && (draggedIndex !== null || isTouchDragging)
                            ? 'scale-110'
                            : ''
                          }`}>
                          <div className={`
                            px-2.5 py-1 sm:px-3 sm:py-1.5
                            text-[10px] sm:text-xs font-semibold tracking-wide uppercase
                            rounded-br-xl rounded-tl-xl
                            backdrop-blur-md
                            ${isDark
                              ? 'bg-black/70 text-white/90'
                              : 'bg-white/90 text-gray-700 shadow-sm'
                            }
                          `}>
                            <span className="opacity-60">Page</span> {index + 1}
                          </div>
                        </div>
                      )}

                      <img
                        src={image.preview}
                        alt={image.name}
                        className="w-full h-full object-cover pointer-events-none"
                        style={{ transform: `rotate(${image.rotation}deg)` }}
                        draggable={false}
                      />

                      {/* Action buttons - Desktop */}
                      {!isSelectionMode && (
                        <div className="absolute top-2 right-2 hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); rotateImage(image.id); }}
                            className={`p-2 rounded-lg transition-all ${
                              isDark ? 'bg-black/60 backdrop-blur-sm hover:bg-black/80' : 'bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm'
                            }`}
                          >
                            <RotateCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeImage(image.id); }}
                            className={`p-2 rounded-lg text-red-400 transition-all ${
                              isDark ? 'bg-black/60 backdrop-blur-sm hover:bg-red-500/80 hover:text-white' : 'bg-white/80 backdrop-blur-sm hover:bg-red-500 hover:text-white shadow-sm'
                            }`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Action buttons - Mobile (always visible) */}
                      {!isSelectionMode && (
                        <div className="absolute top-2 right-2 flex sm:hidden gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); rotateImage(image.id); }}
                            className={`p-1.5 rounded-lg transition-all ${
                              isDark ? 'bg-black/60 backdrop-blur-sm active:bg-black/80' : 'bg-white/80 backdrop-blur-sm active:bg-white'
                            }`}
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeImage(image.id); }}
                            className={`p-1.5 rounded-lg text-red-400 transition-all ${
                              isDark ? 'bg-black/60 backdrop-blur-sm active:bg-red-500/80' : 'bg-white/80 backdrop-blur-sm active:bg-red-500'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Move buttons - Mobile only */}
                      {!isSelectionMode && (
                        <div className="absolute bottom-2 right-2 flex sm:hidden gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveImage(index, 'up'); }}
                            disabled={index === 0}
                            className={`p-1.5 rounded-lg disabled:opacity-30 transition-all ${
                              isDark ? 'bg-black/60 backdrop-blur-sm active:bg-blue-500/80' : 'bg-white/80 backdrop-blur-sm active:bg-blue-500'
                            }`}
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveImage(index, 'down'); }}
                            disabled={index === images.length - 1}
                            className={`p-1.5 rounded-lg disabled:opacity-30 transition-all ${
                              isDark ? 'bg-black/60 backdrop-blur-sm active:bg-blue-500/80' : 'bg-white/80 backdrop-blur-sm active:bg-blue-500'
                            }`}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Drag handle - Desktop */}
                      {!isSelectionMode && (
                        <div className="absolute bottom-2 left-2 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className={`p-1.5 rounded-lg flex items-center gap-1 ${
                            isDark ? 'bg-black/60 backdrop-blur-sm' : 'bg-white/80 backdrop-blur-sm shadow-sm'
                          }`}>
                            <GripVertical className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Drag</span>
                          </div>
                        </div>
                      )}

                      {/* Drop Zone Indicator */}
                      {dragOverIndex === index && (draggedIndex !== null || isTouchDragging) &&
                       ((draggedIndex !== null && draggedIndex !== index) || (isTouchDragging && touchDragIndex !== index)) && (
                        <div className={`absolute inset-0 border-2 border-dashed rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-[2px] ${
                          isDark ? 'bg-white/10 border-white/40' : 'bg-gray-900/10 border-gray-900/40'
                        }`}>
                          <div className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium ${
                            isDark ? 'bg-white/90 text-gray-900' : 'bg-gray-900/90 text-white'
                          }`}>
                            Move to page {index + 1}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Image info */}
                    <div className="p-2 sm:p-3">
                      <p className="text-xs sm:text-sm font-medium truncate">{image.name}</p>
                      <p className={`text-[10px] sm:text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {image.width} × {image.height}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          {images.length === 0 && !isProcessing && (
            <div className={`rounded-2xl p-6 sm:p-8 border ${
              isDark
                ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700/50'
                : 'bg-white/80 backdrop-blur-sm border-gray-200 shadow-lg'
            }`}>
              <h3 className={`text-lg sm:text-xl font-semibold mb-6 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>How it works</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="text-center sm:text-left">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-3 ${
                    isDark ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isDark ? 'bg-gray-600 text-white' : 'bg-gray-300 text-gray-700'
                    }`}>1</span>
                    Upload
                  </div>
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">Add your images</h4>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    Drag & drop, browse, or paste from clipboard
                  </p>
                </div>
                <div className="text-center sm:text-left">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-3 ${
                    isDark ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isDark ? 'bg-gray-600 text-white' : 'bg-gray-300 text-gray-700'
                    }`}>2</span>
                    Arrange
                  </div>
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">Organize your pages</h4>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    Reorder, rotate, and bulk edit images
                  </p>
                </div>
                <div className="text-center sm:text-left">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-3 ${
                    isDark ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isDark ? 'bg-gray-600 text-white' : 'bg-gray-300 text-gray-700'
                    }`}>3</span>
                    Export
                  </div>
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">Download your PDF</h4>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    Preview and download instantly
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className={`mt-8 sm:mt-12 text-center text-xs sm:text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            <p>Your images are processed locally and never uploaded to any server</p>
          </footer>
        </div>
      </div>

      {/* Touch drag preview overlay */}
      {isTouchDragging && touchDragIndex !== null && (
        <div
          className={`fixed pointer-events-none z-50 w-24 h-24 rounded-xl overflow-hidden shadow-2xl opacity-90 ${
            isDark ? 'ring-2 ring-white/50' : 'ring-2 ring-gray-900/50'
          }`}
          style={{
            left: touchPosition.x - 48,
            top: touchPosition.y - 48,
            transform: 'rotate(3deg)'
          }}
        >
          <img
            src={images[touchDragIndex]?.preview}
            alt=""
            className="w-full h-full object-cover"
            style={{ transform: `rotate(${images[touchDragIndex]?.rotation || 0}deg)` }}
          />
          <div className={`absolute top-0 left-0 px-1.5 py-0.5 text-[10px] font-semibold rounded-br-lg ${
            isDark ? 'bg-black/70 text-white' : 'bg-white/90 text-gray-700'
          }`}>
            Page {touchDragIndex + 1}
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-5xl h-[90vh] rounded-2xl overflow-hidden flex flex-col ${
            isDark ? 'bg-gray-900' : 'bg-white'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-4 border-b ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-500" />
                PDF Preview
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadFromPreview}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all text-sm ${
                    isDark
                      ? 'bg-white text-gray-900 hover:bg-gray-100'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={closePreview}
                  className={`p-2 rounded-lg transition-all ${
                    isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* PDF Viewer */}
            <div className="flex-1 p-4">
              {previewPdfUrl && (
                <iframe
                  src={previewPdfUrl}
                  className="w-full h-full rounded-lg border-0"
                  title="PDF Preview"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
