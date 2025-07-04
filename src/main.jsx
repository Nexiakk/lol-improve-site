import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css"; // Kluczowy import dla globalnych stylów i Tailwind
import { LoadingProvider } from "./contexts/LoadingContext"; // Import the provider
import { ConfigProvider } from "antd";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LoadingProvider>
      <ConfigProvider
        theme={{
          token: {
            // The font family you set earlier
            fontFamily: "'Plus Jakarta Sans', sans-serif",

            // ADD THIS LINE to shorten the animation duration
            motionDurationMid: "0.1s",
          },
        }}
      >
        <App />
      </ConfigProvider>
    </LoadingProvider>
  </React.StrictMode>
);
