export function cn(...inputs) {
  // Simple implementation of clsx + twMerge for React Native
  const classes = inputs.filter(Boolean);
  return classes.join(' ');
}

export function formatDate(date) {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return new Intl.DateTimeFormat('en-US', options).format(date);
}
