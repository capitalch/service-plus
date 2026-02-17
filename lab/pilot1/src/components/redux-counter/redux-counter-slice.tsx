import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface CounterState {
    value: number;
}

const initialState: CounterState = {
    value: 0,
};

export const counterSlice = createSlice({
    name: "counter",
    initialState,
    reducers: {
        increment: (state: CounterState) => {
            state.value += 1;
        },
        incrementByNum: (state: CounterState, action: PayloadAction<number>) => {
            state.value += action.payload;
        },
        decrement: (state: CounterState) => {
            state.value -= 1;
        },
        reset: (state: CounterState) => {
            state.value = 0;
        }
    },
});

export const { increment, incrementByNum, decrement, reset } = counterSlice.actions;
export const counterReducer = counterSlice.reducer;