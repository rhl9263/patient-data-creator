'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import PageLayout from '@/components/ui/PageLayout';
import { validateDomain, storeCredentials } from '@/utils/api';

export default function RegistrationPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    domain: '',
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    
    if (!validateDomain(formData.domain)) {
      setErrors({ domain: 'Domain URL must end with .nextgenaws.net' });
      return;
    }
    
    setIsSubmitting(true);
    storeCredentials(formData);
    router.push('/create-patients');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-100 to-pink-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-3xl font-extrabold text-center mb-8 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 bg-clip-text text-transparent drop-shadow-lg">
          Domain Details
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            type="url"
            name="domain"
            label="Domain URL"
            value={formData.domain}
            onChange={handleChange}
            error={errors.domain}
            required
            placeholder="https://your-domain.nextgenaws.net/"
            pattern="https?://[a-zA-Z0-9.-]+\\.nextgenaws\\.net/?"
          />
          
          <Input
            type="text"
            name="username"
            label="Username"
            value={formData.username}
            onChange={handleChange}
            required
            placeholder="Enter your username"
          />
          
          <Input
            type="password"
            name="password"
            label="Password"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="Enter your password"
          />
          
          <Button
            type="submit"
            loading={isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? 'Connecting...' : 'Continue'}
          </Button>
        </form>
      </Card>
    </div>
  );
}