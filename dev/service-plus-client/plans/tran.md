# Design change for Job Search
- Job search landing page will now have transaction capacity for job status changes as the Job Pipeline Page (clicked at a status and status change page comes) has.
- Add an icon in actions similar to pipeline page transaction icon(two horizontal arrows)
- This click icon will do the same work as job pipeline status clicked, transaction icon clicked does. Based on current status of job, it will generate a dropdown with option available to the job status.
- Provide end to end complete functionality of Job Pipeline status change without going to any other page
- Finally refresh the page to reflect current status
- This way, user can do all transactions with minimum efforts.
- Reuse code from job pipeline and only change as per requirement.