"""
ServicePlus MCP Test Server.

This module provides a FastMCP-based server for testing and demonstrating
repair job management tools, resources, and prompts.
"""
import os
import sys
import traceback
import urllib.parse

from mcp.server.fastmcp import FastMCP

# Add the server application to sys.path so we can import its modules
server_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "service-plus-server"))
if server_path not in sys.path:
    sys.path.append(server_path)


mcp = FastMCP("ServicePlus-MCP-Test")


@mcp.tool()
def hello_world() -> str:
    """A simple hello world tool to verify the MCP server is working."""
    return "Hello, World!"


@mcp.tool()
async def insert_test_data(db_name: str, schema: str, payload_json: str) -> str:
    """
    Make entry of test data in multiple tables using genericUpdate logic.
    Provides a single tool that can make entry of test data in server multiple tables. 

    Args:
        db_name: The target database name (e.g. 'service_plus_service' or 'service_plus_client')
        schema: The target schema (e.g. 'demo1' or 'public')
        payload_json: JSON string payload for the genericUpdate process
                 (typically {"tableName": "...", "xData": {...}, "xDetails": [...]})
    """
    from app.graphql.resolvers.mutation_helper import resolve_generic_update_helper  # type: ignore
    try:
        # resolve_generic_update_helper expects a URL-encoded JSON string
        payload_encoded = urllib.parse.quote(payload_json)
        
        result = await resolve_generic_update_helper(db_name, schema, payload_encoded)
        return f"Data inserted successfully with result: {result}"
    except Exception as e:
        return f"Error inserting test data: {str(e)}\n{traceback.format_exc()}"


if __name__ == "__main__":
    mcp.run(transport="stdio")
