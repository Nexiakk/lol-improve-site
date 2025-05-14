// src/components/PaginationControls.jsx
import React, { useMemo } from 'react'; // Added useMemo

const DOTS = '...';

// Helper function to generate a range of numbers
const range = (start, end) => {
  let length = end - start + 1;
  return Array.from({ length }, (_, idx) => idx + start);
};

function PaginationControls({ currentPage, totalPages, onPageChange, siblingCount = 1 }) {
  // siblingCount: number of page numbers to show on each side of the current page.
  // Defaulting to 1 for a compact view like "1 ... 3 4 5 ... 8"

  const paginationRange = useMemo(() => {
    // Pages to show: firstPage + lastPage + currentPage + 2*siblings + 2*DOTS
    const totalPageNumbersToShow = siblingCount + 5; 

    /*
      Case 1:
      If the total number of pages is less than or equal to the number of
      page items we want to display, we show all page numbers.
    */
    if (totalPageNumbersToShow >= totalPages) {
      return range(1, totalPages);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    /*
      We do not show dots if there is only one page number to be inserted 
      between the extremes of sibling and the page limits i.e 1 and totalPages. 
      Hence currentPage - siblingCount > 2 and currentPage + siblingCount < totalPages - 1.
    */
    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      // Example: 1 2 3 4 5 ... 10 (currentPage is near the beginning)
      let leftItemCount = 3 + 2 * siblingCount; // 1, 2, 3, (4, 5 if siblingCount=2)
      let leftRange = range(1, leftItemCount);
      return [...leftRange, DOTS, totalPages];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      // Example: 1 ... 6 7 8 9 10 (currentPage is near the end)
      let rightItemCount = 3 + 2 * siblingCount;
      let rightRange = range(totalPages - rightItemCount + 1, totalPages);
      return [firstPageIndex, DOTS, ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      // Example: 1 ... 4 5 6 ... 10 (currentPage is in the middle)
      let middleRange = range(leftSiblingIndex, rightSiblingIndex);
      return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
    }
    
    // Fallback, though the above conditions should cover all cases for totalPages > totalPageNumbersToShow
    return range(1, totalPages); 

  }, [totalPages, siblingCount, currentPage]);

  if (totalPages <= 1 || currentPage === 0 || paginationRange.length < 2) {
    // Don't render pagination if not needed or if range is too small (e.g., only [1])
    return null;
  }

  return (
    <nav className="flex items-center justify-center space-x-1 sm:space-x-2 my-8" aria-label="Pagination">
      {/* Arrow buttons are removed */}
      {paginationRange.map((pageNumber, index) => {
        if (pageNumber === DOTS) {
          // Using index for key for DOTS is acceptable here as their position is stable relative to other DOTS
          return <span key={`dots-${index}`} className="px-2 py-2 text-sm font-medium text-gray-500 hidden sm:inline-block">...</span>;
        }

        return (
          <button
            key={`page-${pageNumber}`} // Page numbers are unique in the final range
            onClick={() => onPageChange(pageNumber)}
            className={`px-3.5 py-2 text-xs sm:px-4 sm:py-2 sm:text-sm font-medium rounded-md transition-colors
              ${currentPage === pageNumber 
                ? 'bg-orange-600 text-white shadow-md ring-1 ring-orange-500' 
                : 'text-gray-300 bg-gray-700/60 hover:bg-gray-600/80'
              }
            `}
            aria-current={currentPage === pageNumber ? 'page' : undefined}
          >
            {pageNumber}
          </button>
        );
      })}
    </nav>
  );
}

export default PaginationControls;
