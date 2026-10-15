"""Sign-up approval puts the applicant's city and state on the head office (signups.py
set_head_office_city_gstin). The portal sends "City, State" in one city field."""
import pytest

from app.db.sql.sql_signups import SignupServerSql
from app.graphql.resolvers.bu_admin.signups import split_city_state


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("Kolkata, West Bengal", ("Kolkata", "West Bengal")),
        ("Port Blair, Andaman and Nicobar Islands", ("Port Blair", "Andaman and Nicobar Islands")),
        ("Mumbai", ("Mumbai", None)),
        ("", ("", None)),
    ],
)
def test_split_city_state(value, expected):
    assert split_city_state(value) == expected


def test_head_office_update_does_not_write_branch_gstin():
    """branch.gstin was dropped (GSTIN lives on the division); writing it failed every approval."""
    assert "gstin" not in SignupServerSql.SET_HEAD_OFFICE_CITY_GSTIN.split("WHERE")[0].split("SET", 1)[1]
