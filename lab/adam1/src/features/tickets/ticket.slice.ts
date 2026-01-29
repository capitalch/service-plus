import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { Ticket, TicketFilter } from "./types";

interface TicketState {
  selectedTicket: Ticket | null;
  filters: TicketFilter;
  isFormOpen: boolean;
  isDetailOpen: boolean;
}

const initialState: TicketState = {
  selectedTicket: null,
  filters: {},
  isFormOpen: false,
  isDetailOpen: false,
};

const ticketSlice = createSlice({
  name: "ticket",
  initialState,
  reducers: {
    setSelectedTicket: (state, action: PayloadAction<Ticket | null>) => {
      state.selectedTicket = action.payload;
    },
    setFilters: (state, action: PayloadAction<TicketFilter>) => {
      state.filters = action.payload;
    },
    updateFilter: (state, action: PayloadAction<Partial<TicketFilter>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    setFormOpen: (state, action: PayloadAction<boolean>) => {
      state.isFormOpen = action.payload;
    },
    setDetailOpen: (state, action: PayloadAction<boolean>) => {
      state.isDetailOpen = action.payload;
    },
    openTicketForm: (state, action: PayloadAction<Ticket | null>) => {
      state.selectedTicket = action.payload;
      state.isFormOpen = true;
    },
    closeTicketForm: (state) => {
      state.selectedTicket = null;
      state.isFormOpen = false;
    },
    openTicketDetail: (state, action: PayloadAction<Ticket>) => {
      state.selectedTicket = action.payload;
      state.isDetailOpen = true;
    },
    closeTicketDetail: (state) => {
      state.selectedTicket = null;
      state.isDetailOpen = false;
    },
  },
});

export const {
  setSelectedTicket,
  setFilters,
  updateFilter,
  clearFilters,
  setFormOpen,
  setDetailOpen,
  openTicketForm,
  closeTicketForm,
  openTicketDetail,
  closeTicketDetail,
} = ticketSlice.actions;

export default ticketSlice.reducer;
