import type { RootStateType } from "@/store";
import { Button } from "../ui/button";
import { useDispatch, useSelector } from "react-redux";
import { decrement, increment, incrementByNum, reset } from "./redux-counter-slice";

export function ReduxCounter() {
    const dispatch = useDispatch();
    const counterValue = useSelector((state: RootStateType) => state.counter.value);
    return (
        <div className="m-4 flex flex-col items-start gap-4">
            <h1>Redux Counter: {counterValue}</h1>
            <div className="flex gap-2">
                <Button variant='default' onClick={handleIncrement}>Increment</Button>
                <Button variant='outline' onClick={handleIncrementByNum}>Increment by num</Button>
            </div>
            <Button variant='outline' onClick={handleDecrement}>Decrement</Button>
            <Button variant='destructive' onClick={handleReset}>Reset</Button>
        </div>
    )

    function handleIncrement() {
        dispatch(increment())
        // Dispatch increment action to Redux store
    }

    function handleDecrement() {
        dispatch(decrement())
        // Dispatch decrement action to Redux store
    }

    function handleReset() {
        dispatch(reset())
        // Dispatch reset action to Redux store
    }

    function handleIncrementByNum() {
        const num = parseInt(prompt("Enter a number to increment by:", "0") || "0", 10);
        dispatch(incrementByNum(num));
    }

}