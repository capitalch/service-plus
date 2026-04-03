# Create Search part dialog from scratch: two options
- Both options run different sql's at server
- Option 1: 
    - part code starts with
- Option 2: 
    - typed chars are embedded in part_name, part_description, model, category
- when part code is available, option 1 is enabled
- when user clicks on option 2 text box, it is enabled and search is performed on part_name, part_description, model, category when user types in (debounce 1200ms)
- when user clicks on option 1 text box, it is enabled and search is performed on part_code when user types in (debounce 1200ms) or already some text is available for option 1

