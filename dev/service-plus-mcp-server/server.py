from mcp.server.fastmcp import FastMCP
from datetime import datetime
import random

mcp = FastMCP("ServicePlus-MCP-Test")

# --- In-memory store for testing ---
_jobs: list[dict] = []
_next_id = 1


@mcp.tool()
def add_repair_job(device: str, issue: str, customer: str) -> str:
    """Add a dummy repair job to the in-memory store."""
    global _next_id
    job = {
        "id": _next_id,
        "device": device,
        "issue": issue,
        "customer": customer,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
    }
    _jobs.append(job)
    _next_id += 1
    return f"Created repair job #{job['id']} for {customer} — {device}: {issue}"


@mcp.tool()
def list_repair_jobs() -> str:
    """List all repair jobs in the in-memory store."""
    if not _jobs:
        return "No repair jobs found."
    lines = [f"#{j['id']} [{j['status']}] {j['customer']} | {j['device']} | {j['issue']}" for j in _jobs]
    return "\n".join(lines)


@mcp.tool()
def update_job_status(job_id: int, status: str) -> str:
    """Update the status of a repair job. Valid statuses: pending, in_progress, completed, cancelled."""
    valid = {"pending", "in_progress", "completed", "cancelled"}
    if status not in valid:
        return f"Invalid status '{status}'. Choose from: {', '.join(sorted(valid))}"
    for job in _jobs:
        if job["id"] == job_id:
            job["status"] = status
            return f"Job #{job_id} status updated to '{status}'."
    return f"Job #{job_id} not found."


@mcp.tool()
def get_stats() -> str:
    """Return a summary of repair job counts by status."""
    if not _jobs:
        return "No jobs to summarise."
    counts: dict[str, int] = {}
    for job in _jobs:
        counts[job["status"]] = counts.get(job["status"], 0) + 1
    lines = [f"{s}: {c}" for s, c in sorted(counts.items())]
    lines.insert(0, f"Total jobs: {len(_jobs)}")
    return "\n".join(lines)


@mcp.tool()
def seed_demo_data() -> str:
    """Populate the store with a handful of fake repair jobs for demo purposes."""
    samples = [
        ("iPhone 14", "cracked screen", "Alice"),
        ("Samsung S23", "battery drain", "Bob"),
        ("MacBook Pro", "keyboard not working", "Carol"),
        ("iPad Air", "charging port broken", "Dave"),
        ("Google Pixel 7", "camera malfunction", "Eve"),
    ]
    for device, issue, customer in samples:
        add_repair_job(device, issue, customer)
    # Randomly update some statuses to make stats interesting
    statuses = ["pending", "in_progress", "completed"]
    for job in _jobs:
        job["status"] = random.choice(statuses)
    return f"Seeded {len(samples)} demo repair jobs."


@mcp.resource("jobs://all")
def resource_all_jobs() -> str:
    """Expose all repair jobs as an MCP resource."""
    return list_repair_jobs()


@mcp.prompt()
def diagnose_prompt(device: str, symptoms: str) -> str:
    """Generate a diagnostic prompt for a repair technician."""
    return (
        f"You are an experienced electronics repair technician.\n"
        f"Device: {device}\n"
        f"Reported symptoms: {symptoms}\n\n"
        f"Provide a step-by-step diagnostic plan and the most likely root causes."
    )


if __name__ == "__main__":
    mcp.run(transport="stdio")
