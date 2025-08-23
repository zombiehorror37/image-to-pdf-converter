'use client';
import React, { useState, useCallback } from 'react';
import { Upload, Download, X, RotateCw, Move, FileImage, Archive } from 'lucide-react';
import JSZip from 'jszip';
import jsPDF from 'jspdf';

export default function ImageToPDFConverter() {
  const [images, setImages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [draggedIndex, setDraggedIndex] = useState(null);
  
  // FIXED: Complete pdfSettings state
  const [pdfSettings, setPdfSettings] = useState({
    preserveSize: true,    // Keep original dimensions
    quality: 0.92,         // High quality
    dpi: 300,             // Print-quality DPI
    pageSize: 'A4',       // Standard page size (when not preserving)
    orientation: 'portrait', // Page orientation
    fitToPage: false      // Fit to standard page size
  });

  // Handle file uploads (images + ZIP)
  const handleFileUpload = useCallback(async (files) => {
    setIsProcessing(true);
    setProcessingStep('Processing files...');
    
    const newImages = [];
    
    for (let file of files) {
      if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        // Handle ZIP file
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
        // Handle regular image files
        newImages.push(await createImageObject(file));
      }
    }
    
    setImages(prev => [...prev, ...newImages]);
    setIsProcessing(false);
    setProcessingStep('');
  }, []);

  // Create image object with preview
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
            rotation: 0
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // Check if file is an image
  const isImageFile = (filename) => {
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i;
    return imageExtensions.test(filename);
  };

  // Get MIME type from filename
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

  // Drag and drop handlers
  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  }, [handleFileUpload]);

  // File input handler
  const onFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    handleFileUpload(files);
  };

  // Remove image
  const removeImage = (id) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  // Rotate image
  const rotateImage = (id) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img
    ));
  };

  // Drag to reorder
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDragOverItem = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      const newImages = [...images];
      const draggedImage = newImages[draggedIndex];
      newImages.splice(draggedIndex, 1);
      newImages.splice(index, 0, draggedImage);
      setImages(newImages);
      setDraggedIndex(index);
    }
  };

  // FIXED: Helper function to load image element
  const loadImageElement = (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = imageSrc;
    });
  };

  // Process image with rotation and resizing
  const processImage = (imageObj) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const { width, height } = img;
        const rotation = imageObj.rotation;
        
        // Set canvas size considering rotation
        if (rotation === 90 || rotation === 270) {
          canvas.width = height;
          canvas.height = width;
        } else {
          canvas.width = width;
          canvas.height = height;
        }
        
        // Apply rotation
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
        
        canvas.toBlob(resolve, 'image/jpeg', pdfSettings.quality);
      };
      
      img.src = imageObj.preview;
    });
  };

  // FIXED: Convert blob to data URL
  const blobToDataURL = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(blob);
    });
  };

  // FIXED: Correct function name and logic
  const convertToPDF = async () => {
    if (images.length === 0) return;
    
    setIsProcessing(true);
    setProcessingStep('Generating PDF...');
    
    try {
      let pdf;
      
      if (pdfSettings.preserveSize) {
        // PRESERVE ORIGINAL SIZES
        const firstImage = images[0];
        const processedBlob = await processImage(firstImage);
        const firstImgElement = await loadImageElement(URL.createObjectURL(processedBlob));
        
        // Use DPI setting for conversion
        const pixelsToMM = 25.4 / pdfSettings.dpi;
        const firstWidth = firstImgElement.width * pixelsToMM;
        const firstHeight = firstImgElement.height * pixelsToMM;
        
        // Create PDF with first image's dimensions
        pdf = new jsPDF({
          orientation: firstWidth > firstHeight ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [firstWidth, firstHeight]
        });
        
        // Add first image
        const firstImageData = await blobToDataURL(processedBlob);
        pdf.addImage(firstImageData, 'JPEG', 0, 0, firstWidth, firstHeight);
        
        // Add remaining images with their own page sizes
        for (let i = 1; i < images.length; i++) {
          setProcessingStep(`Processing image ${i + 1} of ${images.length}...`);
          
          const processedBlob = await processImage(images[i]);
          const imgElement = await loadImageElement(URL.createObjectURL(processedBlob));
          
          const width = imgElement.width * pixelsToMM;
          const height = imgElement.height * pixelsToMM;
          
          // Add new page with custom dimensions
          pdf.addPage([width, height]);
          
          const imageData = await blobToDataURL(processedBlob);
          pdf.addImage(imageData, 'JPEG', 0, 0, width, height);
        }
        
      } else {
        // STANDARD PAGE SIZES
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
            // Fit image to page with margins
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
            // Fill page (may crop)
            pdf.addImage(imageData, 'JPEG', margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2));
          }
        }
      }
      
      setProcessingStep('Saving PDF...');
      pdf.save('converted-images.pdf');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
    
    setIsProcessing(false);
    setProcessingStep('');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Image to PDF Converter
        </h1>

        {/* Upload Area */}
        <div
          className="border-2 border-dashed border-gray-600 rounded-lg p-12 mb-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => document.getElementById('fileInput').click()}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="flex space-x-4">
              <FileImage className="w-12 h-12 text-blue-400" />
              <Archive className="w-12 h-12 text-purple-400" />
            </div>
            <div>
              <p className="text-xl mb-2">Drop images or ZIP files here</p>
              <p className="text-gray-400">or click to browse</p>
              <p className="text-sm text-gray-500 mt-2">
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
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">PDF Settings</h3>
            
            {/* FIXED: Added preserve size option */}
            <div className="mb-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="preserveSize"
                  checked={pdfSettings.preserveSize}
                  onChange={(e) => setPdfSettings(prev => ({
                    ...prev,
                    preserveSize: e.target.checked
                  }))}
                  className="w-4 h-4"
                />
                <label htmlFor="preserveSize" className="text-sm">
                  <span className="font-medium">Preserve original image sizes</span>
                  <span className="text-gray-400 block">Each page will match the image dimensions</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Only show standard options when NOT preserving size */}
              {!pdfSettings.preserveSize && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Page Size</label>
                    <select
                      value={pdfSettings.pageSize}
                      onChange={(e) => setPdfSettings(prev => ({ ...prev, pageSize: e.target.value }))}
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                    >
                      <option value="A4">A4</option>
                      <option value="A3">A3</option>
                      <option value="Letter">Letter</option>
                      <option value="Legal">Legal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Orientation</label>
                    <select
                      value={pdfSettings.orientation}
                      onChange={(e) => setPdfSettings(prev => ({ ...prev, orientation: e.target.value }))}
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-sm font-medium mb-2">Quality: {Math.round(pdfSettings.quality * 100)}%</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={pdfSettings.quality}
                  onChange={(e) => setPdfSettings(prev => ({ ...prev, quality: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>
              
              {!pdfSettings.preserveSize && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="fitToPage"
                    checked={pdfSettings.fitToPage}
                    onChange={(e) => setPdfSettings(prev => ({ ...prev, fitToPage: e.target.checked }))}
                    className="mr-2"
                  />
                  <label htmlFor="fitToPage" className="text-sm">Fit to page</label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 mb-8">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
              <span>{processingStep}</span>
            </div>
          </div>
        )}

        {/* Image Grid */}
        {images.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">{images.length} Images Ready</h3>
              <button
                onClick={convertToPDF}
                disabled={isProcessing}
                className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Download className="w-5 h-5" />
                <span>Convert to PDF</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOverItem(e, index)}
                  className={`bg-gray-800 rounded-lg overflow-hidden cursor-move hover:bg-gray-750 transition-colors ${
                    draggedIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  <div className="aspect-square relative">
                    <img
                      src={image.preview}
                      alt={image.name}
                      className="w-full h-full object-cover"
                      style={{ transform: `rotate(${image.rotation}deg)` }}
                    />
                    <div className="absolute top-2 right-2 flex space-x-1">
                      <button
                        onClick={() => rotateImage(image.id)}
                        className="bg-black bg-opacity-50 p-1 rounded hover:bg-opacity-70"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeImage(image.id)}
                        className="bg-black bg-opacity-50 p-1 rounded hover:bg-opacity-70 text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2">
                      <Move className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">{image.name}</p>
                    <p className="text-xs text-gray-400">{image.width} × {image.height}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {images.length === 0 && !isProcessing && (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <h3 className="text-xl font-semibold mb-4">How to Use</h3>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div>
                <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center mb-3 mx-auto md:mx-0">1</div>
                <h4 className="font-medium mb-2">Upload Images</h4>
                <p className="text-gray-400 text-sm">Drag & drop images or ZIP files, or click to browse</p>
              </div>
              <div>
                <div className="bg-purple-500 w-8 h-8 rounded-full flex items-center justify-center mb-3 mx-auto md:mx-0">2</div>
                <h4 className="font-medium mb-2">Arrange & Edit</h4>
                <p className="text-gray-400 text-sm">Drag to reorder, rotate images, adjust PDF settings</p>
              </div>
              <div>
                <div className="bg-green-500 w-8 h-8 rounded-full flex items-center justify-center mb-3 mx-auto md:mx-0">3</div>
                <h4 className="font-medium mb-2">Convert & Download</h4>
                <p className="text-gray-400 text-sm">Click convert to generate and download your PDF</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}