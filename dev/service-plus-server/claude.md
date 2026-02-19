# instructions
    - limit yourself to current folder
    - This is fastapi based server to implement Service management system to repair electronic gadgets
    - When any text command is given to claude and last word is plan then do the plan only for the given command. Write your plan in the plan.md file in the plans folder in root. Overwrite plan.md if required.
    - In plan.md write all the steps of execution as Step1, Step 2 and so on.
    - In plan.md include a workflow section which provides the workflow of entire steps
    - Use best practices while writing python code
    - use logger
    - Keep all custon exception messages or custom messages in a single class file and use its properties to show exception messages
    - All authorization and authentication based SQL will be kept in a single python class file
    - All SQL for application will also be kept in an another python class file
    - Use a router to keep all other than graphql endpoints and keep main.py short
    - Use graphql for secured calls
    - In one file always sort code by function names, class names, end point names and field names

# Virtual Environment Setup
    - Python virtual environment is located at: c:\projects\service-plus\env
    - All project dependencies are installed in this isolated environment
    - Python version: 3.14.3

    ## Activating Virtual Environment:
    - Windows: Run `activate.bat` or call `c:\projects\service-plus\env\Scripts\activate.bat`
    - Or use the Python directly: `c:\projects\service-plus\env\Scripts\python.exe`

    ## Installing New Libraries:
    - Always use the virtual environment pip: `c:\projects\service-plus\env\Scripts\python.exe -m pip install <package>`
    - Or activate venv first, then: `pip install <package>`
    - Update requirements.txt after installing new packages

    ## Running the Server:
    - Option 1: Run `run_server.bat`
    - Option 2: `c:\projects\service-plus\env\Scripts\python.exe -m uvicorn app.main:app --reload`
    - Option 3: Activate venv, then `python -m uvicorn app.main:app --reload`

    ## Installed Libraries:
    - fastapi, uvicorn[standard], pydantic, pydantic-settings
    - ariadne (GraphQL), graphql-core
    - psycopg[binary] (PostgreSQL)
    - websockets (for GraphQL subscriptions)
    - All dependencies are in requirements.txt
