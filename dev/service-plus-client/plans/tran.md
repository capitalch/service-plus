# Plan for modifying the batch jobs
- Minimum two jobs are mandatory to create a batch job. If less than 2 jobs are there then there is validation error
- Follow the same pattern and architecture of single job, except that the batch job will have multiple jobs.
- Just as in single job, the new entry in Batch jobs will have quick info card at top showing the last batch having information and attached files for each job. Every job in batch job should occupy a single line to show job information
- Job numbers witll be auto created at server side as in single job, at the time of saving the batch job
- The customer name should be same for all jobs in a batch job
- No job no is available at the time of creating a batch job, it will be available after saving the batch job.
- The UI should be similar to single job form but with the modification that it will have multiple jobs.
- The file attachment will happen after saving the batch job, using the job numbers received from the server. ReUse the same file attachment component used in single job.
- The UI needs to be compact and responsive.
- Clean up existing batch job code at both client side and server side and modify the code if needed


