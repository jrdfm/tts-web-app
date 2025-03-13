import { useEffect } from 'react';

/**
 * Hook for detecting clicks outside of a specified element
 * @param {React.RefObject} ref - Reference to the element to detect clicks outside of
 * @param {boolean} isActive - Whether the detection is active
 * @param {Function} onClickOutside - Callback function to execute when a click outside is detected
 */
export default function useClickOutside(ref, isActive, onClickOutside) {
  useEffect(() => {
    if (!isActive) return;
    
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onClickOutside();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, isActive, onClickOutside]);
} 