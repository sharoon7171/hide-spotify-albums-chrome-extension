import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../global.css";
import { OptionsApp } from "./OptionsApp";

const el = document.getElementById("root");
if (el) {
  createRoot(el).render(
    <StrictMode>
      <OptionsApp />
    </StrictMode>,
  );
}
