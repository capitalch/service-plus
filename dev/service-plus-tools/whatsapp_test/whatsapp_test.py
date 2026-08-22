import requests

# 1. Grab your Phone Number ID from the Meta Dashboard (API Setup screen)
phone_number_id = "1292375123955916"
access_token = "EAATlNxUmh3gBSQKJtOSeFKWcTWZBNjbcZCI18mm33vRPT5l13zFLXFDxLrLo4LV3yGlQhoZBrtr2BaYa6F9gJ3uKwUW30zDStLYZAEVJ5Q6sUYA4Gh7mKlAzCHwVXaRDWueTxkxHBOyXK8DZB0aCYzxQUJISukEB8nCTgoRNZBpFR9KUPfaSy8FZCIl4qkpL23stm5BdJInxyt0YDjC86lRg6BtUJkVY3hgtGUfnW5bILQfnezwyriMSKjIVtL0CZAt8yFPzn093KmhWFpEhzexr"

# 2. Add the destination number with the country code (e.g., "918587808915").
# Note: Do NOT include the '+' sign, brackets, or spaces.
recipient_number = "919831052332"

url = f"https://graph.facebook.com/v22.0/{phone_number_id}/messages"

headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

payload = {
    "messaging_product": "whatsapp",
    "to": recipient_number,
    "type": "template",
    "template": {
        "name": "hello_world",
        "language": {
            "code": "en_US"
        }
    }
}

response = requests.post(url, headers=headers, json=payload)
print(f"Status Code: {response.status_code}")
print(response.json())