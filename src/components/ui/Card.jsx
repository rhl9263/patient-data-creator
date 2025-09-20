/**
 * Reusable Card component for consistent container styling
 */
export default function Card({ 
  children, 
  className = '', 
  padding = 'lg',
  ...props 
}) {
  const baseClasses = 'bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-purple-100';
  
  const paddings = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-10',
    xl: 'p-12'
  };
  
  const classes = `${baseClasses} ${paddings[padding]} ${className}`;
  
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
