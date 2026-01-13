'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || 'supersecret';

interface BlobResponse {
  id: string;
  data: string;
  size: string;
  created_at: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'upload' | 'retrieve'>('upload');
  const [uploadId, setUploadId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBase64, setUploadBase64] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const [retrieveId, setRetrieveId] = useState('');
  const [retrieveLoading, setRetrieveLoading] = useState(false);
  const [retrieveError, setRetrieveError] = useState('');
  const [retrieveData, setRetrieveData] = useState<BlobResponse | null>(null);
  const [showData, setShowData] = useState(false);

  // Auto-dismiss success messages after 5 seconds
  useEffect(() => {
    if (uploadSuccess) {
      const timer = setTimeout(() => {
        setUploadSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadSuccess]);

  // Auto-dismiss error messages after 6 seconds
  useEffect(() => {
    if (uploadError) {
      const timer = setTimeout(() => {
        setUploadError('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [uploadError]);

  // Auto-dismiss retrieve error messages after 6 seconds
  useEffect(() => {
    if (retrieveError) {
      const timer = setTimeout(() => {
        setRetrieveError('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [retrieveError]);

  // Clear upload form when switching to upload tab
  useEffect(() => {
    if (activeTab === 'upload') {
      setUploadId('');
      setUploadFile(null);
      setUploadBase64('');
      setUploadError('');
      setUploadSuccess('');
    }
  }, [activeTab]);

  // Clear retrieve form when switching to retrieve tab
  useEffect(() => {
    if (activeTab === 'retrieve') {
      setRetrieveId('');
      setRetrieveError('');
      setRetrieveData(null);
      setShowData(false);
    }
  }, [activeTab]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadBase64('');
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        setUploadBase64(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadId.trim()) {
      setUploadError('ID is required');
      return;
    }

    let base64Data = uploadBase64;
    if (uploadFile && !base64Data) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        setUploadBase64(base64);
        performUpload(base64);
      };
      reader.readAsDataURL(uploadFile);
      return;
    }

    if (!base64Data.trim()) {
      setUploadError('Please provide either a file or base64 data');
      return;
    }

    performUpload(base64Data);
  };

  const performUpload = async (base64Data: string) => {
    setUploadLoading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const response = await fetch(`${API_URL}/v1/blobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          id: uploadId.trim(),
          data: base64Data,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadError(data.error || `Error: ${response.status}`);
        return;
      }

      setUploadSuccess(`Successfully uploaded blob with ID: ${data.id}`);
      setUploadId('');
      setUploadFile(null);
      setUploadBase64('');
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload blob');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleRetrieve = async () => {
    if (!retrieveId.trim()) {
      setRetrieveError('ID is required');
      return;
    }

    setRetrieveLoading(true);
    setRetrieveError('');
    setRetrieveData(null);
    setShowData(false);

    try {
      const response = await fetch(`${API_URL}/v1/blobs/${encodeURIComponent(retrieveId.trim())}`, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setRetrieveError(data.error || `Error: ${response.status}`);
        return;
      }

      setRetrieveData(data);
    } catch (error: any) {
      setRetrieveError(error.message || 'Failed to retrieve blob');
    } finally {
      setRetrieveLoading(false);
    }
  };

  const handleDownload = () => {
    if (!retrieveData) return;

    try {
      const binaryString = atob(retrieveData.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = retrieveData.id;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setRetrieveError('Failed to download file');
    }
  };

  // Animation variants
  const headerVariants = {
    hidden: { y: -100, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        delay: 0.6,
        ease: [0.1, 0.25, 0.25, 1],
      },
    },
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeInOut',
      },
    },
  };

  const fieldVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        delay: i * 0.1,
        ease: 'easeOut',
      },
    }),
  };

  const successVariants = {
    hidden: { opacity: 0, filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      transition: {
        duration: 3,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const errorVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
      },
    },
    exit: {
      opacity: 0,
      y: -50,
      transition: {
        duration: 0.3,
      },
    },
  };

  return (
    <main className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center p-4 md:p-24 font-sans selection:bg-blue-500/30">
      <div className="w-full max-w-lg">
        {/* Navigation Header Animation */}
        <motion.h1
          className="text-4xl font-bold text-center mb-12 tracking-tight"
          variants={headerVariants}
          initial="hidden"
          animate="visible"
        >
          Simple Drive
        </motion.h1>

        {/* Tab Switcher */}
        <motion.div
          className="flex p-1 bg-black/20 rounded-xl mb-8 backdrop-blur-sm border border-white/5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
        >
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'upload'
                ? 'bg-[#1e293b] text-white shadow-lg shadow-blue-500/10 ring-1 ring-white/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Upload Blob
          </button>
          <button
            onClick={() => setActiveTab('retrieve')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'retrieve'
                ? 'bg-[#1e293b] text-white shadow-lg shadow-blue-500/10 ring-1 ring-white/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Retrieve Blob
          </button>
        </motion.div>

        {/* Main Card - Form Container Entry Animation */}
        <motion.div
          className="bg-[#1e293b]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence mode="wait">
            {activeTab === 'upload' ? (
              <motion.div
                key="upload"
                className="space-y-6"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <motion.h2
                  className="text-2xl font-bold tracking-tight mb-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  Upload Blob
                </motion.h2>

                <div className="space-y-4">
                  {/* Individual Form Field Animations - Staggered */}
                  <motion.div
                    className="space-y-2"
                    variants={fieldVariants}
                    initial="hidden"
                    animate="visible"
                    custom={0}
                  >
                    <motion.label
                      className="text-sm font-semibold text-gray-400 ml-1 block"
                      whileHover={{ color: '#9ca3af' }}
                      transition={{ duration: 0.2 }}
                    >
                      Blob ID
                    </motion.label>
                    <motion.input
                      type="text"
                      value={uploadId}
                      onChange={(e) => setUploadId(e.target.value)}
                      placeholder="Enter blob ID"
                      className="w-full px-4 py-3 bg-[#0f172a] border border-white/5 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-transparent outline-none transition-all placeholder:text-gray-600"
                      whileHover={{ scale: 1.01 }}
                      whileFocus={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    />
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    variants={fieldVariants}
                    initial="hidden"
                    animate="visible"
                    custom={1}
                  >
                    <motion.label
                      className="text-sm font-semibold text-gray-400 ml-1 block"
                      whileHover={{ color: '#9ca3af' }}
                      transition={{ duration: 0.2 }}
                    >
                      File
                    </motion.label>
                    <div className="relative group">
                      <motion.input
                        type="file"
                        onChange={handleFileChange}
                        accept="*/*"
                        className="w-full px-4 py-3 bg-[#0f172a] border border-white/5 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-transparent outline-none transition-all file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer cursor-pointer text-gray-400 text-sm"
                        whileHover={{ scale: 1.01 }}
                        whileFocus={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 ml-1">
                      Accepts any file type (images, documents, archives, etc.)
                    </p>
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    variants={fieldVariants}
                    initial="hidden"
                    animate="visible"
                    custom={2}
                  >
                    <motion.label
                      className="text-sm font-semibold text-gray-400 ml-1 block"
                      whileHover={{ color: '#9ca3af' }}
                      transition={{ duration: 0.2 }}
                    >
                      Or Base64 Data
                    </motion.label>
                    <motion.textarea
                      value={uploadBase64}
                      onChange={(e) => {
                        setUploadBase64(e.target.value);
                        setUploadFile(null);
                      }}
                      placeholder="Paste base64 encoded data here"
                      rows={3}
                      className="w-full px-4 py-3 bg-[#0f172a] border border-white/5 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-transparent outline-none transition-all placeholder:text-gray-600 font-mono text-sm"
                      whileHover={{ scale: 1.01 }}
                      whileFocus={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    />
                  </motion.div>

                  <motion.div
                    variants={fieldVariants}
                    initial="hidden"
                    animate="visible"
                    custom={3}
                  >
                    <motion.button
                      onClick={handleUpload}
                      disabled={uploadLoading}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                    >
                      {uploadLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Uploading...
                        </span>
                      ) : 'Upload'}
                    </motion.button>
                  </motion.div>

                  {/* Error Notification Animation */}
                  <AnimatePresence>
                    {uploadError && (
                      <motion.div
                        className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-4 rounded-xl text-sm"
                        variants={errorVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                      >
                        <span className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {uploadError}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Success Notification - Sequential Blur Fade-in */}
                  <AnimatePresence>
                    {uploadSuccess && (
                      <motion.div
                        className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-4 rounded-xl text-sm"
                        variants={successVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        <span className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {uploadSuccess}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="retrieve"
                className="space-y-6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <motion.h2
                  className="text-2xl font-bold tracking-tight mb-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  Retrieve Blob
                </motion.h2>

                <div className="space-y-4">
                  <motion.div
                    className="space-y-2"
                    variants={fieldVariants}
                    initial="hidden"
                    animate="visible"
                    custom={0}
                  >
                    <motion.label
                      className="text-sm font-semibold text-gray-400 ml-1 block"
                      whileHover={{ color: '#9ca3af' }}
                      transition={{ duration: 0.2 }}
                    >
                      Blob ID
                    </motion.label>
                    <motion.input
                      type="text"
                      value={retrieveId}
                      onChange={(e) => setRetrieveId(e.target.value)}
                      placeholder="Enter blob ID"
                      className="w-full px-4 py-3 bg-[#0f172a] border border-white/5 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-transparent outline-none transition-all placeholder:text-gray-600"
                      whileHover={{ scale: 1.01 }}
                      whileFocus={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    />
                  </motion.div>

                  <motion.div
                    variants={fieldVariants}
                    initial="hidden"
                    animate="visible"
                    custom={1}
                  >
                    <motion.button
                      onClick={handleRetrieve}
                      disabled={retrieveLoading}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                    >
                      {retrieveLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Fetching...
                        </span>
                      ) : 'Fetch Blob'}
                    </motion.button>
                  </motion.div>

                  {/* Error Notification Animation */}
                  <AnimatePresence>
                    {retrieveError && (
                      <motion.div
                        className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-4 rounded-xl text-sm"
                        variants={errorVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                      >
                        <span className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {retrieveError}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Success/Retrieve Data - Sequential Blur Fade-in */}
                  <AnimatePresence>
                    {retrieveData && (
                      <motion.div
                        className="space-y-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        {/* Data Container - Sequential Blur Fade-in */}
                        <motion.div
                          className="bg-[#0f172a] border border-white/5 p-6 rounded-xl space-y-3"
                          variants={successVariants}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: 0 }}
                        >
                          <motion.div
                            className="flex justify-between items-center text-sm"
                            variants={successVariants}
                            initial="hidden"
                            animate="visible"
                            transition={{ delay: 0.4 }}
                          >
                            <span className="text-gray-400 font-medium">Size</span>
                            <span className="text-white font-bold">{retrieveData.size} bytes</span>
                          </motion.div>
                          <motion.div
                            className="flex justify-between items-center text-sm border-t border-white/5 pt-3"
                            variants={successVariants}
                            initial="hidden"
                            animate="visible"
                            transition={{ delay: 0.4 }}
                          >
                            <span className="text-gray-400 font-medium">Created</span>
                            <span className="text-white font-bold">{new Date(retrieveData.created_at).toLocaleString()}</span>
                          </motion.div>

                          <div className="pt-2">
                            <motion.button
                              onClick={() => setShowData(!showData)}
                              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                              whileHover={{ scale: 1.05 }}
                              transition={{ duration: 0.2 }}
                            >
                              {showData ? 'Hide' : 'Show'} raw data
                              <motion.svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3 w-3"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                animate={{ rotate: showData ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </motion.svg>
                            </motion.button>
                            <AnimatePresence>
                              {showData && (
                                <motion.div
                                  className="mt-3 bg-black/40 p-3 rounded-lg overflow-hidden"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <pre className="text-[10px] leading-tight text-gray-500 font-mono overflow-x-auto max-h-32 custom-scrollbar">
                                    {retrieveData.data}
                                  </pre>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>

                        {/* Download Button - Sequential Blur Fade-in */}
                        <motion.button
                          onClick={handleDownload}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                          variants={successVariants}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: 0.8 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Download File
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </main>
  );
}
