# Modify features of CustomerInput
- On search icon click, a modal window should appear with a Search box and list box.
- Text in the customerInput input box is copied to the search box and all customer details fulfilling the search box text populates the list box in the modal window. 
- User can change the content of search box. Debounce effect will be 1600ms. List box will be repopulated. Search should be possible on any field of customer master and all fields of customer master are visible in list box. Empty value resets the search. At least two chars are required for the search to initiate and mention that in prompt text.
- Create nice and intuative UI
- Move CustomerInput and its subcomponents to a new folder "shared" in features/components folder