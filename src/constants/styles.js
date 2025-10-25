/**
 * Consistent styling constants
 */

export const COLORS = {
  primary: 'from-blue-600 via-purple-600 to-pink-500',
  primaryHover: 'from-pink-500 to-blue-600',
  secondary: 'from-pink-200 via-purple-200 to-blue-200',
  accent: 'from-green-100 via-blue-100 to-purple-100',
  purple: {
    50: 'purple-50',
    100: 'purple-100',
    200: 'purple-200',
    600: 'purple-600',
    700: 'purple-700',
    800: 'purple-800'
  }
};

export const GRADIENTS = {
  background: 'bg-gradient-to-br from-blue-50 via-purple-100 to-pink-50',
  primary: `bg-gradient-to-r ${COLORS.primary}`,
  secondary: `bg-gradient-to-r ${COLORS.secondary}`,
  accent: `bg-gradient-to-r ${COLORS.accent}`,
  text: `bg-gradient-to-r ${COLORS.primary} bg-clip-text text-transparent`
};

export const SHADOWS = {
  card: 'shadow-2xl',
  button: 'shadow-md',
  input: 'shadow-sm'
};

export const BORDERS = {
  purple: 'border-purple-200',
  red: 'border-red-400',
  rounded: 'rounded-lg',
  roundedLarge: 'rounded-2xl'
};

export const TRANSITIONS = {
  default: 'transition',
  all: 'transition-all duration-200 ease-in-out'
};
