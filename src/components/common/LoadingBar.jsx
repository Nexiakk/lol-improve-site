import React from 'react';

/**
 * A simple, indeterminate loading bar that sits at the top of the screen.
 */
const LoadingBar = () => {
  return (
    <div className="fixed top-0 left-0 w-full h-1 z-50 bg-orange-500/20 overflow-hidden">
      <div className="absolute h-full w-full bg-orange-500 animate-loading-bar"></div>
    </div>
  );
};

// A simple keyframe animation for the loading bar
const styles = `
@keyframes loading-bar-animation {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(0%);
  }
  100% {
    transform: translateX(100%);
  }
}
.animate-loading-bar {
  animation: loading-bar-animation 1.5s infinite linear;
}
`;

// Inject styles into the document head
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);


export default LoadingBar;