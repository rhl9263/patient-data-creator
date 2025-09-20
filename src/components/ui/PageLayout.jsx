/**
 * Reusable Page Layout component with consistent background and container
 */
export default function PageLayout({ 
  children, 
  maxWidth = '6xl',
  className = '' 
}) {
  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '6xl': 'max-w-6xl',
    full: 'max-w-full'
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-100 to-pink-50 p-8">
      <div className={`${maxWidths[maxWidth]} mx-auto ${className}`}>
        {children}
      </div>
    </div>
  );
}
