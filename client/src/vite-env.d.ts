/// <reference types="vite/client" />

// Allow plain CSS files to be imported as side-effects
declare module '*.css' {
  const content: Record<string, string>
  export default content
}

// Specific declaration for react-big-calendar styles
declare module 'react-big-calendar/lib/css/react-big-calendar.css'
