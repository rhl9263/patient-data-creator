/**
 * Reusable Button component with consistent styling
 */
export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false, 
  loading = false,
  className = '',
  ...props 
}) {
  const baseClasses = 'font-semibold rounded-lg transition focus:outline-none focus:ring-4 disabled:opacity-60 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'text-white bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 hover:from-pink-500 hover:to-blue-600 focus:ring-pink-200',
    secondary: 'text-purple-800 bg-gradient-to-r from-pink-200 via-purple-200 to-blue-200 hover:bg-pink-300 border border-purple-200',
    outline: 'text-purple-700 bg-purple-100 hover:bg-purple-200 border border-purple-200',
    danger: 'text-red-700 bg-red-100 hover:bg-red-200 border border-red-200',
    success: 'text-white bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600'
  };
  
  const sizes = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;
  
  return (
    <button 
      className={classes} 
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
          {children}
        </span>
      ) : children}
    </button>
  );
}
