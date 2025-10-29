'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ArrowLeft, Upload, X, Sparkles, Loader2, Image as ImageIcon, Video } from 'lucide-react';
import { AIProcessingModal } from '@/components/ai-processing-modal';

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
}

const DEFAULT_IMAGE_PROMPT = `Professional studio product photography with clean white background, soft natural lighting, high resolution, centered composition, commercial quality, lifestyle context, shallow depth of field, warm color temperature, professional color grading`;

const PRODUCT_TYPES = [
  'Beverages',
  'Snacks & Confectionery',
  'Dairy Products',
  'Fresh Produce',
  'Meat & Poultry',
  'Seafood',
  'Bakery Items',
  'Canned Goods',
  'Dry Goods & Grains',
  'Condiments & Sauces',
  'Spices & Seasonings',
  'Health & Beauty',
  'Household Supplies',
  'Personal Care',
  'Baby Products',
  'Pet Food & Supplies',
  'Electronics',
  'Clothing & Apparel',
  'Home & Garden',
  'Office Supplies',
  'Other'
];

export default function AddProductPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [productType, setProductType] = useState('');
  const [hasOptions, setHasOptions] = useState(false);
  const [featuredImage, setFeaturedImage] = useState<File | null>(null);
  const [additionalImages, setAdditionalImages] = useState<(File | null)[]>(Array(8).fill(null));
  const [videos, setVideos] = useState<(File | null)[]>(Array(3).fill(null));
  const [productTypeSearch, setProductTypeSearch] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // AI Processing
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiSteps, setAiSteps] = useState<ProcessingStep[]>([]);
  const [currentAIStep, setCurrentAIStep] = useState<string>('');
  const [aiError, setAiError] = useState<string>('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('');

  // File inputs
  const featuredImageRef = useRef<HTMLInputElement>(null);
  const additionalImageRefs = useRef<(HTMLInputElement | null)[]>([]);
  const videoRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (userData?.role !== 'distributor') {
      router.push('/modules');
    }
  }, [userData]);

  const filteredProductTypes = PRODUCT_TYPES.filter(type =>
    type.toLowerCase().includes(productTypeSearch.toLowerCase())
  );

  const handleFeaturedImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFeaturedImage(e.target.files[0]);
    }
  };

  const handleAdditionalImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const newImages = [...additionalImages];
      newImages[index] = e.target.files[0];
      setAdditionalImages(newImages);
    }
  };

  const handleVideoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check 2GB limit
      if (file.size > 2 * 1024 * 1024 * 1024) {
        alert('Video file must be under 2GB');
        return;
      }
      const newVideos = [...videos];
      newVideos[index] = file;
      setVideos(newVideos);
    }
  };

  const removeImage = (type: 'featured' | 'additional', index?: number) => {
    if (type === 'featured') {
      setFeaturedImage(null);
      if (featuredImageRef.current) featuredImageRef.current.value = '';
    } else if (type === 'additional' && index !== undefined) {
      const newImages = [...additionalImages];
      newImages[index] = null;
      setAdditionalImages(newImages);
      if (additionalImageRefs.current[index]) {
        additionalImageRefs.current[index]!.value = '';
      }
    }
  };

  const removeVideo = (index: number) => {
    const newVideos = [...videos];
    newVideos[index] = null;
    setVideos(newVideos);
    if (videoRefs.current[index]) {
      videoRefs.current[index]!.value = '';
    }
  };

  const generateAIImage = async () => {
    if (!name) {
      alert('Please enter a product name first');
      return;
    }

    setIsAIProcessing(true);
    setAiError('');
    setAiSteps([
      { id: 'prepare', title: 'Preparing AI request', description: 'Setting up image generation', status: 'processing' },
      { id: 'generate', title: 'Generating image', description: 'Creating product photo', status: 'pending' },
      { id: 'optimize', title: 'Optimizing quality', description: 'Enhancing image quality', status: 'pending' },
      { id: 'complete', title: 'Complete', description: 'Image ready', status: 'pending' }
    ]);
    setCurrentAIStep('prepare');

    try {
      // Step 1: Prepare
      await new Promise(resolve => setTimeout(resolve, 500));
      setAiSteps(prev => prev.map(s => 
        s.id === 'prepare' ? { ...s, status: 'completed' as const } : s
      ));
      setCurrentAIStep('generate');
      setAiSteps(prev => prev.map(s => 
        s.id === 'generate' ? { ...s, status: 'processing' as const } : s
      ));

      // Step 2: Generate with fal.ai
      const prompt = `${name}, ${DEFAULT_IMAGE_PROMPT}`;
      
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();
      const imageUrl = data.imageUrl;

      setAiSteps(prev => prev.map(s => 
        s.id === 'generate' ? { ...s, status: 'completed' as const } : s
      ));
      setCurrentAIStep('optimize');
      setAiSteps(prev => prev.map(s => 
        s.id === 'optimize' ? { ...s, status: 'processing' as const } : s
      ));

      // Step 3: Optimize (simulate)
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAiSteps(prev => prev.map(s => 
        s.id === 'optimize' ? { ...s, status: 'completed' as const } : s
      ));
      setCurrentAIStep('complete');
      setAiSteps(prev => prev.map(s => 
        s.id === 'complete' ? { ...s, status: 'completed' as const } : s
      ));

      // Convert URL to File and set as featured image
      const imageResponse = await fetch(imageUrl);
      const blob = await imageResponse.blob();
      const file = new File([blob], `${name}-ai-generated.jpg`, { type: 'image/jpeg' });
      setFeaturedImage(file);
      setGeneratedImageUrl(imageUrl);

      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsAIProcessing(false);

    } catch (error) {
      console.error('AI generation error:', error);
      setAiError(error instanceof Error ? error.message : 'Failed to generate image');
      setAiSteps(prev => prev.map(s => 
        s.id === currentAIStep ? { ...s, status: 'error' as const } : s
      ));
    }
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage!, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please enter a product name');
      return;
    }

    if (!featuredImage) {
      alert('Please add a featured image');
      return;
    }

    setLoading(true);
    try {
      // Upload featured image
      const featuredImageUrl = await uploadFile(
        featuredImage,
        `products/${(userData as any)?.organizationId}/${Date.now()}-featured.jpg`
      );

      // Upload additional images
      const additionalImageUrls: string[] = [];
      for (let i = 0; i < additionalImages.length; i++) {
        if (additionalImages[i]) {
          const url = await uploadFile(
            additionalImages[i]!,
            `products/${(userData as any)?.organizationId}/${Date.now()}-${i}.jpg`
          );
          additionalImageUrls.push(url);
        }
      }

      // Upload videos
      const videoUrls: string[] = [];
      for (let i = 0; i < videos.length; i++) {
        if (videos[i]) {
          const url = await uploadFile(
            videos[i]!,
            `products/${(userData as any)?.organizationId}/${Date.now()}-video-${i}.mp4`
          );
          videoUrls.push(url);
        }
      }

      // Create product document
      await addDoc(collection(db!, 'products'), {
        name: name.trim(),
        description: description.trim(),
        productType,
        hasOptions,
        images: [featuredImageUrl, ...additionalImageUrls],
        videos: videoUrls,
        status: 'draft',
        organizationId: (userData as any)?.organizationId,
        createdBy: userData?.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      router.push('/distributor-dashboard/products');
    } catch (error) {
      console.error('Error creating product:', error);
      alert('Failed to create product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Header */}
        <div className="border-b border-white/10 bg-gradient-to-b from-slate-900/50 to-transparent backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="p-2 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all duration-200"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-white">Add product</h1>
                  <p className="text-sm text-slate-400">Create a new product for your catalog</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-4 py-2 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save product'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="max-w-5xl mx-auto px-6 py-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-6">Basic information</h2>
              
              <div className="space-y-6">
                {/* Product Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Product name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 60))}
                    placeholder="e.g., Premium Arabica Coffee Beans"
                    className="w-full px-4 py-3 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                    maxLength={60}
                  />
                  <p className="text-sm text-slate-400 mt-1">{name.length}/60 characters</p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 3000))}
                    placeholder="Describe your product in detail..."
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 resize-none"
                    maxLength={3000}
                  />
                  <p className="text-sm text-slate-400 mt-1">{description.length}/3000 characters</p>
                </div>
              </div>
            </div>

            {/* Images */}
            <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Images</h2>
                <button
                  type="button"
                  onClick={generateAIImage}
                  disabled={!name || isAIProcessing}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate with AI
                </button>
              </div>

              {/* Featured Image */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Featured image *
                </label>
                <div className="relative">
                  <input
                    ref={featuredImageRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFeaturedImageChange}
                    className="hidden"
                  />
                  {featuredImage ? (
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-800 border border-white/10">
                      <img
                        src={URL.createObjectURL(featuredImage)}
                        alt="Featured"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage('featured')}
                        className="absolute top-2 right-2 p-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-all duration-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => featuredImageRef.current?.click()}
                      className="w-full aspect-video rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-3 transition-all duration-200"
                    >
                      <Upload className="w-8 h-8 text-slate-400" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-300">Upload featured image</p>
                        <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 10MB</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Additional Images */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Additional images (up to 8)
                </label>
                <div className="grid grid-cols-4 gap-4">
                  {additionalImages.map((img, index) => (
                    <div key={index} className="relative">
                      <input
                        ref={el => { additionalImageRefs.current[index] = el; }}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleAdditionalImageChange(index, e)}
                        className="hidden"
                      />
                      {img ? (
                        <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-800 border border-white/10">
                          <img
                            src={URL.createObjectURL(img)}
                            alt={`Additional ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage('additional', index)}
                            className="absolute top-1 right-1 p-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-all duration-200"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => additionalImageRefs.current[index]?.click()}
                          className="w-full aspect-square rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-2 transition-all duration-200"
                        >
                          <ImageIcon className="w-6 h-6 text-slate-400" />
                          <span className="text-xs text-slate-400">Upload</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Videos */}
            <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-3">Videos</h2>
              <p className="text-sm text-slate-400 mb-6">Upload up to 3 videos (2GB limit each)</p>
              
              <div className="grid grid-cols-3 gap-4">
                {videos.map((video, index) => (
                  <div key={index} className="relative">
                    <input
                      ref={el => { videoRefs.current[index] = el; }}
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleVideoChange(index, e)}
                      className="hidden"
                    />
                    {video ? (
                      <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-800 border border-white/10">
                        <video
                          src={URL.createObjectURL(video)}
                          className="w-full h-full object-cover"
                          controls
                        />
                        <button
                          type="button"
                          onClick={() => removeVideo(index)}
                          className="absolute top-1 right-1 p-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-all duration-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => videoRefs.current[index]?.click()}
                        className="w-full aspect-video rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-2 transition-all duration-200"
                      >
                        <Video className="w-6 h-6 text-slate-400" />
                        <span className="text-xs text-slate-400">Upload video</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Product Type */}
            <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-6">Product type</h2>
              
              <div className="relative">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  value={productType || productTypeSearch}
                  onChange={(e) => {
                    setProductTypeSearch(e.target.value);
                    setProductType('');
                    setShowTypeDropdown(true);
                  }}
                  onFocus={() => setShowTypeDropdown(true)}
                  placeholder="Search product type..."
                  className="w-full px-4 py-3 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                />
                
                {showTypeDropdown && filteredProductTypes.length > 0 && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowTypeDropdown(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-2 max-h-64 overflow-y-auto rounded-xl backdrop-blur-2xl bg-slate-900/95 border border-white/10 shadow-2xl z-20">
                      {filteredProductTypes.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setProductType(type);
                            setProductTypeSearch(type);
                            setShowTypeDropdown(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5 transition-all duration-200"
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Product Options */}
            <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-6">Product options</h2>
              
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    checked={!hasOptions}
                    onChange={() => setHasOptions(false)}
                    className="w-5 h-5 accent-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">This product doesn't have options</p>
                    <p className="text-xs text-slate-400">Product has no variants (size, color, etc.)</p>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    checked={hasOptions}
                    onChange={() => setHasOptions(true)}
                    className="w-5 h-5 accent-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">This product has options</p>
                    <p className="text-xs text-slate-400">Product has variants like size, color, flavor, etc.</p>
                  </div>
                </label>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* AI Processing Modal */}
      <AIProcessingModal
        isOpen={isAIProcessing}
        onClose={() => setIsAIProcessing(false)}
        steps={aiSteps}
        currentStep={currentAIStep}
        error={aiError}
        onRetry={generateAIImage}
      />
    </>
  );
}
