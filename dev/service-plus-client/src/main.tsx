import { StrictMode } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";

import "./index.css";
import { apolloClient } from "./lib/apollo-client";
import { router } from "./router";
import { store } from "./store";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <Provider store={store}>
        <RouterProvider router={router} />
        <Toaster 
          position="top-right" 
          richColors 
          expand 
          closeButton 
          toastOptions={{
            style: {
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 10px 30px -10px rgba(0,0,0,0.2)',
            },
          }}
        />
      </Provider>
    </ApolloProvider>
  </StrictMode>
);
