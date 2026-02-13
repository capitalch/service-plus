# instructions
    - This is fastapi based server to implement Service management system to repair electronic gadgets 
    - When any text command is given to claude and last word is plan then do the plan only for the given command. Write your plan in the plan.md file in the plans folder in root. Overwrite plan.md if required.
    - In plan.md write all the steps of execution as Step1, Step 2 and so on.
    - This is server side code. It uses fastApi and GraphQL
    - python environment is in c:\projects\service-plus\env folder. New libraries can be installed through pip install in env folder
    - We can use the libraries fastapi uvicorn pydantic typing ariadne pycopg[binary]
    - Use best practices while writing python code
    - use logger
    - Keep all custon exception messages or custom messages in a single class file and use its properties to show exception messages
