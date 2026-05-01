# Plan for files upload location at server
- At present when the user uploads a file from job-image-upload.tsx it is uploaded using a file server in folder service-plus-file-server
- At file server the files are stored in the folder defined by BASE_DIR in .env file. That is fine. It defines the root folder where files are stored.
- I now want the following hierarchy of folders at the file server
    - base folder (BASE_DIR)
        - client code
            - bu code
                - branch code
                    - job no (snake format)
                        - filename (snake format).ext where actual file is stored


