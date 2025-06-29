'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
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
      dataSourceIdentifier: "LAB2",
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
          status: 200,
          id: res.id,
          data: res,
          payload: payloads[index] // Keep reference to original payload
        })));
      } else {
        throw new Error(result.error);
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
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  if (!credentials) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading credentials...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold mb-6">Create Patient Records</h1>
        <p className="mb-4">Connected to: {credentials.domain}</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Records:
              <input
                type="number"
                min="1"
                value={records}
                onChange={(e) => setRecords(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clinical Items:
              <button
                type="button"
                onClick={() => {
                  setSelectedCategories(selectedCategories.length === categories.length 
                    ? [] 
                    : [...categories]);
                }}
                className="ml-4 text-sm text-blue-600 hover:text-blue-800"
              >
                {selectedCategories.length === categories.length 
                  ? 'Deselect All' 
                  : 'Select All'}
              </button>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`category-${category}`}
                    checked={selectedCategories.includes(category)}
                    onChange={() => handleCategoryChange(category)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <label htmlFor={`category-${category}`} className="text-sm">
                    {category}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating Records...' : 'Create Patients'}
          </button>
        </form>

        <div>
          <br/><br/>
        <h2 className="text-xl font-semibold mb-4">API Responses : </h2>
        </div>

        {responses.map((response, i) => (
          <div key={i} className="mb-4 p-4 border rounded-lg bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">
              Record {i+1}: {
                   (response?.data?.status === 200) 
                    ? '✅ Success' 
                    : '❌ Error'
                }</h3>
              {response.id && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
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
                    <code className="bg-gray-100 px-2 py-1 rounded">{response.id}</code>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-600 mt-2">
                Error: {response?.data?.data?.message}
              </div>
            )}

            {/* Optional: Show full response in expandable section */}
            <details className="mt-3">
              <summary className="text-sm text-gray-500 cursor-pointer">
                View details
              </summary>
              <pre className="bg-gray-50 p-2 mt-1 rounded text-xs overflow-x-auto">
                {JSON.stringify(response.data || response.error, null, 2)}
              </pre>
            </details>
          </div>
        ))}
        
      </div>
    </div>
  );
}