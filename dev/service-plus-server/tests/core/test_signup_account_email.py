"""The email a sign-up's new Manager gets: client and login ID as a details table, buttons for
setting the password and opening the login page, and the client to choose spelled out."""
from app.core.exceptions import AppMessages
from app.services.signup_emails import build_html

RESET = "https://app.example.com/reset-password?token=abc"


def _body() -> str:
    return AppMessages.EMAIL_SIGNUP_USER_LINK_BODY.format(
        client_name="Customers",
        full_name="Asha Roy",
        login_link="https://app.example.com/login",
        reset_link=RESET,
        username="asharoy",
    )


def test_body_names_the_client_to_choose():
    body = _body()
    assert 'In the Client list, choose "Customers".' in body
    assert "your own business name is not listed there" in body
    assert 'open "Getting started" at the top of the screen' in body


def test_html_has_details_table_and_both_buttons():
    html = build_html(_body(), AppMessages.EMAIL_SIGNUP_USER_LINK_SUBJECT)
    assert ">Set your password</a>" in html
    assert ">Open Service+</a>" in html
    assert ">Customers</td>" in html and ">asharoy</td>" in html
