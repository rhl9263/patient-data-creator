'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import TextArea from '@/components/ui/TextArea';
import Card from '@/components/ui/Card';
import PageLayout from '@/components/ui/PageLayout';
import { encodeToBase64, decodeFromBase64, downloadDecodedFile } from '@/utils/base64';

export default function Base64EncoderPage() {
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [mode, setMode] = useState('encode'); // 'encode' or 'decode'
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  const handleTextProcess = () => {
    if (!inputText.trim()) {
      alert('Please enter text to process');
      return;
    }

    try {
      if (mode === 'encode') {
        setOutputText(encodeToBase64(inputText));
      } else {
        setOutputText(decodeFromBase64(inputText));
      }
    } catch (error) {
      alert(`Error ${mode === 'encode' ? 'encoding' : 'decoding'}: ${error.message}`);
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 2 * 1024 * 1024) { // 2MB limit
      alert('File size must be less than 2MB');
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target.result;
        if (mode === 'encode') {
          // For encoding, convert file to base64
          const base64 = result.split(',')[1]; // Remove data:mime;base64, prefix
          setOutputText(base64);
        } else {
          // For decoding, treat file content as base64 string
          try {
            const decoded = atob(result);
            setOutputText(decoded);
          } catch (error) {
            alert('Invalid Base64 content in file');
          }
        }
        setIsProcessing(false);
      };

      if (mode === 'encode') {
        reader.readAsDataURL(selectedFile);
      } else {
        reader.readAsText(selectedFile);
      }
    } catch (error) {
      alert(`Error processing file: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const handleDecodeAndDownload = () => {
    if (!outputText.trim()) {
      alert('No decoded content to download');
      return;
    }

    try {
      downloadDecodedFile(outputText, 'decoded_file');
    } catch (error) {
      alert(`Error downloading file: ${error.message}`);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (error) {
      alert('Failed to copy to clipboard');
    }
  };

  const clearAll = () => {
    setInputText('');
    setOutputText('');
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-100 to-pink-50 p-8">
      <div className="max-w-6xl mx-auto bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-10 border border-purple-100">
        <button
          type="button"
          onClick={() => router.push('/create-patients')}
          className="mb-6 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-200 via-purple-200 to-blue-200 text-purple-800 font-semibold shadow hover:bg-pink-300 transition border border-purple-200"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-extrabold mb-4 text-gradient bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 bg-clip-text text-transparent drop-shadow-lg text-center">
          Base64 Encoder / Decoder
        </h1>
        
        <div className="text-center mb-8">
          <p className="text-purple-700 mb-2">Encoders - Cryptography</p>
          <p className="text-sm text-purple-600">
            Encodes or decodes a string so that it conforms to the Base64 Data Encodings specification (RFC 4648).
          </p>
          <p className="text-sm text-purple-600 mt-2">
            If you are decoding a binary file, use the 'Decode and download' button. The decoder will try to figure out the file type if it can. 
            The maximum size limit for file upload is 2 megabytes. All files bigger than 500k will be output to a new window for performance reason and to prevent your browser from being unresponsive.
          </p>
        </div>

        {/* Mode Selection */}
        <div className="mb-6 flex justify-center gap-4">
          <button
            type="button"
            onClick={() => setMode('encode')}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              mode === 'encode'
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200'
            }`}
          >
            Encode
          </button>
          <button
            type="button"
            onClick={() => setMode('decode')}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              mode === 'decode'
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200'
            }`}
          >
            Decode
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-purple-800">
              Option 1: Copy-paste the string to {mode}
            </h2>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Enter text to ${mode}...`}
              className="w-full h-64 p-4 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-purple-50/60 text-purple-900 placeholder:text-purple-400"
            />
            <button
              type="button"
              onClick={handleTextProcess}
              className="w-full py-3 px-4 rounded-lg shadow-md text-base font-bold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 hover:from-pink-500 hover:to-blue-600 focus:outline-none focus:ring-4 focus:ring-pink-200 transition"
            >
              {mode === 'encode' ? 'Encode' : 'Decode'}
            </button>

            <h2 className="text-xl font-semibold text-purple-800 pt-4">
              Option 2: Or upload a file to {mode}
            </h2>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="w-full p-3 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-purple-50/60"
            />
            {file && (
              <p className="text-sm text-purple-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Output Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-purple-800">
              {mode === 'encode' ? 'Encoded' : 'Decoded'} Result
            </h2>
            <textarea
              value={outputText}
              readOnly
              placeholder={`${mode === 'encode' ? 'Encoded' : 'Decoded'} result will appear here...`}
              className="w-full h-64 p-4 border border-purple-200 rounded-lg bg-gray-50 text-purple-900 placeholder:text-purple-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(outputText)}
                disabled={!outputText.trim()}
                className="flex-1 py-2 px-4 rounded-lg font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 border border-purple-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Copy to Clipboard
              </button>
              {mode === 'decode' && (
                <button
                  type="button"
                  onClick={handleDecodeAndDownload}
                  disabled={!outputText.trim()}
                  className="flex-1 py-2 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Decode and Download
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="w-full py-2 px-4 rounded-lg font-semibold text-red-700 bg-red-100 hover:bg-red-200 border border-red-200 transition"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Information Section */}
        <div className="mt-12 space-y-6">
          <h2 className="text-2xl font-bold text-purple-800">Base64 Encoding Explained</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-purple-700 mb-2">Why do I need Base64 encoding?</h3>
              <p className="text-purple-600">
                Base64 is an encoding scheme used to represent binary data in an ASCII format. This is useful when binary data needs to be sent over media that are usually designed to handle textual data. Concrete examples would be sending images in an XML file or in an email attachment.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-purple-700 mb-2">How does Base64 encoding work?</h3>
              <p className="text-purple-600">
                Bytes forming the data are broken into buffers of 24 bits (3 bytes at a time). The resulting buffer of 3 bytes is then broken in 4 packs of 6 bits each. Those 6 bits form a number corresponding to the index in the character set supported by Base64 (A-Z, a-z, 0-9, + and /). If the number of bytes are not in numbers of three, then padding is used; == for 1 byte and = for 2 bytes.
              </p>
              <p className="text-purple-600 mt-2">
                Consult <a href="https://en.wikipedia.org/wiki/Base64" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">wikipedia</a> for more information.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-purple-700 mb-2">How can I embed Base64 encoded resource directly into HTML, XML and CSS files?</h3>
              <p className="text-purple-600 mb-4">Listed here are a few examples on how to embed Base64 resources within different web documents.</p>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-purple-700">HTML JavaScript embedding:</h4>
                  <pre className="bg-purple-50 p-3 rounded-lg text-sm overflow-x-auto text-purple-800 mt-2">
{`<script type="text/javascript" src="data:text/javascript;base64,/9j/4AAQSkZJRgABAQEAWgBaAAD/4gxYSUNDX1BST0ZJTEUAAQEAAAxITGlubwIQAAB..."></script>`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-medium text-purple-700">HTML CSS embedding:</h4>
                  <pre className="bg-purple-50 p-3 rounded-lg text-sm overflow-x-auto text-purple-800 mt-2">
{`<link rel="stylesheet" type="text/css" href="data:text/css;base64,/9j/4AAQSkZJRgABAQEAWgBaAAD/4gxYSUNDX1BST0ZJTEUAAQEAAAxITGlubwIQAAB..." />`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-medium text-purple-700">HTML image embedding:</h4>
                  <pre className="bg-purple-50 p-3 rounded-lg text-sm overflow-x-auto text-purple-800 mt-2">
{`<img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAWgBaAAD/4gxYSUNDX1BST0ZJTEUAAQEAAAxITGlubwIQAAB..." />`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-medium text-purple-700">XML image embedding:</h4>
                  <pre className="bg-purple-50 p-3 rounded-lg text-sm overflow-x-auto text-purple-800 mt-2">
{`<xml>
   <image>data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAWgBaAAD/4gxYSUNDX1BST0ZJTEUAAQEAAAxITGlubwIQAAB...</image>
</xml>`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-medium text-purple-700">CSS image embedding:</h4>
                  <pre className="bg-purple-50 p-3 rounded-lg text-sm overflow-x-auto text-purple-800 mt-2">
{`.someclass {
   background-image: url('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAWgBaAAD/4gxYSUNDX1BST0ZJTEUAAQEAAAxITGlubwIQAAB...');
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
