import { ComponentExample } from "@/components/example1/component-example";
import { ReduxCounterContainer } from "@/components/redux-counter/redux-counter-container";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <ComponentExample />
    },
    {
        path: "/redux-counter",
        element: <ReduxCounterContainer />
    }
]);