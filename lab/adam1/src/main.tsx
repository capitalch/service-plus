import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {registerLicense} from '@syncfusion/ej2-base'

import "./index.css";
import { AppProviders } from "./app/providers";

registerLicense('Ngo9BigBOggjHTQxAR8/V1JGaF5cXGpCf1FpRmJGdld5fUVHYVZUTXxaS00DNHVRdkdlWX5fdXVXQ2RfVk1/V0VWYEs=') // v32.x.x

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>
);
