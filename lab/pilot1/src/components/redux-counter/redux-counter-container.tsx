import { Button } from "../ui/button";
import { ReduxCounter } from "./redux-counter";

export function ReduxCounterContainer() {
    return (
        <div >
            <Button variant="outline" onClick={() => window.history.back()} className="m-4">
                Back
            </Button>
            <ReduxCounter />
        </div>
    )
}