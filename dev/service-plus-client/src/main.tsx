import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { ApolloProvider } from "@apollo/client/react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";

import "./index.css";
import { store } from "./store";
import { apolloClient } from "./lib/apollo-client";
import { router } from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <ApolloProvider client={apolloClient}>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
      </ApolloProvider>
    </Provider>
  </StrictMode>
);
