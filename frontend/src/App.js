import React, { useState, useEffect, useRef } from 'react';
import { Upload, Send, FileText, MessageCircle, Brain, Loader2 } from 'lucide-react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FinQueryAI = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [sessionId] = useState(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchDocuments();
    // Add welcome message
    setMessages([{
      id: 'welcome',
      type: 'assistant',
      content: 'Welcome to FinQuery AI! Upload your financial documents (PDF, DOCX, XLSX) and ask me questions about them. I\'ll analyze the content and provide accurate answers with source references.',
      timestamp: new Date(),
      sources: []
    }]);
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API}/documents`);
      setUploadedDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadProgress(0);
    const uploadMessage = {
      id: `upload-${Date.now()}`,
      type: 'upload',
      content: `Uploading ${file.name}...`,
      timestamp: new Date(),
      fileName: file.name,
      fileSize: file.size
    };

    setMessages(prev => [...prev, uploadMessage]);

    try {
      setIsLoading(true);
      const response = await axios.post(`${API}/upload-document`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      // Update upload message with success
      setMessages(prev => prev.map(msg => 
        msg.id === uploadMessage.id ? {
          ...msg,
          type: 'upload-success',
          content: `✅ Successfully uploaded and processed ${file.name}`,
          documentInfo: response.data
        } : msg
      ));

      await fetchDocuments();
    } catch (error) {
      console.error('Error uploading file:', error);
      // Update upload message with error
      setMessages(prev => prev.map(msg => 
        msg.id === uploadMessage.id ? {
          ...msg,
          type: 'upload-error',
          content: `❌ Error uploading ${file.name}: ${error.response?.data?.detail || 'Upload failed'}`
        } : msg
      ));
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/chat`, {
        session_id: sessionId,
        message: userMessage.content
      });

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: response.data.response,
        sources: response.data.sources || [],
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: `error-${Date.now()}`,
        type: 'error',
        content: 'Sorry, I encountered an error processing your question. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderMessage = (message) => {
    switch (message.type) {
      case 'user':
        return (
          <div className="flex justify-end mb-4">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl px-6 py-3 max-w-lg shadow-lg">
              <p className="text-sm leading-relaxed">{message.content}</p>
            </div>
          </div>
        );

      case 'assistant':
        return (
          <div className="flex items-start mb-6">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white rounded-2xl px-6 py-4 shadow-lg border border-gray-100 max-w-4xl">
              <p className="text-gray-800 leading-relaxed mb-3 whitespace-pre-wrap">{message.content}</p>
              {message.sources && message.sources.length > 0 && (
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <p className="text-xs text-gray-500 mb-2 font-semibold">📎 Sources:</p>
                  {message.sources.map((source, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3 mb-2 border-l-4 border-indigo-400">
                      <p className="text-xs text-indigo-600 font-medium mb-1">{source.filename}</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{source.text}</p>
                      <p className="text-xs text-gray-400 mt-1">Relevance: {(source.similarity * 100).toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'upload':
        return (
          <div className="flex justify-center mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-6 py-4 max-w-md">
              <div className="flex items-center">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin mr-2" />
                <p className="text-blue-700 text-sm">{message.content}</p>
              </div>
              {uploadProgress > 0 && (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                    style={{width: `${uploadProgress}%`}}
                  ></div>
                </div>
              )}
            </div>
          </div>
        );

      case 'upload-success':
        return (
          <div className="flex justify-center mb-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-4 max-w-md">
              <p className="text-green-700 text-sm">{message.content}</p>
              {message.documentInfo && (
                <div className="mt-2 text-xs text-green-600">
                  <p>📄 {message.documentInfo.chunk_count} chunks processed</p>
                  <p>🔍 Ready for questions</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'upload-error':
        return (
          <div className="flex justify-center mb-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 max-w-md">
              <p className="text-red-700 text-sm">{message.content}</p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="flex justify-center mb-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 max-w-md">
              <p className="text-red-700 text-sm">⚠️ {message.content}</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  FinQuery AI
                </h1>
                <p className="text-sm text-gray-500">Financial Document Intelligence</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FileText className="w-4 h-4" />
                <span>{uploadedDocuments.length} documents</span>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.docx,.xlsx"
                onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2 rounded-full hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                disabled={isLoading}
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-xl border border-white/20 overflow-hidden">
          {/* Chat Area */}
          <div 
            className={`h-96 overflow-y-auto p-6 ${isDragging ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {isDragging && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                  <p className="text-blue-600 font-medium">Drop your financial document here</p>
                  <p className="text-blue-400 text-sm">Supports PDF, DOCX, XLSX (max 20MB)</p>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id}>
                  {renderMessage(message)}
                </div>
              ))}
              
              {isLoading && messages[messages.length - 1]?.type !== 'upload' && (
                <div className="flex items-start mb-6">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <div className="bg-white rounded-2xl px-6 py-4 shadow-lg border border-gray-100">
                    <p className="text-gray-500">Analyzing your documents...</p>
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-6 bg-white/50">
            <div className="flex space-x-4">
              <div className="flex-1 relative">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={uploadedDocuments.length > 0 
                    ? "Ask questions about your documents..." 
                    : "Upload a document first, then ask questions..."
                  }
                  className="w-full px-4 py-3 pr-12 bg-white border border-gray-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none shadow-sm"
                  rows="2"
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            
            {uploadedDocuments.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {uploadedDocuments.map((doc) => (
                  <div key={doc.id} className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs">
                    <span className="text-indigo-700 font-medium">{doc.filename}</span>
                    <span className="text-indigo-500 ml-2">({formatFileSize(doc.file_size)})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <FinQueryAI />
    </div>
  );
}

export default App;