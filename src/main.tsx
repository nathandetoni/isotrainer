import React from "react";
import ReactDOM from "react-dom/client";
// i18n must be imported before App so it's initialized before any component renders
import "./i18n";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
