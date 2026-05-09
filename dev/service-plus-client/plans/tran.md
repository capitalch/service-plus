# Plan for modifying "Update Job" feature
- Undo last transaction
    - In all the drop down actions provide "Undo Last Transaction" in red
    - Show a valid warning when a user clicks this
    - This will delete the last transaction of the job and restore to previous status
    - This option will also be available to the read only statuses
    - This option will not be available when "All" button is clicked.
    - This option will not be available for jobs which are in received status and only one transaction has been performed.