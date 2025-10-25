/**
 * Reusable TextArea component with consistent styling
 */
export default function TextArea({ 
  label, 
  error, 
  className = '', 
  required = false,
  rows = 4,
  ...props 
}) {
  const baseClasses = 'w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 bg-purple-50/60 placeholder:text-purple-300 text-purple-900 transition resize-vertical';
  const errorClasses = error ? 'border-red-400' : 'border-purple-200';
  
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-semibold text-purple-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        rows={rows}
        className={`${baseClasses} ${errorClasses} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
