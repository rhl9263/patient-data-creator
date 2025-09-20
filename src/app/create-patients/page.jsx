'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import rawJsonData from '@/components/data.json';

export default function PatientCreationPage() {

  const sortedCategories = [
      "allergies", "medications", "conditions", "procedures",
      "results", "advance-directives", "encounters", "immunizations",
      "vital-signs", "functional-status", "prescriptions", 
      "dme", "social-histories", "accidents", "patient-attachments",
      "external-documents", "family-histories", "physical-exams"
    ].sort()

  const router = useRouter();
  const [credentials, setCredentials] = useState(null);
  const [records, setRecords] = useState(1);
  const [categories] = useState(sortedCategories);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [responses, setResponses] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataSourceIdentifier, setDataSourceIdentifier] = useState('LAB2');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    const storedCredentials = sessionStorage.getItem('apiCredentials');
    if (storedCredentials) {
      setCredentials(JSON.parse(storedCredentials));
    } else {
      router.push('/register');
    }
  }, [router]);

  // Helper function to generate random strings
  const generateRandomString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  const modifyJsonByKey = (originalData, keyPath, newValue) => {
    // Create a deep copy to avoid modifying the original
    const data = JSON.parse(JSON.stringify(originalData));
    
    const keys = keyPath.split('.');
    let current = data;

    // Traverse to the second-to-last key
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === undefined) {
        // Create nested objects if they don't exist
        // current[key] = {};
        console.error("Key doesn't exist");
      }
      current = current[key];
    }

    // Set the final key's value
    const finalKey = keys[keys.length - 1];
    current[finalKey] = newValue;

    return data;
  };

  // Function to auto-generate HL7 data
  const generateData = () => {

    let payload = {
      localPatientIdentifier: `Patient-Identifier-${generateRandomString(10)}`,
      dataSourceIdentifier: dataSourceIdentifier,
      events: [],
      activityDate: {
        value: new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0,14) + "+0000" 
      }
    };

    let temp = modifyJsonByKey(rawJsonData["localPatient"], "value.name.first", `Patient_${generateRandomString(10)}`)
    payload.events.push(temp);

    for (let category of selectedCategories) {
      if (rawJsonData[category] === undefined) {
        throw new Error(`${category} does not exist in json file`);
      }
      else {
        let temp = modifyJsonByKey(rawJsonData[category], "identifier.localId", generateRandomString(10))
        payload.events.push(temp);
      }
    }
    return payload;
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous validation error and responses
    setValidationError('');
    setResponses([]);
    
    // Validate dataSourceIdentifier
    if (!dataSourceIdentifier || dataSourceIdentifier.trim() === '') {
      setValidationError('Please add Data Source Identifier value.');
      return;
    }
    
    // Clear validation error before starting processing
    setValidationError('');
    setIsSubmitting(true);
  
    try {
      // Generate all payloads first
      const payloads = Array.from({ length: records }, () => generateData());
      
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: credentials.domain,
          username: credentials.username,
          password: credentials.password,
          payloads // Send all payloads at once
        })
      });
  
      const result = await response.json();
      
      if (result.success) {
        setResponses(result.responses.map((res, index) => ({
          status: res.status || 200,
          id: res.id,
          data: res
        })));
      } else {
        setResponses([{
          error: {
            message: result.error || 'Unknown error occurred',
            details: result
          }
        }]);
      }
    } catch (error) {
      setResponses([{
        error: {
          message: error.message,
          ...(error.response?.data && { details: error.response.data })
        }
      }]);
    } finally {
      setIsSubmitting(false);
      // Ensure validation error is cleared after processing
      setValidationError('');
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleDataSourceChange = (e) => {
    setDataSourceIdentifier(e.target.value);
    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError('');
    }
  };

  if (!credentials) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-100 to-pink-50 flex items-center justify-center">
        <p className="text-lg text-purple-700 font-semibold animate-pulse">Loading credentials...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-100 to-pink-50 p-8">
      <div className="max-w-6xl mx-auto bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-10 border border-purple-100">
        <button
          type="button"
          onClick={() => router.push('/register')}
          className="mb-6 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-200 via-purple-200 to-blue-200 text-purple-800 font-semibold shadow hover:bg-pink-300 transition border border-purple-200"
        >
          ← Back to Register
        </button>
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="relative inline-block text-left">
            <button
              type="button"
              className="inline-flex justify-center w-full rounded-lg border border-purple-200 shadow-sm px-4 py-2 bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 text-sm font-semibold text-purple-800 hover:bg-pink-200 focus:outline-none"
              onClick={(e) => {
                const menu = document.getElementById('message-processing-menu');
                if (menu) menu.classList.toggle('hidden');
              }}
            >
              Message Processing ▾
            </button>
            <div
              id="message-processing-menu"
              className="hidden absolute right-0 mt-2 w-44 origin-top-right bg-white border border-purple-200 rounded-lg shadow-lg z-10"
            >
              <button
                type="button"
                className="w-full text-left px-4 py-2 text-sm text-purple-800 hover:bg-purple-50"
                onClick={() => router.push('/message-processing/cda')}
              >
                CDA
              </button>
              <button
                type="button"
                className="w-full text-left px-4 py-2 text-sm text-purple-800 hover:bg-purple-50"
                onClick={() => router.push('/message-processing/hl7')}
              >
                HL7
              </button>
              <button
                type="button"
                className="w-full text-left px-4 py-2 text-sm text-purple-800 hover:bg-purple-50"
                onClick={() => router.push('/message-processing/json')}
              >
                JSON
              </button>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex justify-center rounded-lg border border-purple-200 shadow-sm px-4 py-2 bg-gradient-to-r from-green-100 via-blue-100 to-purple-100 text-sm font-semibold text-purple-800 hover:bg-green-200 focus:outline-none"
            onClick={() => router.push('/base64-encoder')}
          >
            Base64 Encoder/Decoder
          </button>
        </div>
        <h1 className="text-3xl font-extrabold mb-8 text-gradient bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 bg-clip-text text-transparent drop-shadow-lg text-center">Create Patient Records</h1>
        <p className="mb-6 text-center text-purple-700 font-medium">Connected to: <span className="font-semibold text-blue-700">{credentials.domain}</span></p>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-sm font-semibold text-purple-700 mb-2">
              Number of Records:
            </label>
            <input
              type="number"
              min="1"
              value={records}
              onChange={(e) => setRecords(Number(e.target.value))}
              className="w-full mt-1 px-4 py-2 border border-purple-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 bg-purple-50/60 placeholder:text-purple-300 text-purple-900 transition"
              required
              placeholder="Enter number of records"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-purple-700 mb-2">
              Data Source Identifier:
            </label>
            <input
              type="text"
              value={dataSourceIdentifier}
              onChange={handleDataSourceChange}
              className={`w-full mt-1 px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 bg-purple-50/60 placeholder:text-purple-300 text-purple-900 transition ${
                validationError && !isSubmitting ? 'border-red-400' : 'border-purple-200'
              }`}
              required
              placeholder="e.g., LAB2, LAB1, HOSPITAL1"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-purple-700 mb-2">
              Clinical Items:
              <button
                type="button"
                onClick={() => {
                  setSelectedCategories(selectedCategories.length === categories.length 
                    ? [] 
                    : [...categories]);
                }}
                className="ml-4 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 text-purple-700 hover:bg-pink-200 border border-purple-200 shadow-sm transition"
              >
                {selectedCategories.length === categories.length 
                  ? 'Deselect All' 
                  : 'Select All'}
              </button>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map((category) => (
                <div key={category} className="flex items-center space-x-2 bg-purple-50/40 rounded px-2 py-1">
                  <input
                    type="checkbox"
                    id={`category-${category}`}
                    checked={selectedCategories.includes(category)}
                    onChange={() => handleCategoryChange(category)}
                    className="h-4 w-4 text-pink-500 focus:ring-pink-400 border-purple-300 rounded"
                  />
                  <label htmlFor={`category-${category}`} className="text-sm text-purple-900 font-medium">
                    {category}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-3 px-4 rounded-lg shadow-md text-base font-bold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 hover:from-pink-500 hover:to-blue-600 focus:outline-none focus:ring-4 focus:ring-pink-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                Creating Records...
              </span>
            ) : 'Create Patients'}
          </button>
        </form>
        
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4 text-purple-800">API Responses :</h2>
        </div>
        {responses.map((response, i) => (
          <div key={i} className="mb-6 p-5 border border-purple-100 rounded-xl bg-white/80 shadow-md">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">
                Record {i+1}: {
                  (response?.data?.status === 200) 
                    ? '✅ Success' 
                    : '❌ Error'
                }
              </h3>
              {response.id && (
                <span className="px-3 py-1 bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 text-purple-800 rounded-full text-sm font-semibold">
                  ID: {response.id}
                </span>
              )}
            </div>
            {response?.data?.status === 200 ? (
              <div className="mt-2">
                <div className="flex gap-2 items-center">
                  <span className="font-medium">Status:</span>
                  <span className="text-green-600">{response.data.status}</span>
                </div>
                {response.id && (
                  <div className="flex gap-2 items-center">
                    <span className="font-medium">ID:</span>
                    <code className="bg-purple-50 px-2 py-1 rounded text-purple-700">{response.id}</code>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-600 mt-2">
                <div className="font-medium">Error:</div>
                <div>{response?.error?.message || response?.data?.data?.message || 'Unknown error'}</div>
              </div>
            )}
            {/* Optional: Show full response in expandable section */}
            <details className="mt-3">
              <summary className="text-sm text-gray-500 cursor-pointer">
                View details
              </summary>
              <pre className="bg-purple-50 p-2 mt-1 rounded text-xs overflow-x-auto text-purple-900">
                {JSON.stringify(response.data || response.error, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}