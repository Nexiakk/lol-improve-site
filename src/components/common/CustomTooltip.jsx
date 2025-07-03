import React from "react";
import Tippy from "@tippyjs/react";

import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale-subtle.css";

const CustomTooltip = ({ children, content, ...props }) => {
  if (!content) {
    return <>{children}</>;
  }

  if (!children) {
    return null;
  }

  return (
    <Tippy content={content} animation="scale-subtle" placement="top" interactive={true} className="custom-tooltip" {...props}>
      {/* FINAL SOLUTION:
        1. A wrapper is REQUIRED to prevent crashes. We use a div.
        2. We style the div with 'display: flex'. This makes the wrapper "shrink-wrap"
           its child, preventing it from adding extra space or expanding its parent container.
           This is the most robust way to solve the layout shift issue.
      */}
      <div style={{ display: "flex" }}>{children}</div>
    </Tippy>
  );
};

export default CustomTooltip;
