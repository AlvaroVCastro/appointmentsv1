import os
import telnyx

# Configuration - Replace these with your actual values from environment variables
TELNYX_API_KEY = os.getenv("TELNYX_API_KEY") or "your-telnyx-api-key"  # Set your Telnyx API key in environment
MESSAGING_PROFILE_ID = os.getenv("TELNYX_MESSAGING_PROFILE_ID") or "your-messaging-profile-id"  # Set your messaging profile ID in environment



TO_PHONE_NUMBER = os.getenv("TEST_PHONE_NUMBER") or "+1234567890"     # Set recipient's number in environment
FROM_SENDER = "Augusta"           # This will appear as the sender name
MESSAGE_TEXT = "We are cooking!"

def send_sms():
    """Send an SMS message using Telnyx"""
    try:
        # Check if credentials are available
        if not TELNYX_API_KEY or TELNYX_API_KEY == "your-telnyx-api-key":
            print("❌ Telnyx API credentials not configured. Please set TELNYX_API_KEY and TELNYX_MESSAGING_PROFILE_ID environment variables.")
            return False

        # Initialize the Telnyx client
        telnyx.api_key = TELNYX_API_KEY

        from datetime import datetime
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] Sending message to {TO_PHONE_NUMBER}...")
        
        # Send the message
        message = telnyx.Message.create(
            from_=FROM_SENDER,  # Using alphanumeric sender ID
            to=TO_PHONE_NUMBER,
            text=MESSAGE_TEXT,
            messaging_profile_id=MESSAGING_PROFILE_ID
        )

        print("Message sent successfully!")
        print(f"Message ID: {message.id}")
        print(f"Status: {message.status}")
        
        return message

    except Exception as e:
        print(f"Message status: {str(e)}")
        return None

if __name__ == "__main__":
    send_sms()
