import React, { useEffect, useState } from 'react';

// Mobile-specific optimizations and utilities
export const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [orientation, setOrientation] = useState('portrait');

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);
      setOrientation(width > height ? 'landscape' : 'portrait');
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return { isMobile, isTablet, orientation };
};

// Touch gesture handler for mobile interactions
export const useTouchGestures = (elementRef, options = {}) => {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = options.minSwipeDistance || 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now()
    });
  };

  const onTouchMove = (e) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now()
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isUpSwipe = distanceY > minSwipeDistance;
    const isDownSwipe = distanceY < -minSwipeDistance;

    if (isLeftSwipe && options.onSwipeLeft) {
      options.onSwipeLeft();
    }
    if (isRightSwipe && options.onSwipeRight) {
      options.onSwipeRight();
    }
    if (isUpSwipe && options.onSwipeUp) {
      options.onSwipeUp();
    }
    if (isDownSwipe && options.onSwipeDown) {
      options.onSwipeDown();
    }
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', onTouchStart);
    element.addEventListener('touchmove', onTouchMove);
    element.addEventListener('touchend', onTouchEnd);

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }, [elementRef, touchStart, touchEnd]);

  return { touchStart, touchEnd };
};

// Viewport height handler for mobile browsers
export const useViewportHeight = () => {
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  useEffect(() => {
    const updateHeight = () => {
      // Use visualViewport if available (better for mobile)
      const height = window.visualViewport 
        ? window.visualViewport.height 
        : window.innerHeight;
      
      setViewportHeight(height);
      
      // Update CSS custom property for dynamic viewport height
      document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);
    };

    updateHeight();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateHeight);
      return () => window.visualViewport.removeEventListener('resize', updateHeight);
    } else {
      window.addEventListener('resize', updateHeight);
      window.addEventListener('orientationchange', updateHeight);
      return () => {
        window.removeEventListener('resize', updateHeight);
        window.removeEventListener('orientationchange', updateHeight);
      };
    }
  }, []);

  return viewportHeight;
};

// Performance optimization for mobile
export const useMobilePerformance = () => {
  useEffect(() => {
    // Reduce animations on low-end devices
    const isLowEndDevice = navigator.hardwareConcurrency <= 2 || 
                          navigator.deviceMemory <= 2;
    
    if (isLowEndDevice) {
      document.documentElement.style.setProperty('--animation-duration', '0.1s');
      document.documentElement.style.setProperty('--transition-duration', '0.1s');
    }

    // Optimize scrolling performance
    const optimizeScrolling = () => {
      document.body.style.overflowScrolling = 'touch';
      document.body.style.WebkitOverflowScrolling = 'touch';
    };

    optimizeScrolling();

    // Prevent zoom on double tap
    let lastTouchEnd = 0;
    const preventZoom = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('touchend', preventZoom, { passive: false });

    return () => {
      document.removeEventListener('touchend', preventZoom);
    };
  }, []);
};

// Safe area insets for devices with notches
export const useSafeAreaInsets = () => {
  const [safeAreaInsets, setSafeAreaInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });

  useEffect(() => {
    const updateSafeAreaInsets = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      
      setSafeAreaInsets({
        top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)')) || 0,
        right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)')) || 0,
        bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)')) || 0,
        left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)')) || 0
      });
    };

    updateSafeAreaInsets();
    window.addEventListener('resize', updateSafeAreaInsets);
    window.addEventListener('orientationchange', updateSafeAreaInsets);

    return () => {
      window.removeEventListener('resize', updateSafeAreaInsets);
      window.removeEventListener('orientationchange', updateSafeAreaInsets);
    };
  }, []);

  return safeAreaInsets;
};

// Mobile-optimized button component
export const MobileButton = ({ 
  children, 
  onClick, 
  className = '', 
  disabled = false,
  hapticFeedback = true,
  ...props 
}) => {
  const handleClick = (e) => {
    // Provide haptic feedback on supported devices
    if (hapticFeedback && navigator.vibrate) {
      navigator.vibrate(10);
    }
    
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      className={`btn ${className}`}
      onClick={handleClick}
      disabled={disabled}
      style={{
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        minHeight: '44px', // iOS minimum touch target
        ...props.style
      }}
      {...props}
    >
      {children}
    </button>
  );
};

// Mobile-optimized input component
export const MobileInput = ({ 
  type = 'text', 
  className = '', 
  onFocus,
  onBlur,
  ...props 
}) => {
  const handleFocus = (e) => {
    // Scroll input into view on mobile
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        e.target.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300);
    }
    
    if (onFocus) {
      onFocus(e);
    }
  };

  const handleBlur = (e) => {
    // Scroll back to top on mobile after input
    if (window.innerWidth <= 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <input
      type={type}
      className={`form-control ${className}`}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={{
        fontSize: '16px', // Prevent zoom on iOS
        WebkitAppearance: 'none',
        ...props.style
      }}
      {...props}
    />
  );
};

export default {
  useMobileDetection,
  useTouchGestures,
  useViewportHeight,
  useMobilePerformance,
  useSafeAreaInsets,
  MobileButton,
  MobileInput
};