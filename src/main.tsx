import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { CloudBackend, LocalBackend } from "./backend";
import App from "./App";
import "./styles.css";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
const root = createRoot(document.getElementById("root")!);

if (url) {
  const client = new ConvexReactClient(url);
  root.render(
    <StrictMode>
      <ConvexProvider client={client}>
        <CloudBackend>
          <App />
        </CloudBackend>
      </ConvexProvider>
    </StrictMode>
  );
} else {
  root.render(
    <StrictMode>
      <LocalBackend>
        <App />
      </LocalBackend>
    </StrictMode>
  );
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
