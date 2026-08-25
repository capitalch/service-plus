# Whatsapp notification to customer when job is completed needs change:
- Consider customer Connect screen
- I want success, fail and Last Msg columns in the grid.Success and Fail columns record no of times message delivery success or failure respectively
- I want a new column named as Whatsapp. In it Success:<x>, Failed:<y>, Last try:<date time>, last status: failed /success, values are stacked in colorful and nice manner.
- One customer can be sent messages multiple times.
- After each attempt of sending the message, the Wahatsapp column is updated
- The checkbox for sending messages will only be checked by default if messages have never been sent to that customer before. Otherwise it will not be checked. But user can check it if wishes to repeat the message sending to that job, or resend if the last attempt was failure.
- Make necessary changes in client and server code to implement it
- Create a plan first in plans/plan.md. Don't execute code.